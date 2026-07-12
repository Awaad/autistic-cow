"""Report stage.

Reads the normalized IR (produced by extract) and distills it into a small
`report.json` — counts, tag coverage, a few sample features, and an OSM-vs-
Overture comparison. 

Also produces deliverable #1: OSM vs Overture coverage for the
Kyrenia bbox, with a data-driven recommendation signal (ADR-016: a
recommendation is a measurement, not an opinion).
"""
from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any

from .ir import Building, DistrictIR, Poi, Road

_SAMPLE_N = 3


def _pct(n: int, d: int) -> float:
    return round(100.0 * n / d, 1) if d else 0.0


def _sample_building(b: Building) -> dict[str, Any]:
    return {
        "source_id": b.source_id,
        "levels": b.levels,
        "footprint_vertices": len(b.footprint),
        "first_two_coords": b.footprint[:2],
        "tag_keys": sorted(b.tags.keys()),
    }


def _sample_road(r: Road) -> dict[str, Any]:
    return {"source_id": r.source_id, "kind": r.kind, "highway": r.highway,
            "vertices": len(r.line), "tag_keys": sorted(r.tags.keys())}


def _sample_poi(p: Poi) -> dict[str, Any]:
    return {"source_id": p.source_id, "kind": p.kind,
            "has_name": p.name is not None, "tag_keys": sorted(p.tags.keys())}


def summarize(ir: DistrictIR, raw_bytes: int | None) -> dict[str, Any]:
    b_with_levels = sum(1 for b in ir.buildings if b.levels is not None)
    levels_vals = [b.levels for b in ir.buildings if b.levels is not None]
    poi_named = sum(1 for p in ir.pois if p.name)
    return {
        "raw_bytes": raw_bytes,
        "counts": ir.counts(),
        "buildings": {
            "with_levels": b_with_levels,
            "levels_coverage_pct": _pct(b_with_levels, len(ir.buildings)),
            "avg_levels": round(sum(levels_vals) / len(levels_vals), 2) if levels_vals else None,
            "min_vertices": min((len(b.footprint) for b in ir.buildings), default=0),
            "max_vertices": max((len(b.footprint) for b in ir.buildings), default=0),
        },
        "roads": dict(Counter(r.kind for r in ir.roads)),
        "pois": {
            "by_kind": dict(Counter(p.kind for p in ir.pois)),
            "named": poi_named,
            "named_pct": _pct(poi_named, len(ir.pois)),
        },
        "samples": {
            "buildings": [_sample_building(b) for b in ir.buildings[:_SAMPLE_N]],
            "roads": [_sample_road(r) for r in ir.roads[:_SAMPLE_N]],
            "pois": [_sample_poi(p) for p in ir.pois[:_SAMPLE_N]],
        },
    }


def _raw_size(out_dir: Path, provider: str) -> int | None:
    hits = sorted((out_dir / "cache" / "raw").glob(f"{provider}-*.json"))
    return sum(p.stat().st_size for p in hits) or None


def recommend(per_provider: dict[str, dict[str, Any]]) -> dict[str, Any]:
    """A signal, not a verdict. More buildings + richer levels/names = stronger
    geometry for our purposes. The owner makes the call (ADR-016)."""
    if len(per_provider) < 2:
        only = next(iter(per_provider), None)
        return {"default": only, "reason": "only one provider extracted"}
    osm, ov = per_provider.get("osm", {}), per_provider.get("overture", {})
    osm_b = osm.get("counts", {}).get("buildings", 0)
    ov_b = ov.get("counts", {}).get("buildings", 0)
    osm_lv = osm.get("buildings", {}).get("levels_coverage_pct", 0.0)
    ov_lv = ov.get("buildings", {}).get("levels_coverage_pct", 0.0)
    default = "osm" if (osm_b, osm_lv) >= (ov_b, ov_lv) else "overture"
    return {
        "default": default,
        "reason": (f"buildings osm={osm_b} vs overture={ov_b}; "
                   f"levels-coverage osm={osm_lv}% vs overture={ov_lv}%"),
        "note": "share-alike favors overture on ties (ADR-016); confirm before locking.",
    }


def build_report(out_dir: Path) -> dict[str, Any]:
    per_provider: dict[str, dict[str, Any]] = {}
    for provider in ("osm", "overture"):
        p = out_dir / "ir" / f"{provider}.json"
        if not p.exists():
            continue
        ir = DistrictIR.from_dict(json.loads(p.read_text()))
        per_provider[provider] = summarize(ir, _raw_size(out_dir, provider))
    return {
        "bbox": (per_provider and next(iter(
            json.loads((out_dir / "ir" / f"{k}.json").read_text())["bbox"]
            for k in per_provider))) or None,
        "providers": per_provider,
        "coverage_recommendation": recommend(per_provider),
    }