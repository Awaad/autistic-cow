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

from .project import ProjectedIR

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


# union-find for terrace grouping

class _DSU:
    def __init__(self, n: int) -> None:
        self.p = list(range(n))

    def find(self, i: int) -> int:
        while self.p[i] != i:
            self.p[i] = self.p[self.p[i]]
            i = self.p[i]
        return i

    def union(self, i: int, j: int) -> None:
        ri, rj = self.find(i), self.find(j)
        if ri != rj:
            self.p[max(ri, rj)] = min(ri, rj)


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
    min_fp = cfg["min_footprint_m"]
    walls = cfg["palette"]["wall"]
    roofs = cfg["palette"]["roof"]

    boxes = [_aabb(b.footprint) for b in pir.buildings]
    dsu = _DSU(len(boxes))
    # deterministic O(n^2) adjacency; fine at cell scale (~hundreds). Sorted IR
    # order makes union outcomes order-independent.
    for i in range(len(boxes)):
        for j in range(i + 1, len(boxes)):
            if _boxes_touch(boxes[i], boxes[j], margin):
                dsu.union(i, j)

    groups: dict[int, list[int]] = {}
    for i in range(len(boxes)):
        groups.setdefault(dsu.find(i), []).append(i)

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