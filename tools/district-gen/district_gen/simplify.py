"""Simplify stage.

Projected footprints -> `BuildingSpec` boxes (the exact shape of
client/src/game/assets/kyrenia-harbor.ts). Two jobs:

1. Reduce each footprint to an axis-aligned box (x,z centre + w,d), height from
   `building:levels` else a seeded default, palette (wall/roof/awning) seeded
   from a stable hash so regeneration is byte-identical.
2. **Terrace merge:** footprints that share (or nearly share) a wall fuse into
   ONE box -> one collider. This is how an old town's 578 buildings come under
   the ≤350 static-collider budget (ADR-018) — the primary budget lever.

The output box is the existing spec, unchanged, so a generated district loads in
the engine by swapping one import. Oriented boxes / L-shapes would need a spec
field + scene-builder change -> a future ADR, deliberately out of scope here.
Venue slugs are NOT assigned here (that's the gameplay stage, matching POIs).
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

from .project import XZ, PBuilding, ProjectedIR

_CONFIG_PATH = Path(__file__).resolve().parent.parent / "config" / "generation.json"
_MM = 3


@lru_cache(maxsize=1)
def load_gen_config(path: str | None = None) -> dict[str, Any]:
    p = Path(path) if path else _CONFIG_PATH
    return json.loads(p.read_text())["simplify"]


@dataclass(frozen=True)
class SimplifiedBuilding:
    x: float
    z: float
    w: float
    d: float
    h: float
    wall: str
    roof: str
    awning: bool
    members: tuple[str, ...]  # provenance; stripped by the emitter

    def to_spec(self) -> dict[str, Any]:
        """Exactly BuildingSpec — no provenance leaks into the shipped file."""
        spec: dict[str, Any] = {
            "x": self.x, "z": self.z, "w": self.w, "d": self.d, "h": self.h,
            "wall": self.wall, "roof": self.roof,
        }
        if self.awning:
            spec["awning"] = True
        return spec


# axis-aligned bounds 

def _aabb(footprint: list[list[float]]) -> tuple[float, float, float, float]:
    xs = [p[0] for p in footprint]
    zs = [p[1] for p in footprint]
    return (min(xs), min(zs), max(xs), max(zs))


def _boxes_touch(a: tuple[float, float, float, float],
                 b: tuple[float, float, float, float], margin: float) -> bool:
    return (a[0] - margin <= b[2] and a[2] + margin >= b[0]
            and a[1] - margin <= b[3] and a[3] + margin >= b[1])


# stable seeded pseudo-randomness

def _unit(*parts: str) -> float:
    h = hashlib.sha256("|".join(parts).encode()).digest()
    return int.from_bytes(h[:8], "big") / 2 ** 64


# terrace grouping via size-capped merge (see simplify())


def _height(levels_present: list[int], seed: str, cfg: dict[str, Any]) -> float:
    storey = cfg["storey_height_m"]
    if levels_present:
        h = max(levels_present) * storey
    else:
        lo, hi = cfg["default_levels"]["min"], cfg["default_levels"]["max"]
        lvl = lo + int(_unit(seed, "levels") * (hi - lo + 1))
        h = lvl * storey
    clamp = cfg["height_clamp_m"]
    return round(min(max(h, clamp["min"]), clamp["max"]), _MM)


def simplify(pir: ProjectedIR, gen_config_path: str | None = None) -> list[SimplifiedBuilding]:
    cfg = load_gen_config(gen_config_path)
    margin = cfg["merge_margin_m"]
    max_span = cfg.get("max_merge_span_m", 45.0)
    min_fp = cfg["min_footprint_m"]
    walls = cfg["palette"]["wall"]
    roofs = cfg["palette"]["roof"]

    boxes = [_aabb(b.footprint) for b in pir.buildings]
    n = len(boxes)

    # Size-capped merge: fuse touching footprints, but NEVER let a fused box grow
    # past max_span in either axis — otherwise transitive chaining turns a whole
    # block into one map-covering slab. Deterministic: pairs processed in sorted order.
    parent = list(range(n))
    gbounds: dict[int, tuple[float, float, float, float]] = {i: boxes[i] for i in range(n)}

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def span_ok(bb: tuple[float, float, float, float]) -> bool:
        return (bb[2] - bb[0]) <= max_span and (bb[3] - bb[1]) <= max_span

    for i in range(n):
        for j in range(i + 1, n):
            if not _boxes_touch(boxes[i], boxes[j], margin):
                continue
            ri, rj = find(i), find(j)
            if ri == rj:
                continue
            a, b = gbounds[ri], gbounds[rj]
            merged = (min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3]))
            if not span_ok(merged):
                continue  # would grow too large — leave them separate
            keep, drop = (ri, rj) if ri < rj else (rj, ri)
            parent[drop] = keep
            gbounds[keep] = merged
            gbounds.pop(drop, None)

    groups: dict[int, list[int]] = {}
    for i in range(n):
        groups.setdefault(find(i), []).append(i)

    out: list[SimplifiedBuilding] = []
    for members_idx in groups.values():
        minx = min(boxes[i][0] for i in members_idx)
        minz = min(boxes[i][1] for i in members_idx)
        maxx = max(boxes[i][2] for i in members_idx)
        maxz = max(boxes[i][3] for i in members_idx)
        w = max(round(maxx - minx, _MM), min_fp)
        d = max(round(maxz - minz, _MM), min_fp)
        x = round((minx + maxx) / 2, _MM)
        z = round((minz + maxz) / 2, _MM)
        member_ids = tuple(sorted(pir.buildings[i].source_id for i in members_idx))
        seed = "|".join(member_ids)
        levels = [pir.buildings[i].levels for i in members_idx if pir.buildings[i].levels]
        h = _height(levels, seed, cfg)
        wall = walls[int(_unit(seed, "wall") * len(walls))]
        roof = roofs[int(_unit(seed, "roof") * len(roofs))]
        awning = _unit(seed, "awning") < cfg["awning_probability"]
        out.append(SimplifiedBuilding(x, z, w, d, h, wall, roof, awning, member_ids))

    # stable order: by the group's lowest source id
    out.sort(key=lambda b: b.members[0])
    return out


# draw layer: real footprints (extruded), separate from collider boxes

@dataclass(frozen=True)
class DrawBuilding:
    footprint: list[XZ]   # simplified real polygon [x,z] — the DRAWN silhouette
    h: float
    wall: str
    roof: str


def draw_buildings(pir: ProjectedIR, gen_config_path: str | None = None) -> list[DrawBuilding]:
    """Per-building simplified footprints for EXTRUSION (the recognisable
    silhouette). Colliders stay the merged boxes from simplify(); these are what
    the eye sees. Douglas-Peucker keeps them low-poly."""
    from shapely import Polygon
    cfg = load_gen_config(gen_config_path)
    walls = cfg["palette"]["wall"]
    roofs = cfg["palette"]["roof"]
    tol = cfg.get("footprint_simplify_m", 1.5)
    min_area = cfg.get("footprint_min_area_m2", 6.0)
    out: list[DrawBuilding] = []
    for b in pir.buildings:
        if len(b.footprint) < 3:
            continue
        try:
            poly = Polygon(b.footprint)
            if not poly.is_valid:
                poly = poly.buffer(0)
            if poly.is_empty or poly.area < min_area:
                continue
            simp = poly.simplify(tol, preserve_topology=True)
            coords = [[round(x, _MM), round(z, _MM)] for x, z in simp.exterior.coords][:-1]
        except Exception:
            continue
        if len(coords) < 3:
            continue
        seed = b.source_id
        levels = [b.levels] if b.levels else []
        h = _height(levels, seed, cfg)
        wall = walls[int(_unit(seed, "wall") * len(walls))]
        roof = roofs[int(_unit(seed, "roof") * len(roofs))]
        out.append(DrawBuilding(coords, h, wall, roof))
    out.sort(key=lambda b: (b.footprint[0][0], b.footprint[0][1]))
    return out


def union_buildings(osm: list[PBuilding], overture: list[PBuilding]) -> list[PBuilding]:
    """Hybrid density: keep every OSM building (tagged, has heights), then add
    Overture ML footprints that fill OSM's GAPS (centroid not inside any OSM
    footprint). This is how a partially-mapped TRNC old town gets fuller."""
    from shapely import Point, Polygon
    osm_polys = [Polygon(b.footprint) for b in osm if len(b.footprint) >= 3]
    kept = list(osm)
    for ob in overture:
        if len(ob.footprint) < 3:
            continue
        try:
            c = Polygon(ob.footprint).centroid
            if not any(op.contains(c) for op in osm_polys):
                kept.append(ob)
        except Exception:
            continue
    return sorted(kept, key=lambda b: b.source_id)
