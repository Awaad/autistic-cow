/** Asset manifest —  binaries live on CDN,
 * the repo holds keys. Empty url = procedural fallback builds it in code.
 * Replacing grey/procedural art with commissioned GLTF = editing this file. */
export interface AssetEntry {
  url: string; // empty -> use procedural fallback
  scale?: number;
}

export const MANIFEST: Record<string, AssetEntry> = {
  cow: { url: "" },
  camel: { url: "" },
  building_a: { url: "" },
  market_stall: { url: "" },
  crate: { url: "" },
  palm: { url: "" },
  beer: { url: "" },
  wine: { url: "" },
};
