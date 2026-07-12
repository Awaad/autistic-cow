"""Bounding-box math. Pure and deterministic: a center+radius always yields
the same bounds, so cache keys and generated output stay reproducible."""
from __future__ import annotations

import math
from dataclasses import dataclass

# WGS84 meters-per-degree at the equator for latitude; longitude scaled by cos(lat).
# Spherical approximation is deliberate: exact, cheap, deterministic, and the
# ~0.5% error over a 400 m cell is far below curation tolerance.
_M_PER_DEG_LAT = 111_320.0
_COORD_PRECISION = 7  # ~1 cm; enough to be exact, few enough to be stable


@dataclass(frozen=True)
class BBox:
    """A geographic bounding box in WGS84 degrees."""

    south: float
    west: float
    north: float
    east: float

    @classmethod
    def from_center(cls, lat: float, lon: float, radius_m: float) -> "BBox":
        dlat = radius_m / _M_PER_DEG_LAT
        dlon = radius_m / (_M_PER_DEG_LAT * math.cos(math.radians(lat)))
        return cls(
            south=round(lat - dlat, _COORD_PRECISION),
            west=round(lon - dlon, _COORD_PRECISION),
            north=round(lat + dlat, _COORD_PRECISION),
            east=round(lon + dlon, _COORD_PRECISION),
        )

    @property
    def center(self) -> tuple[float, float]:
        return (
            round((self.south + self.north) / 2, _COORD_PRECISION),
            round((self.west + self.east) / 2, _COORD_PRECISION),
        )

    def as_overpass(self) -> str:
        """Overpass QL order: south,west,north,east."""
        return f"{self.south},{self.west},{self.north},{self.east}"

    def as_overture(self) -> str:
        """overturemaps CLI --bbox order: west,south,east,north."""
        return f"{self.west},{self.south},{self.east},{self.north}"

    def as_tuple(self) -> tuple[float, float, float, float]:
        return (self.south, self.west, self.north, self.east)


# The spike target (handoff §3): Kyrenia harbor, roughly 35.339 N, 33.317 E ± 400 m.
KYRENIA_HARBOR_CENTER = (35.339, 33.317)
KYRENIA_HARBOR_RADIUS_M = 400.0


def kyrenia_harbor_bbox() -> BBox:
    lat, lon = KYRENIA_HARBOR_CENTER
    return BBox.from_center(lat, lon, KYRENIA_HARBOR_RADIUS_M)