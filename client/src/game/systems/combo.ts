/** Combo chain tracker — pure (4s window). */
import { tuning } from "../core/tuning";

export class ComboTracker {
  private count = 0;
  private lastSmashAt = -Infinity;

  /** Register a smash at time t (seconds). Returns current chain length. */
  smash(t: number): number {
    if (t - this.lastSmashAt > tuning.combo.chain_window_s) this.count = 0;
    this.count += 1;
    this.lastSmashAt = t;
    return this.count;
  }

  /** Multiplier: 1x, then +0.1 per chain step, capped 3x. */
  multiplier(t: number): number {
    if (t - this.lastSmashAt > tuning.combo.chain_window_s) return 1;
    return Math.min(3, 1 + (this.count - 1) * 0.1);
  }

  /** Chain breaks explicitly (e.g. fleeing the camel later). */
  break_(): void {
    this.count = 0;
    this.lastSmashAt = -Infinity;
  }

  get chain(): number {
    return this.count;
  }
}
