import { describe, expect, it } from "vitest";
import { CamelBrain } from "../src/game/systems/camel";

const COW_SPEED = 9;

describe("the camel (GAME_LOOP)", () => {
  it("never runs: speed is below the cow's irritated band", () => {
    const c = new CamelBrain(COW_SPEED);
    expect(c.speed).toBeLessThan(COW_SPEED);
    expect(c.speed).toBeGreaterThan(COW_SPEED * 0.9);
  });

  it("walks toward the cow and closes distance", () => {
    const c = new CamelBrain(COW_SPEED);
    c.spawn();
    let self = { x: 0, z: 0 };
    const cow = { x: 30, z: 0 };
    const d0 = Math.hypot(cow.x - self.x, cow.z - self.z);
    for (let i = 0; i < 60; i++) {
      const s = c.step(1 / 60, self, cow);
      self = { x: self.x + s.vx / 60, z: self.z + s.vz / 60 };
    }
    expect(Math.hypot(cow.x - self.x, cow.z - self.z)).toBeLessThan(d0);
  });

  it("slams within reach, then leaves", () => {
    const c = new CamelBrain(COW_SPEED);
    c.spawn();
    const s = c.step(1 / 60, { x: 0, z: 0 }, { x: 1, z: 0 });
    expect(s.slam).toBe(true);
    expect(c.state).toBe("leaving");
  });

  it("loses interest after the pursuit window", () => {
    const c = new CamelBrain(COW_SPEED);
    c.spawn();
    // cow keeps pace forever: he should give up, not chase eternally
    for (let i = 0; i < 26 * 60; i++) c.step(1 / 60, { x: 0, z: 0 }, { x: 50, z: 0 });
    expect(c.state).toBe("leaving");
  });

  it("despawns far from the cow while leaving", () => {
    const c = new CamelBrain(COW_SPEED);
    c.spawn();
    c.step(1 / 60, { x: 0, z: 0 }, { x: 1, z: 0 }); // slam -> leaving
    const s = c.step(1 / 60, { x: 200, z: 0 }, { x: 0, z: 0 });
    expect(s.despawn).toBe(true);
    expect(c.state).toBe("absent");
  });
});
