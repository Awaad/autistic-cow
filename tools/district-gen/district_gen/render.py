"""Top-down debug render (SVG).

The handoff's RULE 2 deliverable: a picture, not a diff. Draws the REAL layers —
sea (from coastline/water, not a faked waterline), roads at true widths, and
building FOOTPRINTS (real polygons, not boxes) — so the owner can see at a glance
whether the sea is where the sea is and the streets exist.

Sea is derived, not guessed: water polygons are sea; the coastline splits the
cell and the side without buildings is sea. If neither exists, the sea can't be
drawn and that goes in DEVIATIONS (RULE 1).
"""
from __future__ import annotations

import math
from typing import Any

from shapely import LineString, MultiPolygon, Point, Polygon, box
from shapely.geometry.base import BaseGeometry
from shapely.ops import unary_union, split

from .project import ProjectedIR

# palette (mirrors client art/palette.ts)
_SEA = "#1a6f9e"
_LAND = "#d9c9a3"
_ROAD = "#b8a888"
_BLD_FILL = "#efe3c8"
_BLD_STROKE = "#a98f6b"
_COAST = "#0d4a6b"
_LANDMARK = "#c4614a"

_ROAD_WIDTH = {"street": 7.0, "alley": 3.5}


def _flip(pts: list[list[float]]) -> list[tuple[float, float]]:
    """world (x, z) -> svg (x, -z) so seaward/+z is up."""
    return [(p[0], -p[1]) for p in pts]


def _path(pts: list[tuple[float, float]], close: bool = True) -> str:
    if not pts:
        return ""
    d = "M " + " L ".join(f"{x:.2f},{y:.2f}" for x, y in pts)
    return d + (" Z" if close else "")


def _geom_paths(geom: BaseGeometry) -> list[str]:
    polys: list[Polygon] = []
    if isinstance(geom, Polygon):
        polys = [geom]
    elif isinstance(geom, MultiPolygon):
        polys = list(geom.geoms)
    out = []
    for poly in polys:
        out.append(_path(_flip([[x, y] for x, y in poly.exterior.coords])))
    return out


def _building_centroids(pir: ProjectedIR) -> list[Point]:
    pts = []
    for b in pir.buildings:
        if b.footprint:
            cx = sum(p[0] for p in b.footprint) / len(b.footprint)
            cz = sum(p[1] for p in b.footprint) / len(b.footprint)
            pts.append(Point(cx, cz))
    return pts


def derive_sea(pir: ProjectedIR) -> tuple[BaseGeometry | None, list[str]]:
    """Return (sea_geometry_or_None, deviations)."""
    hw, hd = pir.bounds["halfW"], pir.bounds["halfD"]
    if hw <= 0 or hd <= 0:
        return None, ["bounds are zero — nothing to render"]
    bbox_poly = box(-hw, -hd, hw, hd)
    deviations: list[str] = []
    sea_parts: list[BaseGeometry] = []

    for w in pir.water:
        if len(w.polygon) >= 3:
            try:
                sea_parts.append(Polygon(w.polygon).intersection(bbox_poly))
            except Exception:
                deviations.append(f"water polygon {w.source_id} invalid — skipped")

    lines = [LineString(c.line) for c in pir.coastlines if len(c.line) >= 2]
    if lines:
        merged = unary_union(lines)
        try:
            pieces = split(bbox_poly, merged)
            centroids = _building_centroids(pir)
            geoms = list(getattr(pieces, "geoms", [pieces]))
            if len(geoms) == 1:
                deviations.append("coastline does not fully cross the cell — sea side "
                                  "approximated from water polygons only")
            for piece in geoms:
                if not any(piece.contains(pt) for pt in centroids):
                    sea_parts.append(piece)
        except Exception as e:  # noqa: BLE001
            deviations.append(f"coastline split failed ({e}) — using water polygons only")
    elif not pir.water:
        deviations.append("NO coastline and NO water in cell — sea NOT rendered "
                          "(widen bbox toward the shore, or set it in curation)")

    if not sea_parts:
        return None, deviations
    return unary_union(sea_parts), deviations


def suggest_sea_bearing(pir: ProjectedIR, sea: BaseGeometry | None) -> float | None:
    """Compass degrees from the land mass toward the sea (0=N, 90=E)."""
    if sea is None or sea.is_empty:
        return None
    cents = _building_centroids(pir)
    if not cents:
        return None
    lx = sum(p.x for p in cents) / len(cents)
    lz = sum(p.y for p in cents) / len(cents)
    sc = sea.centroid
    dx, dz = sc.x - lx, sc.y - lz
    # bearing where +z=N, +x=E : atan2(east, north)
    return round((math.degrees(math.atan2(dx, dz)) + 360) % 360, 1)


def geom_to_coords(geom: BaseGeometry | None) -> list[list[list[float]]]:
    """shapely Polygon/MultiPolygon -> list of exterior rings [[x,z],...]."""
    if geom is None or geom.is_empty:
        return []
    polys: list[Polygon] = []
    if isinstance(geom, Polygon):
        polys = [geom]
    elif isinstance(geom, MultiPolygon):
        polys = list(geom.geoms)
    return [[[round(x, 3), round(z, 3)] for x, z in p.exterior.coords][:-1] for p in polys]


ROAD_WIDTH = _ROAD_WIDTH  # public alias for the scene assembler


def build_debug_svg(pir: ProjectedIR) -> tuple[str, dict[str, Any]]:
    hw, hd = pir.bounds["halfW"], pir.bounds["halfD"]
    sea, deviations = derive_sea(pir)
    bearing = suggest_sea_bearing(pir, sea)

    W, H = 2 * hw, 2 * hd
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-hw:.1f} {-hd:.1f} {W:.1f} {H:.1f}" '
        f'width="900" height="{900 * H / W:.0f}">',
        f'<rect x="{-hw:.1f}" y="{-hd:.1f}" width="{W:.1f}" height="{H:.1f}" fill="{_LAND}"/>',
    ]
    if sea is not None:
        for d in _geom_paths(sea):
            parts.append(f'<path d="{d}" fill="{_SEA}" stroke="none"/>')

    for r in pir.roads:
        w = _ROAD_WIDTH.get(r.kind, 5.0)
        parts.append(f'<path d="{_path(_flip(r.line), close=False)}" stroke="{_ROAD}" '
                     f'stroke-width="{w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>')

    for b in pir.buildings:
        parts.append(f'<path d="{_path(_flip(b.footprint))}" fill="{_BLD_FILL}" '
                     f'stroke="{_BLD_STROKE}" stroke-width="0.5"/>')

    for c in pir.coastlines:
        parts.append(f'<path d="{_path(_flip(c.line), close=False)}" stroke="{_COAST}" '
                     f'stroke-width="1.5" fill="none"/>')

    for p in pir.pois:
        if p.kind in ("bar", "landmark", "castle", "marina") or (p.name and p.kind != "poi"):
            x, z = p.point
            parts.append(f'<circle cx="{x:.1f}" cy="{-z:.1f}" r="2.5" fill="{_LANDMARK}"/>')

    parts.append("</svg>")
    meta = {
        "counts": pir.counts(),
        "sea_rendered": sea is not None,
        "suggested_sea_bearing_deg": bearing,
        "deviations": deviations,
    }
    return "\n".join(parts), meta
