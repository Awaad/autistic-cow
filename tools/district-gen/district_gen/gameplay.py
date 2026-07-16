"""Gameplay layer.

Turns projected geometry + classified POIs into the playable parts of the
district (the `KYRENIA` data shape). This is the stage that makes it a GAME.

Order is dictated by ADR-019 (child safety): **children are placed FIRST**, then
camel approach lanes are routed CLEAR of every child zone + buffer, then
everything else. A district whose children are not provably clear of the camel
lanes does not ship — `validate_child_safety` is the hard gate.

Existing `KYRENIA` fields are filled (beerSpots, wineHides, rescueSpots,
childZones, cowStart, marketBounds, counts, palms, waterline). New concepts from
ADR-018 (venues+slugs, real-placed smashables, named backdrop, camel lanes,
density zones) are emitted as ADDITIVE OPTIONAL fields — the current scene
builder ignores them and still loads; the extended builder reads them later.

Repo Law 5: camel lanes are placed as unlabelled geometry only. They are never
named or explained here or anywhere downstream.
"""
from __future__ import annotations

import json
import math
import random
import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

from .project import PPoi, PRoad, ProjectedIR
from .roles import classify
from .simplify import SimplifiedBuilding

_CONFIG_PATH = Path(__file__).resolve().parent.parent / "config" / "generation.json"
_MM = 3


@lru_cache(maxsize=1)
def load_gameplay_config(path: str | None = None) -> dict[str, Any]:
    p = Path(path) if path else _CONFIG_PATH
    return json.loads(p.read_text())["gameplay"]


def _v(x: float, z: float) -> dict[str, float]:
    return {"x": round(x, _MM), "z": round(z, _MM)}


def _dist(ax: float, az: float, bx: float, bz: float) -> float:
    return math.hypot(ax - bx, az - bz)


def _point_seg_dist(px: float, pz: float, ax: float, az: float, bx: float, bz: float) -> float:
    dx, dz = bx - ax, bz - az
    if dx == 0 and dz == 0:
        return _dist(px, pz, ax, az)
    t = max(0.0, min(1.0, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)))
    return _dist(px, pz, ax + t * dx, az + t * dz)


# occupancy grid

class Grid:
    """Coarse occupancy grid over the district. A cell is 'occupied' if a building
    box covers it OR it is in the REAL sea (water polygons / coastline-derived).
    Water occupancy is why smashables, beer, children and cowStart stop landing in
    the harbour — the grid used to know only a faked waterline."""

    def __init__(self, half_w: float, half_d: float, waterline: float,
                 buildings: list[SimplifiedBuilding], cell: float,
                 sea: Any | None = None) -> None:
        self.cell = cell
        self.half_w = half_w
        self.half_d = half_d
        self.waterline = waterline
        self.cols = max(1, int(2 * half_w / cell))
        self.rows = max(1, int((waterline + half_d) / cell))
        self.z0 = -half_d
        self.occ = [[False] * self.cols for _ in range(self.rows)]
        for b in buildings:
            self._mark(b)
        if sea is not None and not sea.is_empty:
            # test the cell's AREA, not its centre: a centre-only test lets cells
            # straddling the shoreline through, and things land at the water's edge.
            from shapely import box as _box
            h = cell / 2.0
            for r in range(self.rows):
                for c in range(self.cols):
                    if self.occ[r][c]:
                        continue
                    x, z = self.center(r, c)
                    if sea.intersects(_box(x - h, z - h, x + h, z + h)):
                        self.occ[r][c] = True   # any water in the cell -> not ground

    def _col(self, x: float) -> int:
        return min(self.cols - 1, max(0, int((x + self.half_w) / self.cell)))

    def _row(self, z: float) -> int:
        return min(self.rows - 1, max(0, int((z - self.z0) / self.cell)))

    def _mark(self, b: SimplifiedBuilding) -> None:
        for r in range(self._row(b.z - b.d / 2), self._row(b.z + b.d / 2) + 1):
            for c in range(self._col(b.x - b.w / 2), self._col(b.x + b.w / 2) + 1):
                self.occ[r][c] = True

    def center(self, r: int, c: int) -> tuple[float, float]:
        return (-self.half_w + (c + 0.5) * self.cell, self.z0 + (r + 0.5) * self.cell)

    def is_free_world(self, x: float, z: float) -> bool:
        if not (-self.half_w <= x <= self.half_w and self.z0 <= z <= self.waterline):
            return False
        return not self.occ[self._row(z)][self._col(x)]

    def free_cells(self) -> list[tuple[float, float]]:
        out = []
        for r in range(self.rows):
            for c in range(self.cols):
                if not self.occ[r][c]:
                    x, z = self.center(r, c)
                    if z <= self.waterline:
                        out.append((round(x, _MM), round(z, _MM)))
        return out

    def occupied_neighbors(self, x: float, z: float) -> int:
        r, c = self._row(z), self._col(x)
        n = 0
        for dr in (-1, 0, 1):
            for dc in (-1, 0, 1):
                rr, cc = r + dr, c + dc
                if 0 <= rr < self.rows and 0 <= cc < self.cols and self.occ[rr][cc]:
                    n += 1
        return n

    def line_clear(self, ax: float, az: float, bx: float, bz: float, step: float | None = None) -> bool:
        step = step or self.cell * 0.5
        length = _dist(ax, az, bx, bz)
        n = max(2, int(length / step))
        for i in range(n + 1):
            t = i / n
            if not self.is_free_world(ax + t * (bx - ax), az + t * (bz - az)):
                return False
        return True


def _farthest_point_sample(cells: list[tuple[float, float]], k: int,
                           seed: random.Random) -> list[tuple[float, float]]:
    if not cells or k <= 0:
        return []
    chosen = [seed.choice(cells)]
    while len(chosen) < k and len(chosen) < len(cells):
        best, best_d = None, -1.0
        for cx, cz in cells:
            d = min(_dist(cx, cz, sx, sz) for sx, sz in chosen)
            if d > best_d:
                best, best_d = (cx, cz), d
        if best is None:
            break
        chosen.append(best)
    return chosen


def _slugify(name: str | None, fallback: str) -> str:
    if name:
        s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
        if s:
            return s
    return fallback


# output

@dataclass
class GameplayLayer:
    bounds: dict[str, float]
    waterline: float
    buildings: list[dict[str, Any]]
    marketBounds: dict[str, float]
    stallCount: int
    crateCount: int
    scooterCount: int
    palms: list[dict[str, float]]
    beerSpots: list[dict[str, float]]
    wineHides: list[dict[str, float]]
    rescueSpots: list[dict[str, Any]]
    childZones: list[dict[str, float]]
    cowStart: dict[str, float]
    # additive optional fields (extended scene builder reads these):
    venues: list[dict[str, Any]] = field(default_factory=list)
    smashables: list[dict[str, Any]] = field(default_factory=list)
    backdrop: list[dict[str, Any]] = field(default_factory=list)
    camelLanes: list[dict[str, float]] = field(default_factory=list)
    densityZones: list[dict[str, Any]] = field(default_factory=list)
    pettingZoo: dict[str, float] = field(default_factory=lambda: {"x": 0.0, "z": 0.0})
    warnings: list[str] = field(default_factory=list)

    def to_district_dict(self) -> dict[str, Any]:
        return {
            "bounds": self.bounds,
            "waterline": self.waterline,
            "buildings": self.buildings,
            "marketBounds": self.marketBounds,
            "stallCount": self.stallCount,
            "crateCount": self.crateCount,
            "scooterCount": self.scooterCount,
            "palms": self.palms,
            "beerSpots": self.beerSpots,
            "wineHides": self.wineHides,
            "rescueSpots": self.rescueSpots,
            "childZones": self.childZones,
            "cowStart": self.cowStart,
            "pettingZoo": self.pettingZoo,
            "venues": self.venues,
            "smashables": self.smashables,
            "backdrop": self.backdrop,
            "camelLanes": self.camelLanes,
            "densityZones": self.densityZones,
        }


def _waterline(buildings: list[SimplifiedBuilding], half_d: float) -> float:
    if not buildings:
        return round(half_d * 0.6, _MM)
    seaward = max(b.z + b.d / 2 for b in buildings)
    return round(min(half_d - 2.0, seaward + 8.0), _MM)


def _grid_lanes(grid: Grid, children: list[dict[str, float]], cfg: dict[str, Any],
                existing: list[dict[str, float]]) -> list[dict[str, float]]:
    """Fallback: cast straight corridors from the edges (used only when there are
    too few clear roads)."""
    excl = cfg["camel"]["child_exclusion_m"]
    length = cfg["camel"]["lane_length_m"]
    hw, hd, wl = grid.half_w, grid.half_d, grid.waterline
    out: list[dict[str, float]] = list(existing)
    for f in (0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8):
        z = -hd + f * (wl + hd)
        x = -hw + f * 2 * hw
        for ax, az, bx, bz in ((-hw, z, min(-hw + length, hw), z),
                               (hw, z, max(hw - length, -hw), z),
                               (x, -hd, x, min(-hd + length, wl))):
            if (grid.line_clear(ax, az, bx, bz)
                    and all(_point_seg_dist(c["x"], c["z"], ax, az, bx, bz) > excl for c in children)
                    and all(_dist(ax, az, ln["x0"], ln["z0"]) > grid.cell * 3 for ln in out)):
                out.append({"x0": round(ax, _MM), "z0": round(az, _MM),
                            "x1": round(bx, _MM), "z1": round(bz, _MM)})
    return out


def _camel_lanes(grid: Grid, children: list[dict[str, float]], roads: list[PRoad],
                 cfg: dict[str, Any], warnings: list[str]) -> list[dict[str, float]]:
    """>=2 straight approach corridors, routed along REAL STREETS (clear of
    buildings by definition), clear of every child zone + buffer (ADR-019).
    Falls back to edge-scan if the cell has too few clear roads. Repo Law 5:
    geometry only — never named, never explained."""
    excl = cfg["camel"]["child_exclusion_m"]
    min_lanes = cfg["camel"]["min_lanes"]
    min_len = cfg["camel"]["min_lane_len_m"]
    hw, hd, wl = grid.half_w, grid.half_d, grid.waterline

    def child_clear(ax: float, az: float, bx: float, bz: float) -> bool:
        return all(_point_seg_dist(c["x"], c["z"], ax, az, bx, bz) > excl for c in children)

    def edge_dist(x: float, z: float) -> float:
        return min(abs(x + hw), abs(x - hw), abs(z + hd), abs(z - wl))

    # candidate segments from roads: whole-road chord + each segment
    cands: list[tuple[float, float, float, float, float, float]] = []
    for r in roads:
        pts = r.line
        if len(pts) < 2:
            continue
        segs = [(pts[0], pts[-1])] + [(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
        for (a, b) in segs:
            ax, az, bx, bz = a[0], a[1], b[0], b[1]
            length = _dist(ax, az, bx, bz)
            if length < min_len:
                continue
            if grid.line_clear(ax, az, bx, bz) and child_clear(ax, az, bx, bz):
                boundary = min(edge_dist(ax, az), edge_dist(bx, bz))
                cands.append((round(boundary, 3), -round(length, 3), ax, az, bx, bz))
    # closest-to-boundary first (camel enters from an edge), then longest
    cands.sort()

    lanes: list[dict[str, float]] = []
    for _, _, ax, az, bx, bz in cands:
        if all(_dist(ax, az, ln["x0"], ln["z0"]) > grid.cell * 3 for ln in lanes):
            lanes.append({"x0": round(ax, _MM), "z0": round(az, _MM),
                          "x1": round(bx, _MM), "z1": round(bz, _MM)})
        if len(lanes) >= 4:
            break

    if len(lanes) < min_lanes:
        lanes = _grid_lanes(grid, children, cfg, lanes)
    if len(lanes) < min_lanes:
        warnings.append(f"only {len(lanes)} camel lane(s) found (need >={min_lanes}); "
                        f"few clear streets in cell — widen --half-extent or curate")
    return lanes


def _scatter_smashables(grid: Grid, roads: list[PRoad], free: list[tuple[float, float]],
                        existing: list[dict[str, Any]], cfg: dict[str, Any],
                        rng: random.Random) -> list[dict[str, Any]]:
    """A smashing game needs things to smash EVERYWHERE. Scatters crates/stalls/
    scooters/planters across the WHOLE cell — kerbside along real streets, plus
    open ground — instead of penning them in one market box. Hard-capped by the
    dynamic-body budget."""
    sm = cfg["smashables"]
    target = sm.get("target_dynamic", 220)
    cap = sm.get("max_dynamic", 250)
    budget = max(0, min(target, cap) - len(existing))
    if budget <= 0:
        return []
    offset = sm.get("road_offset_m", 4.0)
    spacing = sm.get("road_spacing_m", 18.0)
    min_gap = sm.get("min_gap_m", 3.0)
    weights = sm.get("kind_weights", {"crate": 1.0})
    kinds = sorted(weights.keys())
    cum: list[float] = []
    acc = 0.0
    for k in kinds:
        acc += weights[k]
        cum.append(acc)
    points = sm.get("points", {})

    taken = [(s["x"], s["z"]) for s in existing]

    def ok(x: float, z: float) -> bool:
        if not grid.is_free_world(x, z):
            return False
        return all(_dist(x, z, tx, tz) > min_gap for tx, tz in taken)

    def pick_kind() -> str:
        r = rng.random() * acc
        for i, c in enumerate(cum):
            if r <= c:
                return kinds[i]
        return kinds[-1]

    out: list[dict[str, Any]] = []

    # 1. kerbside: walk every street, drop clutter to both sides at intervals
    road_budget = int(budget * sm.get("along_roads_frac", 0.55))
    candidates: list[tuple[float, float]] = []
    for r in sorted(roads, key=lambda r: r.source_id):
        pts = r.line
        for i in range(len(pts) - 1):
            ax, az = pts[i]
            bx, bz = pts[i + 1]
            seg = _dist(ax, az, bx, bz)
            if seg < 1.0:
                continue
            nx, nz = (bz - az) / seg, -(bx - ax) / seg      # unit normal
            steps = max(1, int(seg / spacing))
            for st in range(steps):
                t = (st + 0.5) / steps
                px, pz = ax + (bx - ax) * t, az + (bz - az) * t
                for side in (1.0, -1.0):
                    candidates.append((px + nx * offset * side, pz + nz * offset * side))
    rng.shuffle(candidates)
    for x, z in candidates:
        if len(out) >= road_budget:
            break
        if ok(x, z):
            k = pick_kind()
            out.append({"x": round(x, _MM), "z": round(z, _MM), "kind": k,
                        "points": points.get(k, 8)})
            taken.append((x, z))

    # 2. open ground: fill the rest across free cells (plazas, yards, quays)
    open_cells = list(free)
    rng.shuffle(open_cells)
    for x, z in open_cells:
        if len(out) >= budget:
            break
        # jitter stays well inside the cell: the cell passed the water/building
        # test, its neighbours may not have
        jx = x + (rng.random() - 0.5) * grid.cell * 0.5
        jz = z + (rng.random() - 0.5) * grid.cell * 0.5
        if ok(jx, jz):
            k = pick_kind()
            out.append({"x": round(jx, _MM), "z": round(jz, _MM), "kind": k,
                        "points": points.get(k, 8)})
            taken.append((jx, jz))

    return out


def build_gameplay(
    provider: str,
    bounds: dict[str, float],
    buildings: list[SimplifiedBuilding],
    pois: list[PPoi],
    *,
    roads: list[PRoad] | None = None,
    sea: Any | None = None,
    seed: int = 1,
    config_path: str | None = None,
) -> GameplayLayer:
    cfg = load_gameplay_config(config_path)
    rng = random.Random(seed)
    roads = roads or []
    hw, hd = bounds["halfW"], bounds["halfD"]
    # real sea present -> the whole cell is in play and water is masked by the grid;
    # otherwise fall back to the old estimate (and say so in DEVIATIONS).
    waterline = hd if sea is not None else _waterline(buildings, hd)
    grid = Grid(hw, hd, waterline, buildings, cfg["grid_cell_m"], sea=sea)
    free = grid.free_cells()
    warnings: list[str] = []

    # 1. children FIRST (ADR-019). Prefer interior cells (away from edges).
    interior = [(x, z) for (x, z) in free
                if abs(x) < hw - grid.cell and -hd + grid.cell < z < waterline - grid.cell]
    child_cells = _farthest_point_sample(interior or free, cfg["child_zones"]["count"], rng)
    childZones = [_v(x, z) for x, z in child_cells]

    # 2. camel lanes routed along real streets, clear of children (ADR-019)
    camelLanes = _camel_lanes(grid, childZones, roads, cfg, warnings)

    # 3. cowStart: free cell farthest from any building (largest open space)
    if free:
        cow = max(free, key=lambda p: (grid.occupied_neighbors(*p) == 0,
                                       -abs(p[0]) - abs(p[1] - waterline / 2)))
        cowStart = _v(*cow)
    else:
        cowStart = _v(0, 0)

    # petting-zoo pen: an open cell toward a corner (calming fallback, §5.4).
    # Kept away from cowStart so it isn't underfoot at spawn.
    if free:
        pen = min(free, key=lambda p: (p[0] + p[1]))  # far SW-ish corner
        if _dist(pen[0], pen[1], cowStart["x"], cowStart["z"]) < grid.cell * 3 and len(free) > 1:
            pen = max(free, key=lambda p: _dist(p[0], p[1], cowStart["x"], cowStart["z"]))
        pettingZoo = _v(*pen)
    else:
        pettingZoo = _v(-hw + 8, -hd + 8)

    # classify POIs once
    classified = [(p, classify(p)) for p in pois]
    from collections import Counter
    role_tally = Counter(c.role for _, c in classified)
    warnings.append("poi roles ingested: " + ", ".join(
        f"{k}={role_tally[k]}" for k in ("venue", "zone", "smashable", "backdrop", "ignore")))

    # 4. density zones from role=zone POIs; main market = largest, or centre fallback
    densityZones: list[dict[str, Any]] = []
    for p, c in classified:
        if c.role == "zone":
            zx, zz = p.point
            w = cfg["grid_cell_m"] * 4
            densityZones.append({"x0": round(zx - w, _MM), "x1": round(zx + w, _MM),
                                 "z0": round(zz - w, _MM), "z1": round(zz + w, _MM),
                                 "weight": c.gameplay.get("density_weight", 1.0),
                                 "subtype": c.subtype})
    if densityZones:
        market = max(densityZones, key=lambda d: (d["x1"] - d["x0"]) * (d["z1"] - d["z0"]))
        marketBounds = {"x0": market["x0"], "x1": market["x1"],
                        "z0": market["z0"], "z1": market["z1"]}
    else:
        cx, cz = cowStart["x"], min(waterline - 12, 20)
        marketBounds = {"x0": round(cx - 16, _MM), "x1": round(cx + 16, _MM),
                        "z0": round(cz - 10, _MM), "z1": round(cz + 14, _MM)}

    area = max(1.0, (marketBounds["x1"] - marketBounds["x0"])
               * (marketBounds["z1"] - marketBounds["z0"]))
    sm = cfg["smashables"]
    stallCount = int(area / 100 * sm["stalls_per_100m2"])
    crateCount = int(area / 100 * sm["crates_per_100m2"])
    scooterCount = int(sm["scooter_count"])

    # 5. real-placed smashables (street furniture) + venues/backdrop from POIs
    smashables: list[dict[str, Any]] = []
    venues: list[dict[str, Any]] = []
    backdrop: list[dict[str, Any]] = []
    beer_anchor_pts: list[tuple[float, float]] = []
    slugs: dict[str, int] = {}
    building_centers = [(i, b.x, b.z) for i, b in enumerate(buildings)]
    building_venue: dict[int, str] = {}

    for p, c in classified:
        px, pz = p.point
        if c.role == "smashable":
            smashables.append({"x": round(px, _MM), "z": round(pz, _MM),
                               "kind": c.subtype, "points": c.gameplay.get("points", 5)})
        elif c.role == "venue":
            base = _slugify(p.name, p.source_id.split(":")[-1].replace("/", "-"))
            n = slugs.get(base, 0)
            slugs[base] = n + 1
            slug = base if n == 0 else f"{base}-{n+1}"
            is_beer = bool(c.gameplay.get("beer_anchor"))
            venues.append({"slug": slug, "kind": c.subtype, "x": round(px, _MM),
                           "z": round(pz, _MM), "name": p.name,
                           "name_tier": c.name_tier,
                           "beer_anchor": is_beer,
                           "ar_candidate": bool(c.gameplay.get("ar_candidate")),
                           "source_id": p.source_id})
            if is_beer:
                beer_anchor_pts.append((px, pz))
            # attach slug to nearest building within 30 m
            if building_centers:
                bi, bx, bz = min(building_centers, key=lambda t: _dist(px, pz, t[1], t[2]))
                if _dist(px, pz, bx, bz) <= 30 and bi not in building_venue:
                    building_venue[bi] = slug
        elif c.role == "backdrop":
            backdrop.append({"x": round(px, _MM), "z": round(pz, _MM),
                             "kind": p.kind, "name": p.name})

    # final building specs, with venue slugs applied
    building_specs: list[dict[str, Any]] = []
    for i, b in enumerate(buildings):
        spec = b.to_spec()
        if i in building_venue:
            spec["venue"] = building_venue[i]
        building_specs.append(spec)

    # 6. beer routing: anchors first (capped), then coverage-fill up to the cap so
    # the cell stays sparse — searching finds one in <=45 s, not-looking passes 2-3.
    radius = cfg["beer"]["coverage_radius_m"]
    max_spots = cfg["beer"]["max_spots"]
    anchors = beer_anchor_pts[:max_spots]
    beers = [_v(x, z) for x, z in anchors]
    covered = list(anchors)
    for cx, cz in sorted(free):
        if len(beers) >= max_spots:
            break
        if all(_dist(cx, cz, bx, bz) > radius for bx, bz in covered):
            beers.append(_v(cx, cz))
            covered.append((cx, cz))

    # 7. wine hides: enclosed dead-ends (free cells with many occupied neighbours)
    dead_ends = sorted(free, key=lambda p: -grid.occupied_neighbors(*p))
    wineHides = [_v(x, z) for x, z in dead_ends[:cfg["wine_hides"]["count"]]]

    # 8. rescue spots: spread across free cells, kinds cycle 0..2
    rescue_cells = _farthest_point_sample(free, cfg["rescue_spots"]["count"], rng)
    rescueSpots = [{"x": round(x, _MM), "z": round(z, _MM), "kind": i % 3}
                   for i, (x, z) in enumerate(rescue_cells)]

    # 9. palms: near the seaward edge, in free cells
    seaward_free = [p for p in free if p[1] > waterline - grid.cell * 4]
    palm_cells = _farthest_point_sample(seaward_free or free, cfg["palms"]["count"], rng)
    palms = [_v(x, z) for x, z in palm_cells]

    # district-wide smashable scatter (street furniture already in `smashables`)
    scattered = _scatter_smashables(grid, roads, free, smashables, cfg, rng)
    smashables = smashables + scattered
    warnings.append(f"smashables: {len(smashables)} total "
                    f"({len(scattered)} scattered + {len(smashables) - len(scattered)} real street furniture)")

    if not beers:
        warnings.append("no beer spots placed — playable area empty?")

    return GameplayLayer(
        bounds=bounds, waterline=waterline, buildings=building_specs,
        marketBounds=marketBounds, stallCount=stallCount, crateCount=crateCount,
        scooterCount=scooterCount, palms=palms, beerSpots=beers, wineHides=wineHides,
        rescueSpots=rescueSpots, childZones=childZones, cowStart=cowStart,
        pettingZoo=pettingZoo,
        venues=venues, smashables=smashables, backdrop=backdrop,
        camelLanes=camelLanes, densityZones=densityZones, warnings=warnings,
    )


def validate_child_safety(layer: GameplayLayer, exclusion_m: float) -> None:
    """HARD GATE (ADR-019 / Repo Law 4). Every child zone must be outside every
    camel lane + buffer. Raises on violation; a failing district does not ship."""
    for ch in layer.childZones:
        for ln in layer.camelLanes:
            d = _point_seg_dist(ch["x"], ch["z"], ln["x0"], ln["z0"], ln["x1"], ln["z1"])
            if d <= exclusion_m:
                raise ValueError(
                    f"child zone {ch} is {round(d,2)} m from camel lane "
                    f"{ln} (need > {exclusion_m} m) — ADR-019 violation")
