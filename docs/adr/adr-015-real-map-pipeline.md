# ADR-015: Real-map district pipeline
**Status:** accepted (spike scheduled Stage 4-adjacent)
**Context:** Real city geometry is wanted (identity, AR, expansion) but
streaming map tiles at runtime means foreign renderer, no physics, per-tile
pricing, and unauthored (flat) level design.
**Decision:** OSM/Overture feed an OFFLINE generation pipeline
(tools/district-gen): footprints -> low-poly buildings in our palette,
POI tags -> spawn rules + venue candidates, gameplay layer (beer routing,
wine hides, camel lanes) applied, designer curation pass, output = district
data file (kyrenia-harbor.ts shape) + DB rows. Cells of ~300-500m, bounded,
versioned. Provider mix: OSM/Overture for geometry; Mapbox/Google usable as
licensed DATA sources for places where their coverage wins — never the
renderer. Real business names appear ONLY as partner venues (sponsorship
inverted); non-partner names stripped in the pipeline.
**Consequences:** one runtime, seeded spawns / anti-cheat / challenges keep
working; per-district cost becomes generation + curation. ODbL compliance
(attribution; share-alike scoped to derived geometry data, gameplay layer
stays ours). Future: consent-gated community mapping ("help map North
Cyprus") — new consent key `community_mapping`, player-contributed corrections
flow back to OSM under their account or ours. Spike: extrude Kyrenia harbor
bbox, diff against the hand-authored district; the delta measures curation cost.
