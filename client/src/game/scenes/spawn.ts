/** Deterministic spawn layout — pure function of (seed, template).
 * Same seed -> same district. */
import { seededRng } from "../core/rng";

export interface SpawnTemplate {
  smashables: number;
  beer: number;
  wine_chance: number;
}

export type SpawnKind = "smashable" | "beer" | "wine";

export interface SpawnPoint {
  kind: SpawnKind;
  x: number;
  z: number;
  /** smashable box scale (1..2.2); pickups ignore */
  s: number;
}

const FIELD = 60; // half-extent of the grey district in meters
const COW_CLEARING = 6; // nothing spawns on top of the player start

export function computeSpawns(seed: number, tpl: SpawnTemplate): SpawnPoint[] {
  const rng = seededRng(seed);
  const pts: SpawnPoint[] = [];
  const place = (kind: SpawnKind, s = 1): void => {
    let x = 0;
    let z = 0;
    do {
      x = (rng() * 2 - 1) * FIELD;
      z = (rng() * 2 - 1) * FIELD;
    } while (Math.hypot(x, z) < COW_CLEARING);
    pts.push({ kind, x, z, s });
  };

  for (let i = 0; i < tpl.smashables; i++) place("smashable", 1 + rng() * 1.2);
  for (let i = 0; i < tpl.beer; i++) place("beer");
  if (rng() < tpl.wine_chance) place("wine");
  return pts;
}
