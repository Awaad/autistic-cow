import { describe, expect, it } from "vitest";
import { ComboTracker } from "../src/game/systems/combo";

describe("combo chains (4s window)", () => {
  it("chains within the window, resets outside it", () => {
    const c = new ComboTracker();
    expect(c.smash(0)).toBe(1);
    expect(c.smash(2)).toBe(2);
    expect(c.smash(3.9)).toBe(3);
    expect(c.smash(9)).toBe(1); // window blown
  });

  it("multiplier grows and caps at 3x", () => {
    const c = new ComboTracker();
    for (let i = 0; i < 40; i++) c.smash(i * 0.1);
    expect(c.multiplier(4)).toBe(3);
  });

  it("explicit break resets the chain", () => {
    const c = new ComboTracker();
    c.smash(0); c.smash(1);
    c.break_();
    expect(c.smash(1.5)).toBe(1);
  });
});
