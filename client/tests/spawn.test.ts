import { describe, expect, it } from "vitest";
import { computeSpawns } from "../src/game/scenes/spawn";

const TPL = { smashables: 80, beer: 6, wine_chance: 0.33 };

describe("deterministic spawns (04_ARCHITECTURE §5.3)", () => {
  it("same seed -> identical layout", () => {
    expect(computeSpawns(1234, TPL)).toEqual(computeSpawns(1234, TPL));
  });

  it("different seed -> different layout", () => {
    expect(computeSpawns(1, TPL)).not.toEqual(computeSpawns(2, TPL));
  });

  it("respects template counts and the cow clearing", () => {
    const pts = computeSpawns(42, TPL);
    expect(pts.filter((p) => p.kind === "smashable")).toHaveLength(80);
    expect(pts.filter((p) => p.kind === "beer")).toHaveLength(6);
    for (const p of pts) expect(Math.hypot(p.x, p.z)).toBeGreaterThanOrEqual(6);
  });
});
