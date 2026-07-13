# ADR-018: Tiered name & detail policy (amends ADR-016 §4)
**Status:** accepted
**Context:** ADR-016 §4 said "strip business names by default; names appear only
for partner venues." Real extract data (578 OSM buildings, 639 Overture POIs for
the Kyrenia bbox) plus recognisability requirement(we don't need a generic map) showed the binary
rule is too blunt. North Cyprus is small: quarters are colloquially named after
the off-licence or the insurance office on the corner. Stripping those makes the
map read as Generic Mediterranean Town, defeating the point of real data. AR mode
(on the roadmap) raises the stakes — AR overlays anchor onto real, recognisable
premises, so the named layer is future AR infrastructure, not just flavour.
A key engine fact makes generosity safe: **buildings are unsmashable terrain**
(scenes/kyrenia.ts — static colliders; only crates/stalls/scooters/street
furniture smash). A named building is backdrop, never a "brand being destroyed."
**Decision:** Replace the binary rule with three name tiers, decoupling *ambient
recognisability* (free) from *interactive identity* (paid).
1. **Named backdrop (free, generous):** real names on the UNSMASHABLE
   backdrop/signage layer — landmarks, civic, religious, AND the local-anchor
   long tail (off-licence, insurance office, currency exchange, jewellers,
   barbers, pharmacies, estate agents). Signage is texture, not geometry:
   near-zero perf cost. This is the recognisability layer.
2. **Partner interactive (paid):** the INTERACTIVE identity stays partner-only —
   branded beer anchors, named mission venues, AR check-ins, branded drink
   animations. A non-partner bar shows its name on its sign (backdrop) but the
   beer you grab there is generic (−25), not a branded anchor. Sales pitch
   inverts cleanly: "your venue already appears named; upgrade to make it a live
   branded beer anchor / AR check-in."
3. **Anonymous:** smashables (street furniture, stalls, crates) carry no real
   name — this is the only layer where "named thing destroyed" could arise, and
   it stays unnamed by design.
**Hybrid sourcing (refines ADR-016):** building GEOMETRY from OSM (Overture's
696 buildings are re-exported OSM + heightless ML footprints — same 172 leveled
buildings to the digit — so they add ODbL-encumbered noise, not signal); POIs
from Overture (639 named vs 139, far richer categories); street-furniture
SMASHABLES from OSM (benches/bins/post boxes Overture lacks). All within
OSM+Overture — no Mapbox/Google.
**Detail vs perf (they are separate budgets):** recognisability lives in the
FREE budgets — merged/instanced facade meshes (ADR-014), texture signage, and
collider-free ambient props. The scarce budgets (≤350 static colliders, ≤250
dynamic bodies, ≤150 draw calls) are spent only on smashables and blocking
walls. So the allowlist can be generous without touching frame rate; the
collider pressure is solved by merging terraced buildings (one physics block,
many drawn facades), not by dropping detail.
**AR seam (design-for, don't build):** venue categories carry `ar_candidate`.
Per the schema invariant, `real_coords` are NOT emitted into the shipped
district for non-partner venues; instead the emit stage writes a separate,
non-shipped `ar-candidates.json` (candidate → coarse coord) so a venue can be
flipped to an AR partner later without regeneration.
**Config:** `tools/district-gen/config/poi_roles.json` is the authoritative
category → role → name-tier map; the gameplay + emit stages read it. Built
against the categories actually present in the Kyrenia extract; trimmable.
**Consequences:** ADR-016 §4's "strip by default" is superseded by "named
backdrop by default, interactive identity partner-only." Generated districts now
carry a name layer; the emit stage gates only the *interactive* name behind
partner status. **Open item (flagged, not resolved here):** displaying real
business names on backdrop is routine for maps and low-risk on a non-destroyed
layer, but warrants a legal review before ship — that review is not mine to make.
