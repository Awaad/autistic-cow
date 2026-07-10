/** Kyrenia Harbor district layout — MAP AS DATA.
 * Coordinates in scene meters. +z = toward the sea. This file is content:
 * a new district is a new file, not new code. Venue slugs match the DB seed. */
export interface BuildingSpec {
  x: number; z: number; w: number; d: number; h: number;
  wall: "wallWhite" | "wallCream" | "wallRose";
  roof: "roofTerracotta" | "roofOchre";
  awning?: boolean;
  venue?: string; // matches venues.slug for missions later
}

export interface Vec2 { x: number; z: number }

export const KYRENIA = {
  bounds: { halfW: 70, halfD: 70 },
  waterline: 42, // z beyond this is sea

  // the harbor crescent: two arms of buildings framing the waterfront
  buildings: [
    // west arm
    { x: -52, z: 28, w: 10, d: 8, h: 7, wall: "wallWhite", roof: "roofTerracotta", venue: "harbor-bar-west" },
    { x: -40, z: 30, w: 9, d: 7, h: 5.5, wall: "wallCream", roof: "roofOchre", awning: true },
    { x: -29, z: 32, w: 8, d: 7, h: 6.5, wall: "wallRose", roof: "roofTerracotta" },
    { x: -18, z: 33, w: 9, d: 6, h: 5, wall: "wallWhite", roof: "roofOchre", awning: true, venue: "meyhane" },
    // east arm
    { x: 18, z: 33, w: 9, d: 6, h: 6, wall: "wallCream", roof: "roofTerracotta", awning: true },
    { x: 29, z: 32, w: 8, d: 7, h: 5, wall: "wallWhite", roof: "roofOchre" },
    { x: 40, z: 30, w: 9, d: 7, h: 7, wall: "wallRose", roof: "roofTerracotta", venue: "harbor-bar-east" },
    { x: 52, z: 28, w: 10, d: 8, h: 5.5, wall: "wallWhite", roof: "roofOchre", awning: true },
    // back streets, two rows
    { x: -45, z: 8, w: 11, d: 9, h: 6, wall: "wallCream", roof: "roofTerracotta" },
    { x: -30, z: 5, w: 9, d: 8, h: 8, wall: "wallWhite", roof: "roofOchre" },
    { x: -14, z: 7, w: 10, d: 9, h: 5.5, wall: "wallRose", roof: "roofTerracotta", awning: true },
    { x: 14, z: 7, w: 10, d: 9, h: 6.5, wall: "wallWhite", roof: "roofTerracotta" },
    { x: 30, z: 5, w: 9, d: 8, h: 5, wall: "wallCream", roof: "roofOchre", awning: true },
    { x: 45, z: 8, w: 11, d: 9, h: 7, wall: "wallWhite", roof: "roofTerracotta" },
    { x: -38, z: -18, w: 12, d: 10, h: 6, wall: "wallRose", roof: "roofOchre" },
    { x: -18, z: -22, w: 10, d: 9, h: 7, wall: "wallWhite", roof: "roofTerracotta" },
    { x: 4, z: -20, w: 11, d: 10, h: 5.5, wall: "wallCream", roof: "roofTerracotta", venue: "old-town-cafe" },
    { x: 26, z: -22, w: 10, d: 9, h: 6.5, wall: "wallWhite", roof: "roofOchre" },
    { x: 44, z: -18, w: 12, d: 10, h: 5, wall: "wallRose", roof: "roofTerracotta" },
  ] as BuildingSpec[],

  // the market square: dense smashables between the arms (her buffet)
  marketBounds: { x0: -12, x1: 12, z0: 12, z1: 28 },
  stallCount: 10,
  crateCount: 26,
  scooterCount: 6,

  palms: [
    { x: -58, z: 38 }, { x: -22, z: 39 }, { x: 0, z: 40 }, { x: 22, z: 39 }, { x: 58, z: 38 },
    { x: -52, z: -30 }, { x: 52, z: -30 }, { x: 0, z: -34 },
  ] as Vec2[],

  beerSpots: [
    { x: -48, z: 22 }, { x: -20, z: 27 }, { x: 8, z: 20 }, { x: 34, z: 26 },
    { x: -8, z: -12 }, { x: 38, z: -10 },
  ] as Vec2[],

  // wine hides (one chosen per session by seed): behind, between, forgotten
  wineHides: [
    { x: -55, z: -35 }, { x: 58, z: 12 }, { x: 0, z: -28 }, { x: -33, z: 18 },
  ] as Vec2[],

  cowStart: { x: 0, z: -5 } as Vec2,
} as const;
