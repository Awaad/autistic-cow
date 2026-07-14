"""EXIF handling — the privacy-critical seam (docs/02 §4 invariants):
precise GPS exists IN MEMORY ONLY inside parse(); only a coarsened region
string may leave this module. strip() returns bytes with all EXIF removed.
Any change here needs a solo commit naming the change (same rule class as
physics/layers.ts)."""
from __future__ import annotations

import io
from dataclasses import dataclass
from datetime import datetime, timezone

from PIL import Image
from PIL.ExifTags import GPSTAGS, TAGS


@dataclass(frozen=True)
class ExifSignals:
    exif_present: bool
    exif_device: str | None          # "Make Model", coarse
    capture_dt: datetime | None      # from DateTimeOriginal
    gps_region: str | None           # COARSENED ("35.3,33.3" @ 0.1deg) — never precise


def _coarsen(lat: float, lon: float) -> str:
    # 0.1 degree ~ 11km: city-level, useless for locating a home
    return f"{round(lat, 1)},{round(lon, 1)}"


def _gps_to_deg(v) -> float:
    d, m, s = (float(x) for x in v)
    return d + m / 60 + s / 3600


def parse(data: bytes) -> ExifSignals:
    try:
        img = Image.open(io.BytesIO(data))
        raw = img.getexif()
    except Exception:  # noqa: BLE001 — unreadable image = no signals
        return ExifSignals(False, None, None, None)
    if not raw:
        return ExifSignals(False, None, None, None)

    named = {TAGS.get(k, k): v for k, v in raw.items()}
    device = None
    make, model = named.get("Make"), named.get("Model")
    if make or model:
        device = f"{make or ''} {model or ''}".strip()

    capture_dt = None
    ifd = raw.get_ifd(0x8769)  # Exif IFD
    dto = {TAGS.get(k, k): v for k, v in ifd.items()}.get("DateTimeOriginal") or named.get("DateTime")
    if dto:
        try:
            capture_dt = datetime.strptime(str(dto), "%Y:%m:%d %H:%M:%S").replace(tzinfo=timezone.utc)
        except ValueError:
            capture_dt = None

    gps_region = None
    gps_ifd = raw.get_ifd(0x8825)  # GPS IFD
    if gps_ifd:
        g = {GPSTAGS.get(k, k): v for k, v in gps_ifd.items()}
        try:
            lat = _gps_to_deg(g["GPSLatitude"]) * (1 if g.get("GPSLatitudeRef", "N") == "N" else -1)
            lon = _gps_to_deg(g["GPSLongitude"]) * (1 if g.get("GPSLongitudeRef", "E") == "E" else -1)
            gps_region = _coarsen(lat, lon)  # precise values die at end of scope
        except (KeyError, ZeroDivisionError, TypeError):
            gps_region = None

    return ExifSignals(True, device, capture_dt, gps_region)


def strip(data: bytes) -> bytes:
    """Re-encode without metadata. Always called before storage."""
    img = Image.open(io.BytesIO(data))
    img = img.convert("RGB")
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=88)  # no exif kwarg = no exif
    return out.getvalue()
