import { describe, expect, it } from "vitest";
import { bandOf, bandParams } from "../src/game/core/bands";

describe("rage bands", () => {
  it("maps boundaries per tuning.json", () => {
    expect(bandOf(0)).toBe("serene");
    expect(bandOf(19)).toBe("serene");
    expect(bandOf(20)).toBe("irritated");
    expect(bandOf(50)).toBe("furious");
    expect(bandOf(80)).toBe("berserk");
    expect(bandOf(100)).toBe("berserk");
  });

  it("only furious+ bands drift", () => {
    expect(bandParams("serene").drift).toBe(0);
    expect(bandParams("irritated").drift).toBe(0);
    expect(bandParams("furious").drift).toBeGreaterThan(0);
    expect(bandParams("berserk").drift).toBeGreaterThan(bandParams("furious").drift);
  });
});
