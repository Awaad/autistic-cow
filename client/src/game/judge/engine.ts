/** Comment serving — GAME_LOOP: max one per 90s, no-repeat window,
 * weighted random among candidates. Scarcity = weight. */
import { tuning } from "../core/tuning";
import { COMMENTS_EN, type CommentLine } from "./comments-en";

const NO_REPEAT_WINDOW = 10;

export class CommentEngine {
  private lastServedAt = -Infinity;
  private served: string[] = [];
  constructor(private pool: CommentLine[] = COMMENTS_EN) {}

  /** Try to serve for a trigger at time t (seconds). Null = stays silent. */
  serve(trigger: string, band: string, t: number): string | null {
    if (t - this.lastServedAt < tuning.judge.comment_min_interval_s) return null;
    const recent = new Set(this.served.slice(-NO_REPEAT_WINDOW));
    const candidates = this.pool.filter(
      (c) => c.trigger === trigger && (c.band === "any" || c.band === band) && !recent.has(c.id),
    );
    if (candidates.length === 0) return null;
    let total = 0;
    for (const c of candidates) total += c.weight ?? 1;
    let r = Math.random() * total;
    let pick = candidates[candidates.length - 1];
    for (const c of candidates) {
      r -= c.weight ?? 1;
      if (r <= 0) { pick = c; break; }
    }
    this.lastServedAt = t;
    this.served.push(pick.id);
    return pick.text;
  }
}
