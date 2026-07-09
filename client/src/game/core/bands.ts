/** Rage band math — pure, tested. Single source: shared tuning. */
import { tuning } from "./tuning";
import type { RageBand } from "./bus";

export interface BandParams {
  speed: number;
  damage: number;
  drift: number;
}

export function bandOf(rage: number): RageBand {
  const b = tuning.rage.bands;
  if (rage <= b.serene.max) return "serene";
  if (rage <= b.irritated.max) return "irritated";
  if (rage <= b.furious.max) return "furious";
  return "berserk";
}

export function bandParams(band: RageBand): BandParams {
  const b = tuning.rage.bands[band] as { speed: number; damage: number; drift?: number };
  return { speed: b.speed, damage: b.damage, drift: b.drift ?? 0 };
}
