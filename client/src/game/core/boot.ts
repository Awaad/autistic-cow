/** Engine entry — Stage 1: the grey-box core loop.
 * Rage earns. Calm spends. (The Judge arrives in Stage 2.)
 * Contract with the React shell is unchanged: boot(canvas) -> dispose. */
import * as THREE from "three";
import { createWorld, hasComponent, removeEntity } from "bitecs";
import { bus } from "./bus";
import { createInput } from "./input";
import { bandParams } from "./bands";
import { tuning } from "./tuning";
import { seededRng } from "./rng";
import { defineQuery } from "bitecs";
import { createPhysics } from "../physics/world";
import { Registry } from "../ecs/registry";
import { Pickup, Smashable } from "../ecs/components";
import { buildGreybox } from "../scenes/greybox";
import { RageMeter } from "../systems/rage";
import { ComboTracker } from "../systems/combo";

const SESSION_S = tuning.session.target_minutes_min * 20;
const SMASH_MIN_SPEED = 3; // m/s below which the cow just bumps (+rage, no break)



export function bootGame(canvas: HTMLCanvasElement): () => void {
  let disposed = false;
  let cleanup: (() => void) | null = null;

  void (async () => {
    const physics = await createPhysics();
    if (disposed) return;

    const ecs = createWorld();
    const reg = new Registry();
    const seed = Math.floor(Math.random() * 2 ** 31); // Later: server-issued
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
    const driftRng = seededRng(seed ^ 0x5f3759df);
    const smashQuery = defineQuery([Smashable]); 

    const BASE_SPEED = 9;                          // m/s at 1.0x band
    let heading = 0;                               // radians, persists — she never stops
    let shake = 0;
    const lerpAngle = (a: number, b: number, t: number): number => {
      let d = (b - a) % (Math.PI * 2);
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      return a + d * t;
    };

    interface Debris { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }
    const debris: Debris[] = [];
    const debrisGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);



    let destructionScore = 0;
    let elapsed = 0;
    let ended = false;

    function spawnDebris(target: THREE.Scene, at: { x: number; y: number; z: number }, points: number): void {
      const n = 6 + Math.min(6, Math.floor(points / 10)); // bigger box, more confetti
      for (let i = 0; i < n; i++) {
        const mat = new THREE.MeshStandardMaterial({ color: 0x8888aa, transparent: true });
        const m = new THREE.Mesh(debrisGeo, mat);
        m.position.set(at.x, at.y, at.z);
        target.add(m);
        debris.push({
          mesh: m,
          vel: new THREE.Vector3((Math.random() - 0.5) * 10, 4 + Math.random() * 6, (Math.random() - 0.5) * 10),
          life: 0.7,
        });
      }
    }

    const smash = (eid: number, t: number): void => {
      const chain = combo.smash(t);
      const params = bandParams(rage.band);
      destructionScore += Math.round(Smashable.points[eid] * params.damage * combo.multiplier(t));
      rage.add(2); // destruction feeds the spiral — migrate to tuning.json: rage.triggers.smash
      shake = Math.min(1, shake + 0.25 * params.damage);
      spawnDebris(scene, reg.bodies.get(eid)!.translation(), Smashable.points[eid]);
      
      reg.remove(eid, physics.world, scene);
      
      removeEntity(ecs, eid);
      bus.emit({ type: "scoreChanged", destruction: destructionScore, rescue: 0 });
      void chain;
    };

    const consume = (eid: number): void => {
      rage.sink(Pickup.kind[eid] === 0 ? "beer_generic" : "wine");
      reg.remove(eid, physics.world, scene);
      removeEntity(ecs, eid);
    };

    const onContact = (h1: number, h2: number, started: boolean): void => {
      if (!started || ended) return;
      const e1 = reg.colliderToEid.get(h1);
      const e2 = reg.colliderToEid.get(h2);
      if (e1 === undefined || e2 === undefined) return;
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
        if (speed >= SMASH_MIN_SPEED) smash(other, elapsed);
        else rage.add(tuning.rage.triggers.unbroken_collision);
      }
    };

    const endSession = (reason: "timer" | "player_exit"): void => {
      if (ended) return;
      ended = true;
      bus.emit({ type: "sessionEnded", reason });
    };

    // fixed-timestep physics, variable render
    const FIXED = 1 / 60;
    let acc = 0;
    let last = performance.now();
    let raf = 0;

    const frame = (now: number): void => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      if (!ended) {
        elapsed += dt;
        if (elapsed >= SESSION_S) endSession("timer");
        bus.emit({ type: "timerTick", remainingS: Math.max(0, SESSION_S - elapsed) });

        rage.tick(dt);
        const params = bandParams(rage.band);

        // debris: manual integration — confetti, not physics objects
        for (let i = debris.length - 1; i >= 0; i--) {
          const d = debris[i];
          d.life -= dt;
          if (d.life <= 0) {
            scene.remove(d.mesh);
            (d.mesh.material as THREE.Material).dispose();
            debris.splice(i, 1);
            continue;
          }
          d.vel.y -= 20 * dt; // heavy gravity reads punchier than real
          d.mesh.position.addScaledVector(d.vel, dt);
          d.mesh.rotation.x += 8 * dt;
          d.mesh.rotation.z += 6 * dt;
          (d.mesh.material as THREE.MeshStandardMaterial).opacity = d.life / 0.7;
        }
        shake *= Math.exp(-6 * dt);

        // the cow is autonomous; the player is restraint.
        // HER WILL: always seeking the nearest smashable — grows with rage
        const SEEK      = { serene: 0.4, irritated: 1.3, furious: 2.6, berserk: 4.5 }[rage.band];
        // YOUR AUTHORITY: counter-steer strength — shrinks with rage
        const AUTHORITY = { serene: 7,   irritated: 4.5, furious: 2.4, berserk: 1.001 }[rage.band];

        // her intent first
        const cp0 = cowBody.translation();
        let best: { x: number; z: number } | null = null;
        let bestD = Infinity;
        for (const eid of smashQuery(ecs)) {
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

        // player correction last — final say, proportional to authority
        if (Math.hypot(input.state.x, input.state.z) > 0.01) {
          const want = Math.atan2(input.state.x, input.state.z);
          heading = lerpAngle(heading, want, 1 - Math.exp(-AUTHORITY * dt));
        }

        const speed = BASE_SPEED * params.speed;
        const vy = cowBody.linvel().y;
        cowBody.setLinvel({ x: Math.sin(heading) * speed, y: vy, z: Math.cos(heading) * speed }, true);

        acc += dt;
        while (acc >= FIXED) {
          physics.step(onContact);
          acc -= FIXED;
        }
      }

      // render sync: Rapier -> Three
      for (const [eid, body] of reg.bodies) {
        const mesh = reg.meshes.get(eid);
        if (!mesh) continue;
        const p = body.translation();
        mesh.position.set(p.x, p.y, p.z);
        const q = body.rotation();
        mesh.quaternion.set(q.x, q.y, q.z, q.w);
      }

      // third-person follow
      const cp = cowBody.translation();
      camera.position.lerp(new THREE.Vector3(cp.x, cp.y + 12, cp.z + 16), 0.08);
      camera.position.x += (Math.random() - 0.5) * shake;
      camera.position.y += (Math.random() - 0.5) * shake;
      camera.lookAt(cp.x, cp.y, cp.z);

      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);

    cleanup = () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      input.dispose();
      renderer.dispose();
    };
  })();

  return () => {
    disposed = true;
    cleanup?.();
  };
}
