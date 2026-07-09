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
