/** The Judge's local log — client mirror of judge_events.
 * Stage 3 syncs this through the batcher; today it feeds the comment engine
 * and the local moral axis. Append-only, like its server twin (ADR-004). */
import { tuning } from "../core/tuning";

export type JudgeEventType =
  | "rescue_completed" | "rescue_ignored" | "child_scared" | "child_helped"
  | "destruction_spree" | "photo_calm_used" | "cameld" | "lure_executed"
  | "wine_found" | "hesitation" | "mission_completed" | "mission_abandoned";

export interface JudgeEntry {
  type: JudgeEventType;
  rage: number;
  t: number;
}

export class JudgeLog {
  readonly entries: JudgeEntry[] = [];
  private counts = new Map<JudgeEventType, number>();

  add(type: JudgeEventType, rage: number, t: number): number {
    this.entries.push({ type, rage, t });
    const n = (this.counts.get(type) ?? 0) + 1;
    this.counts.set(type, n);
    return n; // occurrence count -> lets triggers like child_scared_x3 fire
  }

  count(type: JudgeEventType): number {
    return this.counts.get(type) ?? 0;
  }

  /** Local moral axis — same weights, same clamp as server axis.py. */
  axis(): number {
    const w = tuning.judge.karma_weights as Record<string, number>;
    let v = 0;
    for (const e of this.entries) v += w[e.type] ?? 0;
    return Math.max(-1, Math.min(1, v));
  }

  band(): "menace" | "enthusiast" | "flexible" | "hero" | "whisperer" {
    const a = this.axis();
    if (a < -0.6) return "menace";
    if (a < -0.2) return "enthusiast";
    if (a < 0.2) return "flexible";
    if (a < 0.6) return "hero";
    return "whisperer";
  }
}
