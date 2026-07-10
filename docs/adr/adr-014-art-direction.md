# ADR-014: Low-poly flat-shaded Mediterranean
**Status:** accepted
**Context:** Grey boxes proved the loop; the game needs to look like a place
worth destroying. Full realistic art is slow, heavy, and wrong for the tone.
**Decision:** Low-poly, flat-shaded (Lambert), warm Kyrenia palette
(art/palette.ts is the single source). World must read as LOVELY — the comedy
of destruction depends on it. Procedural code-built models now; commissioned
GLTF replaces them incrementally via assets/manifest.ts + gltf.ts fallback
loader (an art upgrade is a manifest edit, not a refactor). Map is data:
assets/kyrenia-harbor.ts — a new district is a new file (docs/02 map-as-content
made literal on the client).
**Consequences:** ships now, performs on mobile, style survives asset
replacement; greybox scene retained for physics testing.
