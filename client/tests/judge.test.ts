import { describe, expect, it } from "vitest";
import { HesitationDetector } from "../src/game/judge/hesitation";
import { JudgeLog } from "../src/game/judge/log";
import { CommentEngine } from "../src/game/judge/engine";

describe("hesitation detector", () => {
  it("dwell then leave = hesitation; drive-by = rescue_ignored", () => {
    const a = new HesitationDetector();
    a.step(0.5, 5, false);   // enters (entry step sets phase, no dwell yet)
    a.step(0.5, 5, false);   // dwelling
    a.step(0.5, 5, false);   // dwelling past threshold
    expect(a.step(0.1, 10, false)).toBe("hesitation");

    const b = new HesitationDetector();
    b.step(0.2, 5, false);   // brushed past
    expect(b.step(0.1, 10, false)).toBe("rescue_ignored");
  });

  it("a rescue closes the episode with no verdict", () => {
    const d = new HesitationDetector();
    d.step(1, 5, false);
    expect(d.step(0.1, 5, true)).toBeNull();
    expect(d.step(0.1, 10, false)).toBeNull(); // fresh episode, nothing owed
  });
});

describe("judge log axis (mirrors server axis.py)", () => {
  it("menace run goes negative, saint run positive, always clamped", () => {
    const m = new JudgeLog();
    for (let i = 0; i < 30; i++) m.add("child_scared", 80, i);
    expect(m.axis()).toBeLessThan(0);
    expect(m.axis()).toBeGreaterThanOrEqual(-1);

    const s = new JudgeLog();
    for (let i = 0; i < 30; i++) s.add("child_helped", 10, i);
    expect(s.axis()).toBeGreaterThan(0);
    expect(s.axis()).toBeLessThanOrEqual(1);
  });
});

describe("comment engine serving rules", () => {
  it("respects the 90s cap", () => {
    const e = new CommentEngine();
    const first = e.serve("hesitation", "flexible", 100);
    expect(first).not.toBeNull();
    expect(e.serve("hesitation", "flexible", 150)).toBeNull(); // 50s later: silent
    expect(e.serve("hesitation", "flexible", 191)).not.toBeNull();
  });

  it("never repeats within the window", () => {
    const e = new CommentEngine();
    const seen = new Set<string>();
    let t = 0;
    for (let i = 0; i < 4; i++) {
      const line = e.serve("hesitation", "flexible", t);
      if (line) {
        expect(seen.has(line)).toBe(false);
        seen.add(line);
      }
      t += 100;
    }
  });

  it("stays silent when no line matches", () => {
    const e = new CommentEngine();
    expect(e.serve("nonexistent_trigger", "flexible", 100)).toBeNull();
  });
});
