/** ADR-014 art direction: low-poly flat-shaded Mediterranean.
 * The world must be lovely — the comedy of destroying it depends on it. */
import * as THREE from "three";

export const PALETTE = {
  sky: 0x87ceeb,
  sea: 0x1a6f9e,
  ground: 0xd9c9a3,        // sun-bleached stone
  road: 0xb8a888,
  wallWhite: 0xf5f0e8,
  wallCream: 0xefe3c8,
  wallRose: 0xe8cfc0,
  roofTerracotta: 0xc4614a,
  roofOchre: 0xd08a3e,
  shutterCobalt: 0x2255a4,
  shutterTeal: 0x2e8b8b,
  doorGreen: 0x4a7c59,
  awningRed: 0xc0392b,
  awningStripe: 0xf5f0e8,
  crate: 0xa87c4f,
  stall: 0x8f6b43,
  palmTrunk: 0x8b6f47,
  palmFrond: 0x4a8c3f,
  cowWhite: 0xf7f3ee,
  cowPatch: 0x3a3a42,
  cowPink: 0xe8b4b8,
  camelSand: 0xc2a56b,
  camelDark: 0xa08453,
  beer: 0xf5a623,
  wine: 0x9013fe,
} as const;

/** Lambert = cheap soft shading; the low-poly look, mobile-friendly. */
export function flat(color: number): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color });
}
