# ADR-017: district-gen is Python; the TS emitter is a thin dependency-free tail
**Status:** accepted
**Context:** The pipeline's hard part is geometry: footprint polygons →
convex-ish low-poly rectangles/L-shapes, grid snapping, WGS84 → scene-meter
projection (Cyprus = UTM 36N / EPSG:32636), plaza detection, and Overture
ingestion (GeoParquet via DuckDB). Its output is a TypeScript file matching an
existing TS interface, and determinism (same seed → byte-identical file) is a
hard acceptance criterion.
**Decision:** Build `tools/district-gen/` in **Python**.
- Geometry: `shapely` (fitting/simplification), `pyproj` (UTM 36N projection).
  These arrive with the simplify stage, not before.
- Extract: stdlib `urllib` for Overpass (zero third-party deps); the
  `overturemaps` CLI as an optional extra for Overture.
- The ONLY TS-aware component is a **thin emitter**: deterministic string
  templating with sorted keys, fixed float precision (metres at `%.3f`),
  `LC_ALL=C`, and no reliance on dict iteration order. It does not need a TS
  toolchain; it writes text that `tsc` in the client then type-checks against
  the real interface.
- Deps live in `tools/district-gen/pyproject.toml`; the **client gains
  nothing** (Repo Law 1 "no react in game" and Law 2 "contracts from codegen"
  are untouched — this is a build tool, not runtime).
**Why not pure TS/Node:** turf.js exists, but the polygon-fitting + projection
+ Overture/DuckDB story is materially weaker and would pull heavier, less
mature deps for the exact work Python does best. The one place TS strength
matters — knowing the output shape — is a trivial string template either way.
**Consequences:** contributors to the pipeline need Python 3.14 + the tool's
venv; CI runs the tool's `pytest` as a separate job from the client's vitest;
determinism is the emitter's responsibility and is covered by a
byte-identical-output test at the emit commit.
