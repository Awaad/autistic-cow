"""Intermediate representation (IR).

Both providers normalize into ONE provider-agnostic shape so every downstream
stage (simplify, gameplay, emit) is provider-blind. Coordinates stay in
[lon, lat] WGS84 here; projection to scene meters happens later (simplify).

Determinism law: every collection is sorted by (provider, source_id) on
normalize, so byte-identical inputs -> byte-identical IR regardless of the
order the provider returned features in.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any

Coord = list[float]  # [lon, lat]

# highway tag -> corridor kind. "buildings punish contact, so geometry IS
# difficulty": a wide street is a rage corridor, a narrow alley
# is a squeeze. Plazas are detected later from area geometry, not here.
_ALLEY_HIGHWAYS = {
    "service", "living_street", "pedestrian", "footway",
    "path", "steps", "track", "cycleway", "corridor",
}


@dataclass(frozen=True)
class Building:
    source_id: str          # "osm:way/123" | "overture:<gers-id>"
    footprint: list[Coord]  # closed ring, [lon,lat]; first != last enforced-open
    levels: int | None      # from building:levels / num_floors if present
    tags: dict[str, str]


@dataclass(frozen=True)
class Road:
    source_id: str
    line: list[Coord]
    kind: str               # "street" | "alley"
    highway: str            # raw source value, kept for later width tuning
    tags: dict[str, str]


@dataclass(frozen=True)
class Poi:
    source_id: str
    point: Coord
    kind: str               # coarse: "bar" | "cafe" | "shop" | "landmark" | ...
    name: str | None        # kept in IR; STRIPPED at emit unless partner venue
    tags: dict[str, str]


@dataclass
class DistrictIR:
    provider: str
    bbox: tuple[float, float, float, float]  # (south, west, north, east)
    buildings: list[Building] = field(default_factory=list)
    roads: list[Road] = field(default_factory=list)
    pois: list[Poi] = field(default_factory=list)

    def sorted(self) -> "DistrictIR":
        return DistrictIR(
            provider=self.provider,
            bbox=self.bbox,
            buildings=sorted(self.buildings, key=lambda b: b.source_id),
            roads=sorted(self.roads, key=lambda r: r.source_id),
            pois=sorted(self.pois, key=lambda p: p.source_id),
        )

    def counts(self) -> dict[str, int]:
        return {
            "buildings": len(self.buildings),
            "roads": len(self.roads),
            "pois": len(self.pois),
        }

    def to_dict(self) -> dict[str, Any]:
        s = self.sorted()
        return {
            "provider": s.provider,
            "bbox": list(s.bbox),
            "buildings": [asdict(b) for b in s.buildings],
            "roads": [asdict(r) for r in s.roads],
            "pois": [asdict(p) for p in s.pois],
        }

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "DistrictIR":
        return cls(
            provider=d["provider"],
            bbox=tuple(d["bbox"]),  # type: ignore[arg-type]
            buildings=[Building(**b) for b in d["buildings"]],
            roads=[Road(**r) for r in d["roads"]],
            pois=[Poi(**p) for p in d["pois"]],
        ).sorted()


def _road_kind(highway: str, tags: dict[str, str]) -> str:
    if highway in _ALLEY_HIGHWAYS:
        return "alley"
    if tags.get("service"):  # service=alley etc.
        return "alley"
    return "street"


def _poi_kind(tags: dict[str, str]) -> str:
    amenity = tags.get("amenity")
    if amenity in {"bar", "pub", "biergarten"}:
        return "bar"
    if amenity in {"cafe", "restaurant"}:
        return "cafe"
    if tags.get("tourism") in {"attraction", "museum", "artwork"} or tags.get("historic"):
        return "landmark"
    if tags.get("shop"):
        return "shop"
    return amenity or "poi"


def _levels(tags: dict[str, str]) -> int | None:
    for key in ("building:levels", "levels", "num_floors"):
        raw = tags.get(key)
        if raw:
            try:
                return int(float(raw))
            except ValueError:
                continue
    return None


# OSM / Overpass (`out geom` responses) 

def normalize_overpass(raw: dict[str, Any], bbox: tuple[float, float, float, float]) -> DistrictIR:
    ir = DistrictIR(provider="osm", bbox=bbox)
    for el in raw.get("elements", []):
        tags = {str(k): str(v) for k, v in (el.get("tags") or {}).items()}
        etype = el.get("type")
        eid = el.get("id")
        if etype == "way":
            geom = el.get("geometry") or []
            ring = [[pt["lon"], pt["lat"]] for pt in geom if "lon" in pt and "lat" in pt]
            if "building" in tags and len(ring) >= 4:
                ir.buildings.append(
                    Building(f"osm:way/{eid}", _open_ring(ring), _levels(tags), tags)
                )
            elif "highway" in tags and len(ring) >= 2:
                hw = tags["highway"]
                ir.roads.append(Road(f"osm:way/{eid}", ring, _road_kind(hw, tags), hw, tags))
        elif etype == "node":
            lon, lat = el.get("lon"), el.get("lat")
            if lon is None or lat is None:
                continue
            if any(k in tags for k in ("amenity", "shop", "tourism", "historic")):
                ir.pois.append(
                    Poi(f"osm:node/{eid}", [lon, lat], _poi_kind(tags), tags.get("name"), tags)
                )
    return ir.sorted()


def _open_ring(ring: list[Coord]) -> list[Coord]:
    """Drop a duplicated closing vertex if present; downstream re-closes."""
    if len(ring) >= 2 and ring[0] == ring[-1]:
        return ring[:-1]
    return ring


# Overture (GeoJSON features)

def normalize_overture(features: list[dict[str, Any]], bbox: tuple[float, float, float, float]) -> DistrictIR:
    ir = DistrictIR(provider="overture", bbox=bbox)
    for f in features:
        props = f.get("properties") or {}
        geom = f.get("geometry") or {}
        gid = str(props.get("id") or props.get("gers_id") or f.get("id") or "")
        gtype = geom.get("type")
        coords = geom.get("coordinates")
        if gtype == "Polygon" and coords:
            ring = [[c[0], c[1]] for c in coords[0]]
            tags = _overture_tags(props)
            ir.buildings.append(
                Building(f"overture:{gid}", _open_ring(ring), _overture_levels(props), tags)
            )
        elif gtype == "LineString" and coords:
            line = [[c[0], c[1]] for c in coords]
            cls = str(props.get("class") or props.get("subtype") or "")
            hw = cls or "road"
            ir.roads.append(
                Road(f"overture:{gid}", line, _road_kind(cls, {}), hw, _overture_tags(props))
            )
        elif gtype == "Point" and coords:
            tags = _overture_tags(props)
            ir.pois.append(
                Poi(f"overture:{gid}", [coords[0], coords[1]], tags.get("_kind", "poi"),
                    _overture_name(props), tags)
            )
    return ir.sorted()


def _overture_tags(props: dict[str, Any]) -> dict[str, str]:
    out: dict[str, str] = {}
    for k in ("class", "subtype", "height", "num_floors"):
        v = props.get(k)
        if v is not None:
            out[k] = str(v)
    cats = props.get("categories")
    if isinstance(cats, dict) and cats.get("primary"):
        out["_kind"] = str(cats["primary"])
    return out


def _overture_levels(props: dict[str, Any]) -> int | None:
    v = props.get("num_floors")
    if v is not None:
        try:
            return int(float(v))
        except (TypeError, ValueError):
            return None
    return None


def _overture_name(props: dict[str, Any]) -> str | None:
    names = props.get("names")
    if isinstance(names, dict):
        primary = names.get("primary")
        if primary:
            return str(primary)
    return None