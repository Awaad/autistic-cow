/** Engine entry — (post-playtest).
 * fires once per encounter, prompt gated on camel absence (when he's present,
 * HE is the resolution), photo floor 35 (wine is the only true zero),
 * trauma-based shake, slam cinematic (slow-mo + ragdoll + he stands over her). */
import * as THREE from "three";
import { createWorld, defineQuery, hasComponent, removeEntity } from "bitecs";
import { bus, commands } from "./bus";
import { createInput } from "./input";
import { bandParams } from "./bands";
import { tuning } from "./tuning";
import { seededRng } from "./rng";
import { createPhysics } from "../physics/world";
import { Registry } from "../ecs/registry";
import { ChildTag, Pickup, Rescueable, Smashable } from "../ecs/components";
import { buildKyreniaGen } from "../scenes/kyrenia-gen";
import { KYRENIA } from "../assets/kyrenia-harbor-gen";
import { addComponent, addEntity } from "bitecs";
import { spawnCamelEntity } from "../scenes/camelSpawn";
import { RageMeter } from "../systems/rage";
import { ComboTracker } from "../systems/combo";
import { MaxRageDirector } from "../systems/maxrage";
import { CamelBrain } from "../systems/camel";
import { ChildBrain } from "../systems/children";
import { JudgeLog } from "../judge/log";
import { HesitationDetector } from "../judge/hesitation";
import { CommentEngine } from "../judge/engine";
import { poolFor } from "../judge/pools";
import { buildIceCream } from "../art/critters";

const SESSION_S = tuning.session.target_minutes_min * 60;
const SMASH_MIN_SPEED = 3;
const BASE_SPEED = 9;
const NERVES_START = 3;
const FIELD_EDGE = 66;

const KYRENIA_HALF = KYRENIA.bounds.halfW;
const smashQuery = defineQuery([Smashable]);
const rescueQuery = defineQuery([Rescueable]);
const childQuery = defineQuery([ChildTag]);

const lerpAngle = (a: number, b: number, t: number): number => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

export function bootGame(canvas: HTMLCanvasElement, opts?: { seed?: number; locale?: string  }): () => void {
  let disposed = false;
  let cleanup: (() => void) | null = null;

  void (async () => {
    try {
      const physics = await createPhysics();
      if (disposed) return;

      const ecs = createWorld();
      const reg = new Registry();
      const seed = opts?.seed ?? Math.floor(Math.random() * 2 ** 31); // server-issued when online
      const { scene, cowBody, buildingColliders } = buildKyreniaGen(physics, ecs, reg);

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1500);
      const resize = (): void => {
        renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
        camera.aspect = canvas.clientWidth / canvas.clientHeight;
        camera.updateProjectionMatrix();
      };
      resize();
      window.addEventListener("resize", resize);

      const input = createInput();
      const rage = new RageMeter();
      const combo = new ComboTracker();
      const maxRage = new MaxRageDirector();
      const camel = new CamelBrain(BASE_SPEED);
      const judge = new JudgeLog();
      const comments = new CommentEngine(poolFor(opts?.locale ?? "en"));
      const childBrains = new Map<number, ChildBrain>();
      const childScareCooldown = new Map<number, number>();
      const childDroppedTreat = new Set<number>();
      const hesitations = new Map<number, HesitationDetector>();
      const rescueDwell = new Map<number, number>();
      void seededRng; // seeded challenge modes reuse this later

      let destructionScore = 0;
      let rescueScore = 0;
      let sinceSpreeEvent = 0;
      let elapsed = 0;
      let ended = false;
      let heading = 0;
      let trauma = 0;       // camera shake energy (squared on application)
      let heat = 0;         // her noise; summons him at threshold
      let peakRage = 0;
      let nerves = NERVES_START;
      let camelEid = -1;
      let camelBody: import("@dimforge/rapier3d-compat").RigidBody | null = null;
      let camelScheduledAt = SESSION_S * tuning.camel.scheduled_beat_pct;
      let camelSighted = false;
      let buildingHitCooldown = 0;
      let timeScale = 1;    // slam cinematic slow-mo
      let slamT = 0;        // cinematic recovery countdown (real seconds)

      interface Debris { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }
      const debris: Debris[] = [];
      const debrisGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
      const spawnDebris = (at: { x: number; y: number; z: number }, points: number): void => {
        const n = 6 + Math.min(6, Math.floor(points / 10));
        for (let i = 0; i < n; i++) {
          const m = new THREE.Mesh(
            debrisGeo,
            new THREE.MeshStandardMaterial({ color: 0x8888aa, transparent: true }),
          );
          m.position.set(at.x, at.y, at.z);
          scene.add(m);
          debris.push({
            mesh: m,
            vel: new THREE.Vector3((Math.random() - 0.5) * 10, 4 + Math.random() * 6, (Math.random() - 0.5) * 10),
            life: 0.7,
          });
        }
      };

      const smash = (eid: number, t: number, byCamel: boolean): void => {
        combo.smash(t);
        const params = bandParams(rage.band);
        const lure = byCamel ? tuning.camel.lure_score_mult : 1;
        destructionScore += Math.round(Smashable.points[eid] * params.damage * combo.multiplier(t) * lure);
        if (!byCamel) {
          rage.add(2); // her spiral, not his — migrate to tuning: rage.triggers.smash
          heat += Smashable.points[eid]; // her noise summons him; his doesn't
        }
        trauma = Math.min(1, trauma + 0.25 * params.damage);
        const b = reg.bodies.get(eid);
        if (b) spawnDebris(b.translation(), Smashable.points[eid]);
        reg.remove(eid, physics.world, scene);
        removeEntity(ecs, eid);
        bus.emit({ type: "scoreChanged", destruction: destructionScore, rescue: rescueScore });
        if (byCamel) record("lure_executed", t);
        else if (combo.chain >= 8 && elapsed - sinceSpreeEvent > 20) {
          sinceSpreeEvent = elapsed;
          record("destruction_spree", t);
        }
      };

      const addEntityLocal = (): number => {
        const eid = addEntity(ecs);
        addComponent(ecs, Rescueable, eid);
        Rescueable.kind[eid] = 3; // dropped ice cream
        Rescueable.points[eid] = 20;
        return eid;
      };

      const record = (type: Parameters<JudgeLog["add"]>[0], t: number): void => {
        const n = judge.add(type, rage.rage, t);
        bus.emit({ type: "judgeEventRecorded", etype: type, rage: Math.round(rage.rage) });
        // escalating triggers: third scare, second camel'd, etc.
        const trigger =
          type === "child_scared" && n >= 3 ? "child_scared_x3" :
          type === "cameld" && n >= 2 ? "cameld_x2" : type;
        const line = comments.serve(trigger, judge.band(), t);
        if (line) bus.emit({ type: "judgeComment", text: line });
      };

      const consume = (eid: number): void => {
        const isWine = Pickup.kind[eid] === 1;
        rage.sink(isWine ? "wine" : "beer_generic");
        if (isWine) record("wine_found", elapsed);
        reg.remove(eid, physics.world, scene);
        removeEntity(ecs, eid);
      };

      const spawnCamel = (nearCow: boolean): void => {
        if (camelEid !== -1) return;
        const cp = cowBody.translation();
        let x: number;
        let z: number;
        if (nearCow) {
          const a = Math.random() * Math.PI * 2;
          x = cp.x + Math.cos(a) * 14;
          z = cp.z + Math.sin(a) * 14;
        } else {
          x = Math.sign(cp.x || 1) * -FIELD_EDGE;
          z = Math.sign(cp.z || 1) * -FIELD_EDGE;
        }
        const spawned = spawnCamelEntity(physics, ecs, reg, scene, x, z);
        camelEid = spawned.eid;
        camelBody = spawned.body;
        camel.spawn();
        camelSighted = false; // the spike is per-encounter
        bus.emit({ type: "camelStateChanged", state: "approaching" });
      };

      const despawnCamel = (): void => {
        if (camelEid === -1) return;
        reg.remove(camelEid, physics.world, scene);
        removeEntity(ecs, camelEid);
        camelEid = -1;
        camelBody = null;
        bus.emit({ type: "camelStateChanged", state: "gone" });
      };

      const endSession = (reason: "timer" | "cameld" | "player_exit"): void => {
        if (ended) return;
        ended = true;
        bus.emit({
          type: "sessionStats",
          destruction: destructionScore,
          rescue: rescueScore,
          peakRage,
          nervesLost: NERVES_START - nerves,
        });
        bus.emit({ type: "sessionEnded", reason });
      };

      const slamCow = (): void => {
        // THE moment: slow-motion, ragdoll tumble, he stands over her.
        const cv = camelBody?.translation();
        const cp = cowBody.translation();
        const dir = cv ? { x: cp.x - cv.x, z: cp.z - cv.z } : { x: 1, z: 0 };
        const len = Math.hypot(dir.x, dir.z) || 1;
        cowBody.lockRotations(false, true); // ragdoll: she tumbles
        cowBody.applyImpulse({ x: (dir.x / len) * 60, y: 45, z: (dir.z / len) * 60 }, true);
        cowBody.applyTorqueImpulse({ x: 25, y: 10, z: 25 }, true);
        timeScale = 0.3;
        slamT = 1.8;
        trauma = 1;
        nerves -= 1;
        bus.emit({ type: "nervesChanged", remaining: nerves });
        combo.break_();
        if (nerves <= 0) {
          endSession("cameld");
        } else {
          rage.setTo(40); // dazed respawn — ADR-013
          bus.emit({ type: "maxRageResolved", via: "camel" });
          record("cameld", elapsed);
        }
        maxRage.reset();
      };

      const unsubCommands = commands.subscribe((c) => {
        if (c.type === "photoCalm" && maxRage.current === "waiting") {
          maxRage.calm();
          rage.setTo(tuning.maxrage.photo_rage_floor); // saved, still simmering
          bus.emit({ type: "maxRageResolved", via: "photo" });
          record("photo_calm_used", elapsed);
          maxRage.reset();
        }
        if (c.type === "refusePhoto") {
          if (maxRage.refuse() === "timeout") spawnCamel(true);
        }
        if (c.type === "pettingZoo" && maxRage.current === "waiting") {
          maxRage.calm();
          rage.setTo(40); // survival, not victory (01_GAME_LOOP §5.4)
          bus.emit({ type: "maxRageResolved", via: "petting" });
          maxRage.reset();
        }
      });

      const FIXED = 1 / 60;
      let acc = 0;
      let last = performance.now();
      let raf = 0;

      const frame = (now: number): void => {
        const rawDt = Math.min(0.1, (now - last) / 1000);
        last = now;
        const dt = rawDt * timeScale; // slam cinematic slows the world, not the wall clock

        // cinematic recovery runs on real time
        if (slamT > 0) {
          slamT -= rawDt;
          if (slamT <= 0) {
            timeScale = 1;
            cowBody.lockRotations(true, true);
            cowBody.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
          }
        }

        const waiting = maxRage.current === "waiting";

        if (!ended) {
          if (!waiting) {
            elapsed += dt;
            if (elapsed >= SESSION_S) endSession("timer");
            bus.emit({ type: "timerTick", remainingS: Math.max(0, SESSION_S - elapsed) });
            rage.tick(dt);
            if (rage.rage > peakRage) peakRage = Math.round(rage.rage);
          } else if (maxRage.tick(rawDt) === "timeout") {
            spawnCamel(true); // she is on her own now
          }

          const params = bandParams(rage.band);

          // mercy is only offered while he's away; when present, HE resolves it
          if (camelEid === -1 && maxRage.maybeStart(rage.rage)) {
            cowBody.setLinvel({ x: 0, y: cowBody.linvel().y, z: 0 }, true);
            const pz = KYRENIA.pettingZoo;
            const cpz = cowBody.translation();
            const pzNear = Math.hypot(pz.x - cpz.x, pz.z - cpz.z) < 22;
            bus.emit({ type: "maxRageResolutionStarted", timerS: tuning.maxrage.decision_timer_s, pettingZoo: pzNear });
          }

          if (!waiting && slamT <= 0) {
            // ADR-012: her will first, her fear second, your authority last
            const SEEK = { serene: 0.4, irritated: 1.2, furious: 2.2, berserk: 4.5 }[rage.band];
            const AUTHORITY = { serene: 7, irritated: 4.5, furious: 3.4, berserk: 1.1 }[rage.band];

            const cp0 = cowBody.translation();
            let best: { x: number; z: number } | null = null;
            let bestD = Infinity;
            for (const eid of smashQuery(ecs)) {
              if (eid === camelEid) continue;
              const b = reg.bodies.get(eid);
              if (!b) continue;
              const p = b.translation();
              const d = (p.x - cp0.x) ** 2 + (p.z - cp0.z) ** 2;
              if (d < bestD) { bestD = d; best = { x: p.x, z: p.z }; }
            }
            if (best) {
              const toward = Math.atan2(best.x - cp0.x, best.z - cp0.z);
              heading = lerpAngle(heading, toward, 1 - Math.exp(-SEEK * dt));
            }

            // her one fear outranks her appetite
            if (camelEid !== -1 && camel.state === "approaching" && camelBody) {
              const cv = camelBody.translation();
              const d = Math.hypot(cv.x - cp0.x, cv.z - cp0.z);
              if (d < 35) {
                const away = Math.atan2(cp0.x - cv.x, cp0.z - cv.z);
                const FEAR = 3.5 * (1 - d / 35);
                heading = lerpAngle(heading, away, 1 - Math.exp(-FEAR * dt));
              }
            }

            if (Math.hypot(input.state.x, input.state.z) > 0.01) {
              const want = Math.atan2(input.state.x, input.state.z);
              heading = lerpAngle(heading, want, 1 - Math.exp(-AUTHORITY * dt));
            }

            const speed = BASE_SPEED * params.speed;
            const vy = cowBody.linvel().y;
            cowBody.setLinvel({ x: Math.sin(heading) * speed, y: vy, z: Math.cos(heading) * speed }, true);
          }

          // rescueables: serene-band dwell to rescue; hesitation watched
          if (!waiting && slamT <= 0) {
            const cpr = cowBody.translation();
            let hintState: "none" | "calm_needed" | "soothing" = "none";
            let hintPct = 0;
            for (const eid of rescueQuery(ecs)) {
              const b = reg.bodies.get(eid);
              if (!b) continue;
              const p = b.translation();
              const dist = Math.hypot(p.x - cpr.x, p.z - cpr.z);

              if (dist < 4.5 && hintState === "none") {
                hintState = rage.band === "serene" ? "soothing" : "calm_needed";
              }
              let rescuedNow = false;
              if (rage.band === "serene" && dist < 2.5) {
                const d = (rescueDwell.get(eid) ?? 0) + dt;
                rescueDwell.set(eid, d);
                hintPct = Math.min(1, (rescueDwell.get(eid) ?? 0) / 1.2);
                if (d >= 1.2) {
                  rescuedNow = true;
                  const isTreat = Rescueable.kind[eid] === 3;
                  rescueScore += Rescueable.points[eid];
                  record(isTreat ? "child_helped" : "rescue_completed", elapsed);
                  bus.emit({ type: "scoreChanged", destruction: destructionScore, rescue: rescueScore });
                  reg.remove(eid, physics.world, scene);
                  removeEntity(ecs, eid);
                  rescueDwell.delete(eid);
                  hesitations.delete(eid);
                }
              } else if (dist > 3.5) {
                rescueDwell.delete(eid);
              }

              if (!rescuedNow) {
                let det = hesitations.get(eid);
                if (!det) { det = new HesitationDetector(); hesitations.set(eid, det); }
                const verdict = det.step(dt, dist, false);
                if (verdict) record(verdict, elapsed);
              }
            }
            bus.emit({ type: "rescueHint", state: hintState, pct: hintPct });

            // children: flee brains; scaring is seen; treats get dropped
            const cowSpd = Math.hypot(cowBody.linvel().x, cowBody.linvel().z);
            for (const eid of childQuery(ecs)) {
              const b = reg.bodies.get(eid);
              if (!b) continue;
              let brain = childBrains.get(eid);
              if (!brain) { brain = new ChildBrain(eid * 1.7); childBrains.set(eid, brain); }
              const p = b.translation();
              const step = brain.step(dt, { x: p.x, z: p.z }, { x: cpr.x, z: cpr.z }, cowSpd);
              const hw = KYRENIA_HALF - 3;
              b.setNextKinematicTranslation({
                x: Math.max(-hw, Math.min(hw, p.x + step.vx * dt)),
                y: 0,
                z: Math.max(-hw, Math.min(38, p.z + step.vz * dt)),
              });
              const m = reg.meshes.get(eid);
              if (m && (step.vx || step.vz)) m.lookAt(p.x + step.vx, 0, p.z + step.vz);

              const cool = (childScareCooldown.get(eid) ?? 0) - dt;
              childScareCooldown.set(eid, cool);
              if (step.scared && cool <= 0) {
                childScareCooldown.set(eid, 12);
                record("child_scared", elapsed);
                if (!childDroppedTreat.has(eid)) {
                  childDroppedTreat.add(eid);
                  // the dropped ice cream becomes a rescueable — the redemption object
                  const tEid = addEntityLocal();
                  const mesh = buildIceCream();
                  mesh.position.set(p.x, 0, p.z);
                  scene.add(mesh);
                  const tBody = physics.world.createRigidBody(
                    physics.R.RigidBodyDesc.fixed().setTranslation(p.x, 0, p.z),
                  );
                  const tCol = physics.world.createCollider(
                    physics.R.ColliderDesc.cuboid(0.3, 0.3, 0.3).setSensor(true),
                    tBody,
                  );
                  reg.register(tEid, tBody, mesh, tCol);
                }
              }
            }
          }

          // heat decays; a real rampage summons him early (450 ≈ 30 boxes net)
          heat = Math.max(0, heat - 8 * dt);
          if (camelEid === -1 && heat >= tuning.camel.heat_early_spawn_threshold) {
            heat = 0;
            spawnCamel(false);
          }
          // scheduled beat — guaranteed once per session 
          if (camelEid === -1 && elapsed >= camelScheduledAt) {
            camelScheduledAt = Infinity;
            spawnCamel(false);
          }

          // camel update
          if (camelEid !== -1 && camelBody) {
            const cvp = camelBody.translation();
            const cpp = cowBody.translation();
            const step = camel.step(dt, { x: cvp.x, z: cvp.z }, { x: cpp.x, z: cpp.z });
            camelBody.setNextKinematicTranslation({
              x: cvp.x + step.vx * dt, y: 0, z: cvp.z + step.vz * dt,
            });
            const mesh = reg.meshes.get(camelEid);
            if (mesh) mesh.lookAt(cpp.x, 0, cpp.z);
            if (step.slam) slamCow();
            if (step.despawn) despawnCamel();

            // first sighting spikes her — once per encounter, not a drumbeat
            if (camel.state === "approaching" && !camelSighted && !waiting) {
              const d = Math.hypot(cvp.x - cpp.x, cvp.z - cpp.z);
              if (d < 45) {
                rage.add(tuning.rage.triggers.camel_silhouette);
                camelSighted = true;
              }
            }
          }

          acc += dt;
          while (acc >= FIXED) {
            physics.step((h1, h2, started) => {
              if (!started || ended) return;
              const e1 = reg.colliderToEid.get(h1);
              const e2 = reg.colliderToEid.get(h2);

              // the city bites back: buildings punish speed, never score
              if (buildingColliders.has(h1) || buildingColliders.has(h2)) {
                const otherEid = buildingColliders.has(h1) ? e2 : e1;
                if (
                  otherEid !== undefined &&
                  reg.bodies.get(otherEid) === cowBody &&
                  !waiting &&
                  buildingHitCooldown <= 0
                ) {
                  const v = cowBody.linvel();
                  if (Math.hypot(v.x, v.z) >= 5) {
                    buildingHitCooldown = 0.5;
                    rage.add(tuning.rage.triggers.building_hit);
                    heat += 14; // walls are loud; he hears
                    trauma = Math.min(1, trauma + 0.2);
                  }
                }
                return;
              }
              if (e1 === undefined || e2 === undefined) return;

              // the Lure: his collisions score for you at 1.5x 
              if ((e1 === camelEid || e2 === camelEid) && camelEid !== -1) {
                const other = e1 === camelEid ? e2 : e1;
                if (hasComponent(ecs, Smashable, other)) smash(other, elapsed, true);
                return;
              }

              const cowIsE1 = reg.bodies.get(e1) === cowBody;
              const cowIsE2 = reg.bodies.get(e2) === cowBody;
              if (!cowIsE1 && !cowIsE2) return;
              const other = cowIsE1 ? e2 : e1;

              if (hasComponent(ecs, Pickup, other)) {
                consume(other);
                return;
              }
              if (hasComponent(ecs, Smashable, other)) {
                const v = cowBody.linvel();
                const speed = Math.hypot(v.x, v.z);
                if (speed >= SMASH_MIN_SPEED && !waiting) smash(other, elapsed, false);
                else if (!waiting) rage.add(tuning.rage.triggers.unbroken_collision);
              }
            });
            acc -= FIXED;
          }

          // debris: confetti, not physics (slows with the world — free slow-mo juice)
          for (let i = debris.length - 1; i >= 0; i--) {
            const d = debris[i];
            d.life -= dt;
            if (d.life <= 0) {
              scene.remove(d.mesh);
              (d.mesh.material as THREE.Material).dispose();
              debris.splice(i, 1);
              continue;
            }
            d.vel.y -= 20 * dt;
            d.mesh.position.addScaledVector(d.vel, dt);
            d.mesh.rotation.x += 8 * dt;
            d.mesh.rotation.z += 6 * dt;
            (d.mesh.material as THREE.MeshStandardMaterial).opacity = d.life / 0.7;
          }
          trauma = Math.max(0, trauma - 1.8 * rawDt);
          buildingHitCooldown -= rawDt;
        }

        for (const [eid, body] of reg.bodies) {
          const mesh = reg.meshes.get(eid);
          if (!mesh || eid === camelEid) continue; // camel mesh is rotated via lookAt
          const p = body.translation();
          mesh.position.set(p.x, p.y, p.z);
          const q = body.rotation();
          mesh.quaternion.set(q.x, q.y, q.z, q.w);
        }
        if (camelEid !== -1 && camelBody) {
          const m = reg.meshes.get(camelEid);
          const p = camelBody.translation();
          if (m) m.position.set(p.x, p.y, p.z);
        }

        const cp = cowBody.translation();
        camera.position.lerp(new THREE.Vector3(cp.x, cp.y + 12, cp.z + 16), 0.08);
        camera.lookAt(cp.x, cp.y, cp.z);
        // trauma shake: smooth oscillation + roll (impact, not malfunction)
        const sh = trauma * trauma;
        const tms = now / 1000;
        camera.position.x += Math.sin(tms * 47) * sh * 0.5;
        camera.position.y += Math.cos(tms * 39) * sh * 0.4;
        camera.rotation.z += Math.sin(tms * 53) * sh * 0.03;

        renderer.render(scene, camera);
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);

      bus.emit({ type: "nervesChanged", remaining: nerves });

      cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", resize);
        unsubCommands();
        input.dispose();
        renderer.dispose();
      };
    } catch (err) {
      console.error("[boot]", err);
      bus.emit({ type: "bootError", message: err instanceof Error ? err.message : String(err) });
    }
  })();

  return () => {
    disposed = true;
    cleanup?.();
  };
}
