/** art direction: low-poly flat-shaded Mediterranean.
 * The world must be lovely — the comedy of destroying it depends on it.
 * PALETTE v2 — "Kyrenia at 17:40". Single source of color .
 * Token NAMES are stable (the district generator seeds from them);
 * values are harmonized: warm sun-struck walls, deep-then-glassy sea,
 * terracotta pulled toward ember. New tokens are additive only. */
import * as THREE from "three";

export const PALETTE = {
  // atmosphere
  sky: 0xf4d9a8,          // late-afternoon amber sky (was cool blue)
  skyZenith: 0x9ec8e8,    // NEW: for gradient domes if a scene wants one
  ground: 0xcbb389,       // sun-warmed limestone
  road: 0xa08a66,         // NEW: street ribbons — darker, reads as travel
  sea: 0x2e6f8e,          // deep harbor water
  seaShallow: 0x4f9db4,   // NEW: near-shore band
  seaFoam: 0xd8ecec,      // NEW: quay edge line

  // architecture
  wallWhite: 0xf6efe2,    // warm white, not paper white
  wallCream: 0xecd9b0,
  wallRose: 0xdfae95,     // dusty terracotta-rose
  roofTerracotta: 0xb85c38, // ember terracotta
  roofOchre: 0xc98a4b,
  doorGreen: 0x4a6b52,    // cypress green
  shutterCobalt: 0x3e5f8a,
  shutterTeal: 0x4e8a86,
  awningRed: 0xc4553d,
  awningStripe: 0xe8d5b5,
  stone: 0xb5a888,        // NEW: castle/quay masonry

  // flora & props
  palmTrunk: 0x8a6f4d,
  palmFrond: 0x5f7d47,    // olive-green, not lime
  stall: 0x9a7b52,
  crate: 0xb08d5a,
  signWood: 0x7a5c3e,     // NEW

  // creatures
  cowHide: 0xf2ece0,      // NEW: warm ivory
  cowPatch: 0x5a4636,     // NEW: umber patches
  cowMuzzle: 0xd9a8a0,    // NEW
  hoof: 0x3a3230,         // NEW
  camelHide: 0xc9a06a,    // NEW (for the camel's pass, later)

  // pickups (emissive-friendly)
  beer: 0xf0b429,         // amber glow
  wine: 0x8e2f4f,         // deep claret
} as const;

/** Flat-shaded standard material — v2: slight roughness so the sun models
 * form; zero metalness always (this world has no chrome). */
export function flat(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color, flatShading: true, roughness: 0.9, metalness: 0,
  });
}