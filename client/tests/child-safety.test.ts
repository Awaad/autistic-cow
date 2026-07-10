/** Repo Law 4: these tests run on every CI pass, forever. */
import { describe, expect, it } from "vitest";
import { CollisionGroups, Group, cowCanContact } from "../src/game/physics/layers";

describe("children no-contact guarantee (mechanism 1: collision masks)", () => {
  it("cow filter mask excludes the CHILD group", () => {
    const cowFilter = CollisionGroups.cow & 0xffff;
    expect(cowFilter & Group.CHILD).toBe(0);
  });

  it("child filter mask excludes the COW group (symmetric)", () => {
    const childFilter = CollisionGroups.child & 0xffff;
    expect(childFilter & Group.COW).toBe(0);
  });

  it("cowCanContact(CHILD) is false", () => {
    expect(cowCanContact(Group.CHILD)).toBe(false);
  });

  it("cow still contacts smashables and the camel (sanity)", () => {
    expect(cowCanContact(Group.SMASHABLE)).toBe(true);
    expect(cowCanContact(Group.CAMEL)).toBe(true);
  });
});

// ---- mechanism #2: the flee brain (children always escape) ----
import { ChildBrain, FLEE_SPEED, SCARE_RADIUS } from "../src/game/systems/children";

describe("children no-contact guarantee (mechanism 2: flee brain)", () => {
  it("flee speed exceeds the cow's serene and irritated speeds", () => {
    // BASE_SPEED 9 * serene 0.8 = 7.2; * irritated 1.0 = 9.0
    expect(FLEE_SPEED).toBeGreaterThan(9.0);
  });

  it("a moving cow inside scare radius always triggers flight, directly away", () => {
    const c = new ChildBrain(1);
    const s = c.step(1 / 60, { x: 3, z: 0 }, { x: 0, z: 0 }, 5);
    expect(s.scared).toBe(true);
    expect(s.vx).toBeGreaterThan(0); // away on +x
    expect(Math.hypot(s.vx, s.vz)).toBeCloseTo(FLEE_SPEED, 3);
  });

  it("distance strictly increases while the cow pursues at irritated speed", () => {
    const c = new ChildBrain(2);
    let child = { x: SCARE_RADIUS - 1, z: 0 };
    let cow = { x: 0, z: 0 };
    let prev = Math.hypot(child.x - cow.x, child.z - cow.z);
    for (let i = 0; i < 240; i++) {
      const s = c.step(1 / 60, child, cow, 9);
      child = { x: child.x + s.vx / 60, z: child.z + s.vz / 60 };
      // cow chases directly at irritated speed
      const dx = child.x - cow.x;
      const dz = child.z - cow.z;
      const d = Math.hypot(dx, dz) || 1;
      cow = { x: cow.x + (dx / d) * (9 / 60), z: cow.z + (dz / d) * (9 / 60) };
      const now = Math.hypot(child.x - cow.x, child.z - cow.z);
      expect(now).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = now;
    }
  });

  it("scared fires exactly once per scare (edge, not level)", () => {
    const c = new ChildBrain(3);
    const first = c.step(1 / 60, { x: 2, z: 0 }, { x: 0, z: 0 }, 5);
    const second = c.step(1 / 60, { x: 2.2, z: 0 }, { x: 0, z: 0 }, 5);
    expect(first.scared).toBe(true);
    expect(second.scared).toBe(false);
  });
});
