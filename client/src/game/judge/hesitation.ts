/** Hesitation detector — the richest signal in the game (GAME_LOOP).
 * Approached a rescueable, dwelled, left without acting. With ADR-012
 * controls this is physical: the player fought her toward it, held, yielded. */
export const NOTICE_RADIUS = 6;
export const LEAVE_RADIUS = 9;
export const DWELL_S = 0.8;

type Phase = "outside" | "near";

export class HesitationDetector {
  private phase: Phase = "outside";
  private dwell = 0;

  /** Call per frame per rescueable. Returns an event when one concludes. */
  step(dt: number, dist: number, rescuedNow: boolean): "hesitation" | "rescue_ignored" | null {
    if (rescuedNow) {
      this.phase = "outside";
      this.dwell = 0;
      return null;
    }
    if (this.phase === "outside") {
      if (dist < NOTICE_RADIUS) {
        this.phase = "near";
        this.dwell = 0;
      }
      return null;
    }
    // near
    this.dwell += dt;
    if (dist > LEAVE_RADIUS) {
      const verdict = this.dwell >= DWELL_S ? "hesitation" : "rescue_ignored";
      this.phase = "outside";
      this.dwell = 0;
      return verdict;
    }
    return null;
  }
}
