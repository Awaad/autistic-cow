import { describe, expect, it, vi } from "vitest";
import { MissionTracker } from "../src/game/systems/missions";

describe("mission tracker", () => {
  it("demolition: marked hits count, one unmarked hit resets", () => {
    const emit = vi.fn();
    const t = new MissionTracker(
      { mission_id: "m", mission_type: "controlled_demolition", config: { count: 3 } }, emit);
    t.markTargets([1, 2, 3, 4, 5]);
    expect(t.markedTargets.size).toBe(3);
    t.onSmash(1);
    t.onSmash(2);
    t.onSmash(99); // unmarked: the puzzle bites
    expect(emit).toHaveBeenLastCalledWith(expect.objectContaining({ reset: true, progress: 0 }));
    t.onSmash(3);
    expect(t.done).toBe(false); // count restarted; 3 was still marked -> 1/3
  });

  it("rescue chain completes at N", () => {
    const emit = vi.fn();
    const t = new MissionTracker(
      { mission_id: "m", mission_type: "rescue_chain", config: { count: 2 } }, emit);
    t.onRescue();
    t.onRescue();
    expect(t.done).toBe(true);
    expect(emit).toHaveBeenLastCalledWith(expect.objectContaining({ done: true }));
  });

  it("pilgrimage needs serene dwell inside radius; leaving resets", () => {
    const emit = vi.fn();
    const t = new MissionTracker(
      { mission_id: "m", mission_type: "bar_pilgrimage", config: { radius: 6, dwell_s: 1 } }, emit);
    t.onPosition(0.6, true, 4);
    t.onPosition(0.2, false, 4);  // rage crept up: reset
    t.onPosition(0.6, true, 4);
    t.onPosition(0.6, true, 4);
    expect(t.done).toBe(true);
  });

  it("wine hunt completes on pickup", () => {
    const emit = vi.fn();
    const t = new MissionTracker(
      { mission_id: "m", mission_type: "wine_hunt", config: {} }, emit);
    t.onWine();
    expect(t.done).toBe(true);
  });
});
