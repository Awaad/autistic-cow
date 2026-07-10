import { describe, expect, it } from "vitest";
import { MaxRageDirector } from "../src/game/systems/maxrage";

describe("max-rage resolution (01_GAME_LOOP §5)", () => {
  it("opens once at 100, not below", () => {
    const d = new MaxRageDirector();
    expect(d.maybeStart(99)).toBe(false);
    expect(d.maybeStart(100)).toBe(true);
    expect(d.maybeStart(100)).toBe(false); // fires once per crossing
  });

  it("timeout hands her to the camel", () => {
    const d = new MaxRageDirector();
    d.maybeStart(100);
    let out: string | null = null;
    for (let i = 0; i < 200 && !out; i++) out = d.tick(0.1);
    expect(out).toBe("timeout");
    expect(d.current).toBe("camel");
  });

  it("photo calms; refusal is the timeout road", () => {
    const a = new MaxRageDirector();
    a.maybeStart(100);
    a.calm();
    expect(a.current).toBe("calmed");

    const b = new MaxRageDirector();
    b.maybeStart(100);
    expect(b.refuse()).toBe("timeout");
    expect(b.current).toBe("camel");
  });

  it("reset re-arms for the next crossing", () => {
    const d = new MaxRageDirector();
    d.maybeStart(100);
    d.calm();
    d.reset();
    expect(d.maybeStart(100)).toBe(true);
  });
});
