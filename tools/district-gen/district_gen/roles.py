"""POI role classification.

Loads config/poi_roles.json and classifies an IR POI into a gameplay role +
name tier. Hybrid rule: POIs come from Overture; from OSM we take ONLY street
furniture (benches/bins/post boxes) so we don't double-place what Overture
already covers. Everything named-but-unmatched becomes named backdrop —
recognisability by default, never silently stripped.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

from .ir import Poi

_CONFIG_PATH = Path(__file__).resolve().parent.parent / "config" / "poi_roles.json"


@dataclass(frozen=True)
class Classification:
    role: str            # venue | zone | smashable | backdrop | ignore
    name_tier: str       # named_backdrop | partner_interactive | anonymous
    subtype: str | None  # beer_anchor | landmark | plaza | bench | ...
    gameplay: dict[str, Any]


@lru_cache(maxsize=1)
def load_config(path: str | None = None) -> dict[str, Any]:
    p = Path(path) if path else _CONFIG_PATH
    return json.loads(p.read_text())


def _build_index(cfg: dict[str, Any]) -> dict[tuple[str, str], Classification]:
    """Flatten the grouped config into a (provider, category) -> Classification map,
    and assert no category is claimed by two roles (validation)."""
    index: dict[tuple[str, str], Classification] = {}

    def claim(provider: str, cat: str, c: Classification) -> None:
        key = (provider, cat)
        if key in index:
            raise ValueError(f"category {provider}:{cat} claimed twice: "
                             f"{index[key].role} vs {c.role}")
        index[key] = c

    for subtype, spec in cfg["venue_categories"].items():
        gp = spec.get("gameplay", {})
        tier = spec["name_tier"]
        for cat in spec["overture"]:
            claim("overture", cat, Classification("venue", tier, subtype, gp))

    for subtype, spec in cfg["zone_categories"].items():
        gp = {"density_weight": spec.get("density_weight", 1.0)}
        for cat in spec["overture"]:
            claim("overture", cat, Classification("zone", "anonymous", subtype, gp))

    sf = cfg["smashable_street_furniture"]["categories"]
    for cat, spec in sf.items():
        claim("osm", cat, Classification("smashable", "anonymous", cat, dict(spec)))

    return index


@lru_cache(maxsize=1)
def _index() -> dict[tuple[str, str], Classification]:
    return _build_index(load_config())


def classify(poi: Poi) -> Classification:
    cfg = load_config()
    provider = poi.source_id.split(":", 1)[0]  # "osm" | "overture"
    hit = _index().get((provider, poi.kind))
    if hit is not None:
        return hit

    ignore = set(cfg["ignore_categories"].get("overture", []))
    if provider == "overture":
        if poi.kind in ignore:
            return Classification("ignore", "anonymous", None, {})
        if poi.name:  # named-but-unmatched -> recognisability backdrop
            d = cfg["backdrop_default"]
            return Classification(d["role"], d["name_tier"], "backdrop", {})
        return Classification("ignore", "anonymous", None, {})

    # OSM POIs that are not street furniture: Overture covers them -> drop (dedup).
    return Classification("ignore", "anonymous", None, {})


def validate_config(path: str | None = None) -> dict[str, int]:
    """Load + cross-check the config; returns bucket counts. Raises on overlap."""
    cfg = load_config(path)
    idx = _build_index(cfg)
    counts = {"venue": 0, "zone": 0, "smashable": 0}
    for c in idx.values():
        counts[c.role] += 1
    return counts