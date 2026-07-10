/** Max-rage resolution state — 01_GAME_LOOP. Pure countdown; boot owns
 * the consequences. The decision window: photo, refusal, or timeout. */

import { tuning } from "../core/tuning";

export type MaxRageState = "idle" | "waiting" | "calmed" | "camel";

export class MaxRageDirector {
  private state: MaxRageState = "idle";
  private t = 0;

  /** Returns true if this call opened the window (fires once per crossing). */
  maybeStart(rage: number): boolean {
    if (this.state !== "idle" || rage < 100) return false;
    this.state = "waiting";
    this.t = tuning.maxrage.decision_timer_s;
    return true;
  }

  tick(dt: number): "timeout" | null {
    if (this.state !== "waiting") return null;
    this.t -= dt;
    if (this.t <= 0) {
      this.state = "camel";
      return "timeout";
    }
    return null;
  }

  /** Photo accepted (any file; Later: pipeline verdict). */
  calm(): void {
    if (this.state === "waiting") this.state = "calmed";
  }

  /** Player refused — same road as timeout: she is on her own now. */
  refuse(): "timeout" | null {
    if (this.state !== "waiting") return null;
    this.state = "camel";
    return "timeout";
  }

  /** Consequences applied; ready for the next crossing. */
  reset(): void {
    this.state = "idle";
  }

  get remaining(): number {
    return Math.max(0, this.t);
  }

  get current(): MaxRageState {
    return this.state;
  }
}
