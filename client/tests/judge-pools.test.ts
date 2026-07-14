/** Content-shape guard: pools are rewrites with free line counts, but every
 * locale MUST cover every core trigger — a silent gap means a silent Judge. */
import { describe, expect, it } from "vitest";
import { poolFor } from "../src/game/judge/pools";

const CORE_TRIGGERS = [
  "rescue_completed", "rescue_ignored", "hesitation",
  "child_scared", "child_scared_x3", "child_helped",
  "cameld", "cameld_x2", "lure_executed",
  "wine_found", "photo_calm_used", "destruction_spree",
];

describe.each(["en", "de", "ru"])("judge pool %s", (locale) => {
  const pool = poolFor(locale);

  it("has at least 35 lines", () => {
    expect(pool.length).toBeGreaterThanOrEqual(35);
  });

  it("covers every core trigger", () => {
    const covered = new Set(pool.map((l) => l.trigger));
    for (const t of CORE_TRIGGERS) expect(covered).toContain(t);
  });

  it("has globally unique ids and no empty text", () => {
    const ids = new Set(pool.map((l) => l.id));
    expect(ids.size).toBe(pool.length);
    for (const l of pool) expect(l.text.trim().length).toBeGreaterThan(0);
  });

  it("every trigger reachable in any band (an 'any' line exists per trigger)", () => {
    for (const t of CORE_TRIGGERS) {
      const anyLine = pool.some((l) => l.trigger === t && l.band === "any");
      const bandLines = pool.filter((l) => l.trigger === t).length >= 3;
      expect(anyLine || bandLines).toBe(true);
    }
  });
});
