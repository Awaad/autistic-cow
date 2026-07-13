# ADR-016: Map data licensing & provider choice
**Status:** accepted
**Context:** The generation pipeline (ADR-015) needs real geometry for the
Kyrenia harbor bbox. Two geometry providers exist with different licenses, and
POI enrichment tempts a third class of source whose ToS restricts derived-data
storage. TRNC OSM coverage is unverified — the provider recommendation is a
measurement, not an opinion, and cannot be asserted before the coverage report.
**Decision:**
1. **Geometry providers:** evaluate OpenStreetMap (Overpass/extract) AND
   Overture in parallel for the same bbox; the coverage report decides the
   per-cell default. Bias: Overture where coverage ties, because its
   CDLA-Permissive-2.0 carries no share-alike; OSM where its TRNC density wins.
2. **Licensing → file separation** (the mechanism that keeps share-alike
   contained): the emit stage splits every generated district into
   - `*-gen.geom.ts` — derived GEOMETRY (buildings, palms, bounds). If sourced
     from OSM this is ODbL-encumbered; an attribution block is emitted with it.
   - `*-gen.play.ts` — the GAMEPLAY layer (density zones, beerSpots, wineHides,
     rescueSpots, childZones, cowStart). Ours. Authored, not derived. Never
     share-alike.
   - `*-gen.ts` — a thin index that merges the two into the `KYRENIA`-shaped
     export the scene builder consumes. Split is invisible at runtime.
3. **POI enrichment (Mapbox/Google):** permitted ONLY as licensed *data* for
   POI signals where their coverage beats OSM/Overture — NEVER as renderer,
   NEVER persisted beyond what each provider's ToS allows. Default OFF; enabling
   a provider requires a per-provider ToS review recorded here first.
4. **Business names:** stripped by default in the pipeline. A real name reaches
   the output ONLY as a partner venue (sponsorship model inverted, ADR-015).
   Generated buildings are anonymous.
   **[AMENDED BY ADR-018:** the strip-by-default rule proved too blunt against
   real data + the recognisability requirement. Superseded by a tiered policy:
   named backdrop by default (unsmashable signage), interactive identity
   partner-only. See ADR-018.**]**
5. **Attribution:** ODbL requires it; the emitter writes an attribution block
   into `*-gen.geom.ts` and a repo-level `NOTICE` entry per district. Overture
   attribution recorded likewise where used.
6. **Community mapping seam (design-for, don't build):** a future
   `community_mapping` consent key (ADR-015) lets player corrections flow back
   to OSM. Leave the seam in the IR provenance (`source_id` carries provider +
   id); no implementation this spike.
**Consequences:** every generated district ships as three files, not one;
share-alike obligation is bounded to the geometry file and never touches our
gameplay design; provider choice becomes a recorded per-cell decision in the
district `meta`; any PR persisting Mapbox/Google raw data without a ToS note
in this ADR violates it by definition.
