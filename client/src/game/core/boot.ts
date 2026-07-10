/** Engine entry — Stage 2: max-rage resolution, the camel, Nerves.
 * Berserk is a corridor, not a room: rage 100 now RESOLVES (photo or camel).
 * ADR-012 steering; ADR-013 economy (nerves are amoral). */
import * as THREE from "three";
import { createWorld, defineQuery, hasComponent, removeEntity } from "bitecs";
import { bus, commands } from "./bus";
import { createInput } from "./input";
import { bandParams } from "./bands";
import { tuning } from "./tuning";
import { seededRng } from "./rng";
import { createPhysics } from "../physics/world";
import { Registry } from "../ecs/registry";
import { Pickup, Smashable } from "../ecs/components";
import { buildGreybox } from "../scenes/greybox";
import { spawnCamelEntity } from "../scenes/camelSpawn";
import { RageMeter } from "../systems/rage";
import { ComboTracker } from "../systems/combo";
import { MaxRageDirector } from "../systems/maxrage";
import { CamelBrain } from "../systems/camel";

const SESSION_S = tuning.session.target_minutes_min * 30;
const SMASH_MIN_SPEED = 3;
const BASE_SPEED = 9;
const NERVES_START = 3;
const FIELD_EDGE = 66;

const smashQuery = defineQuery([Smashable]);

const lerpAngle = (a: number, b: number, t: number): number => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

export function bootGame(canvas: HTMLCanvasElement): () => void {
  let disposed = false;
  let cleanup: (() => void) | null = null;

  void (async () => {
    try {
      const physics = await createPhysics();
      if (disposed) return;

      const ecs = createWorld();
      const reg = new Registry();
      const seed = Math.floor(Math.random() * 2 ** 31); // Stage 3: server-issued
      const { scene, cowBody } = buildGreybox(physics, ecs, reg, seed, {
        smashables: 80,
        beer: 6,
        wine_chance: 0.33,
      });

      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 300);
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
      void seededRng; // seeded challenge modes reuse this later

      let destructionScore = 0;
      let elapsed = 0;
      let ended = false;
      let heading = 0;
      let shake = 0;
      let nerves = NERVES_START;
      let camelEid = -1;
      let camelBody: import("@dimforge/rapier3d-compat").RigidBody | null = null;
      let camelScheduledAt = SESSION_S * tuning.camel.scheduled_beat_pct;
      let camelSightCooldown = 0;

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
        if (!byCamel) rage.add(2); // her spiral, not his — tuning.json: rage.triggers.smash
        shake = Math.min(1, shake + 0.25 * params.damage);
        const b = reg.bodies.get(eid);
        if (b) spawnDebris(b.translation(), Smashable.points[eid]);
        reg.remove(eid, physics.world, scene);
        removeEntity(ecs, eid);
        bus.emit({ type: "scoreChanged", destruction: destructionScore, rescue: 0 });
      };

      const consume = (eid: number): void => {
        rage.sink(Pickup.kind[eid] === 0 ? "beer_generic" : "wine");
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
        bus.emit({ type: "sessionEnded", reason });
      };

      const slamCow = (): void => {
        // slapstick: up and away, stars implied (real animation: Stage 4)
        const cv = camelBody?.translation();
        const cp = cowBody.translation();
        const dir = cv ? { x: cp.x - cv.x, z: cp.z - cv.z } : { x: 1, z: 0 };
        const len = Math.hypot(dir.x, dir.z) || 1;
        cowBody.applyImpulse({ x: (dir.x / len) * 60, y: 45, z: (dir.z / len) * 60 }, true);
        shake = 1;
        nerves -= 1;
        bus.emit({ type: "nervesChanged", remaining: nerves });
        combo.break_();
        if (nerves <= 0) {
          endSession("cameld");
        } else {
          rage.setTo(40); // dazed respawn — ADR-013
          bus.emit({ type: "maxRageResolved", via: "camel" });
        }
        maxRage.reset();
      };

      const unsubCommands = commands.subscribe((c) => {
        if (c.type === "photoProvided" && maxRage.current === "waiting") {
          maxRage.calm();
          rage.setTo(0);
          bus.emit({ type: "maxRageResolved", via: "photo" });
          maxRage.reset();
        }
        if (c.type === "refusePhoto") {
          if (maxRage.refuse() === "timeout") spawnCamel(true);
        }
      });

      const FIXED = 1 / 60;
      let acc = 0;
      let last = performance.now();
      let raf = 0;

      const frame = (now: number): void => {
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;

        const waiting = maxRage.current === "waiting";

        if (!ended) {
          if (!waiting) {
            elapsed += dt;
            if (elapsed >= SESSION_S) endSession("timer");
            bus.emit({ type: "timerTick", remainingS: Math.max(0, SESSION_S - elapsed) });
            rage.tick(dt);
          } else if (maxRage.tick(dt) === "timeout") {
            spawnCamel(true); // she is on her own now
          }

          const params = bandParams(rage.band);

          if (maxRage.maybeStart(rage.rage)) {
            cowBody.setLinvel({ x: 0, y: cowBody.linvel().y, z: 0 }, true);
            bus.emit({ type: "maxRageResolutionStarted", timerS: tuning.maxrage.decision_timer_s });
          }

          if (!waiting) {
            // ADR-012: her will first, your authority last
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
            if (Math.hypot(input.state.x, input.state.z) > 0.01) {
              const want = Math.atan2(input.state.x, input.state.z);
              heading = lerpAngle(heading, want, 1 - Math.exp(-AUTHORITY * dt));
            }

            const speed = BASE_SPEED * params.speed;
            const vy = cowBody.linvel().y;
            cowBody.setLinvel({ x: Math.sin(heading) * speed, y: vy, z: Math.cos(heading) * speed }, true);
          }

          // scheduled camel beat — guaranteed once per session (GAME_LOOP)
          if (camelEid === -1 && elapsed >= camelScheduledAt) {
            camelScheduledAt = Infinity;
            spawnCamel(false);
          }

          // camel update (walks during play AND during the cinematic aftermath)
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

            // sight of him feeds her fear (which feeds him) — cooldown-gated
            camelSightCooldown -= dt;
            if (camel.state === "approaching" && camelSightCooldown <= 0 && !waiting) {
              const d = Math.hypot(cvp.x - cpp.x, cvp.z - cpp.z);
              if (d < 45) {
                rage.add(tuning.rage.triggers.camel_silhouette);
                camelSightCooldown = 5;
              }
            }
          }

          acc += dt;
          while (acc >= FIXED) {
            physics.step((h1, h2, started) => {
              if (!started || ended) return;
              const e1 = reg.colliderToEid.get(h1);
              const e2 = reg.colliderToEid.get(h2);
              if (e1 === undefined || e2 === undefined) return;

              // the Lure: his collisions score for you at 1.5x (GAME_LOOP)
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

          // debris: confetti, not physics
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
          shake *= Math.exp(-6 * dt);
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
        camera.position.x += (Math.random() - 0.5) * shake;
        camera.position.y += (Math.random() - 0.5) * shake;
        camera.lookAt(cp.x, cp.y, cp.z);

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
