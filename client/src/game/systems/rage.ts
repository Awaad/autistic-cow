/** Rage meter — 01_GAME_LOOP Passive climb + collision spikes + sinks.
 * Max-rage resolution is Stage 2; here hitting 100 just pins (still scary). */
import { tuning } from "../core/tuning";
import { bandOf } from "../core/bands";
import { bus, type RageBand } from "../core/bus";

export class RageMeter {
  private value = 20; // start Irritated — the default play band
  private lastBand: RageBand = "irritated";
  private climbAccum = 0;

  tick(dt: number): void {
    this.climbAccum += dt;
    while (this.climbAccum >= 4) {
      this.climbAccum -= 4;
      this.add(tuning.rage.passive_climb_per_4s);
    }
  }

  add(delta: number): void {
    this.value = Math.max(0, Math.min(100, this.value + delta));
    const band = bandOf(this.value);
    bus.emit({ type: "rageChanged", value: this.value, band });
    this.lastBand = band;
  }

  sink(key: keyof typeof tuning.rage.sinks): void {
    const d = tuning.rage.sinks[key];
    if (typeof d === "number") this.add(d);
  }

  /** Hard set (max-rage resolution outcomes: photo -> 0, dazed respawn -> 40). */
  setTo(v: number): void {
    this.value = Math.max(0, Math.min(100, v));
    this.add(0); // reuse clamp+emit path
  }

  get rage(): number {
    return this.value;
  }

  get band(): RageBand {
    return this.lastBand;
  }
}
