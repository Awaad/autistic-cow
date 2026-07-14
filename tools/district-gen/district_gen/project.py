"""Projection stage.

Turns the WGS84 [lon,lat] IR into scene-metre coordinates the engine's data
shape expects: x = along-shore, z = toward the sea (+z seaward, matching the
hand-authored kyrenia-harbor.ts), y = height (set later by simplify).

Cyprus is UTM zone 36N (EPSG:32636). We project to true metres, recentre on the
bbox centre, then rotate so the seaward direction becomes +z. Real scale is
preserved (never distorted) — if a cell is too big for budget we CROP, we don't
shrink, so recognisability and future AR stay metrically honest.

Determinism: pyproj is deterministic for a pinned version; all coords are
rounded to millimetres; the IR is already source-id sorted.
"""
from __future__ import annotations

import json
import math
from dataclasses import asdict, dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

from .ir import DistrictIR

_MM = 3  # round metres to millimetres — exact enough, stable for byte-identical output

XZ = list[float]  # [x, z] scene metres


@lru_cache(maxsize=1)
def _transformer():
    from pyproj import Transformer  # imported here so `extract` stays dep-free
    return Transformer.from_crs("EPSG:4326", "EPSG:32636", always_xy=True)


def to_utm36n(lon: float, lat: float) -> tuple[float, float]:
    e, n = _transformer().transform(lon, lat)
    return e, n


@dataclass(frozen=True)
class PBuilding:
    source_id: str
    footprint: list[XZ]
    levels: int | None


@dataclass(frozen=True)
class PRoad:
    source_id: str
    line: list[XZ]
    kind: str


@dataclass(frozen=True)
class PPoi:
    source_id: str
    point: XZ
    kind: str
    name: str | None


@dataclass(frozen=True)
class PCoastline:
    source_id: str
    line: list[XZ]


@dataclass(frozen=True)
class PWater:
    source_id: str
    polygon: list[XZ]


@dataclass
class ProjectedIR:
    provider: str
    sea_bearing_deg: float
    bounds: dict[str, float]  # {halfW, halfD} scene metres
    buildings: list[PBuilding] = field(default_factory=list)
    roads: list[PRoad] = field(default_factory=list)
    pois: list[PPoi] = field(default_factory=list)
    coastlines: list[PCoastline] = field(default_factory=list)
    water: list[PWater] = field(default_factory=list)

    def counts(self) -> dict[str, int]:
        return {"buildings": len(self.buildings), "roads": len(self.roads),
                "pois": len(self.pois), "coastlines": len(self.coastlines),
                "water": len(self.water)}

    def to_dict(self) -> dict[str, Any]:
        return {
            "provider": self.provider,
            "sea_bearing_deg": self.sea_bearing_deg,
            "bounds": self.bounds,
            "buildings": [asdict(b) for b in self.buildings],
            "roads": [asdict(r) for r in self.roads],
            "pois": [asdict(p) for p in self.pois],
            "coastlines": [asdict(c) for c in self.coastlines],
            "water": [asdict(w) for w in self.water],
        }

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "ProjectedIR":
        return cls(
            provider=d["provider"],
            sea_bearing_deg=d["sea_bearing_deg"],
            bounds=d["bounds"],
            buildings=[PBuilding(**b) for b in d["buildings"]],
            roads=[PRoad(**r) for r in d["roads"]],
            pois=[PPoi(**p) for p in d["pois"]],
            coastlines=[PCoastline(**c) for c in d.get("coastlines", [])],
            water=[PWater(**w) for w in d.get("water", [])],
        )


def _rotate_to_sea(e: float, n: float, bearing_deg: float) -> XZ:
    """(east, north) metres -> (x, z) with +z along the seaward bearing.
    bearing is compass degrees toward the sea (0=N, 90=E)."""
    b = math.radians(bearing_deg)
    sb, cb = math.sin(b), math.cos(b)
    z = e * sb + n * cb          # component toward the sea
    x = e * cb - n * sb          # along-shore, right-handed
    return [round(x, _MM), round(z, _MM)]


def _centroid_xz(pts: list[XZ]) -> XZ:
    xs = sum(p[0] for p in pts) / len(pts)
    zs = sum(p[1] for p in pts) / len(pts)
    return [xs, zs]


def _inside(pt: XZ, half: float | None) -> bool:
    return half is None or (abs(pt[0]) <= half and abs(pt[1]) <= half)


def project_ir(
    ir: DistrictIR,
    *,
    sea_bearing_deg: float = 0.0,
    center_lonlat: tuple[float, float] | None = None,
    half_extent_m: float | None = None,
) -> ProjectedIR:
    # centre = bbox centre unless overridden. IR bbox is (south, west, north, east).
    if center_lonlat is None:
        s, w, nth, e = ir.bbox
        center_lonlat = ((w + e) / 2, (s + nth) / 2)
    ce, cn = to_utm36n(*center_lonlat)

    def px(coord: list[float]) -> XZ:
        e, n = to_utm36n(coord[0], coord[1])
        return _rotate_to_sea(e - ce, n - cn, sea_bearing_deg)

    out = ProjectedIR(provider=ir.provider, sea_bearing_deg=sea_bearing_deg, bounds={})

    for b in ir.buildings:
        fp = [px(c) for c in b.footprint]
        if _inside(_centroid_xz(fp), half_extent_m):
            out.buildings.append(PBuilding(b.source_id, fp, b.levels))
    for r in ir.roads:
        line = [px(c) for c in r.line]
        if any(_inside(p, half_extent_m) for p in line):
            out.roads.append(PRoad(r.source_id, line, r.kind))
    for p in ir.pois:
        pt = px(p.point)
        if _inside(pt, half_extent_m):
            out.pois.append(PPoi(p.source_id, pt, p.kind, p.name))
    for c in ir.coastlines:
        line = [px(pt) for pt in c.line]
        if any(_inside(p, half_extent_m) for p in line):
            out.coastlines.append(PCoastline(c.source_id, line))
    for w in ir.water:
        poly = [px(pt) for pt in w.polygon]
        if any(_inside(p, half_extent_m) for p in poly):
            out.water.append(PWater(w.source_id, poly))

    out.bounds = _compute_bounds(out, half_extent_m)
    return out


def _compute_bounds(pir: ProjectedIR, half_extent_m: float | None) -> dict[str, float]:
    if half_extent_m is not None:
        return {"halfW": round(half_extent_m, _MM), "halfD": round(half_extent_m, _MM)}
    xs: list[float] = []
    zs: list[float] = []
    for b in pir.buildings:
        for x, z in b.footprint:
            xs.append(x); zs.append(z)
    for r in pir.roads:
        for x, z in r.line:
            xs.append(x); zs.append(z)
    if not xs:
        return {"halfW": 0.0, "halfD": 0.0}
    return {
        "halfW": round(max(abs(min(xs)), abs(max(xs))), _MM),
        "halfD": round(max(abs(min(zs)), abs(max(zs))), _MM),
    }


def load_ir(path: Path) -> DistrictIR:
    return DistrictIR.from_dict(json.loads(path.read_text()))
