"""Extract stage.

Pulls raw geometry for a bbox from OSM (Overpass) and/or Overture and caches
the RAW response bytes before any parsing. Cache keys are deterministic
(hash of provider+endpoint+query), so re-runs are cache hits and the whole
pipeline stays reproducible. Overpass rate limits are real; the cache is the
politeness layer.

Zero third-party runtime deps: Overpass over stdlib urllib, Overture over the
`overturemaps` CLI (only needed if you extract Overture). Parsing lives in
ir.py; this module is the I/O boundary and stays thin on purpose.
"""
from __future__ import annotations

import hashlib
import json
import subprocess
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .bbox import BBox

DEFAULT_OVERPASS_URL = "https://overpass-api.de/api/interpreter"


def overpass_query(bbox: BBox) -> str:
    """Buildings, road network, and POIs for the bbox. `out geom` returns
    coordinates inline so the cache is self-contained (no node resolution)."""
    b = bbox.as_overpass()
    return (
        "[out:json][timeout:180];\n"
        "(\n"
        f'  way["building"]({b});\n'
        f'  way["highway"]({b});\n'
        f'  way["natural"="coastline"]({b});\n'
        f'  way["natural"="water"]({b});\n'
        f'  way["water"]({b});\n'
        f'  way["waterway"="riverbank"]({b});\n'
        f'  node["amenity"]({b});\n'
        f'  node["shop"]({b});\n'
        f'  node["tourism"]({b});\n'
        f'  node["historic"]({b});\n'
        ");\n"
        "out geom;\n"
    )


def cache_key(provider: str, endpoint: str, query: str) -> str:
    h = hashlib.sha256()
    h.update(provider.encode())
    h.update(b"\x00")
    h.update(endpoint.encode())
    h.update(b"\x00")
    h.update(query.encode())
    return f"{provider}-{h.hexdigest()[:16]}"


@dataclass
class CacheResult:
    key: str
    path: Path
    from_cache: bool
    raw: dict[str, Any]


def _cache_dir(out_dir: Path) -> Path:
    d = out_dir / "cache" / "raw"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _write_manifest(out_dir: Path, entry: dict[str, Any]) -> None:
    mpath = out_dir / "cache" / "manifest.json"
    manifest = json.loads(mpath.read_text()) if mpath.exists() else {"entries": []}
    manifest["entries"] = [e for e in manifest["entries"] if e["key"] != entry["key"]]
    manifest["entries"].append(entry)
    manifest["entries"].sort(key=lambda e: e["key"])
    mpath.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")


def fetch_overpass(
    bbox: BBox,
    out_dir: Path,
    endpoint: str = DEFAULT_OVERPASS_URL,
    *,
    force: bool = False,
) -> CacheResult:
    query = overpass_query(bbox)
    key = cache_key("osm", endpoint, query)
    raw_path = _cache_dir(out_dir) / f"{key}.json"
    if raw_path.exists() and not force:
        return CacheResult(key, raw_path, True, json.loads(raw_path.read_text()))

    req = urllib.request.Request(
        endpoint,
        data=("data=" + urllib.parse.quote(query)).encode(),
        headers={"User-Agent": "autistic-cow-district-gen/0.1 (offline pipeline)"},
    )
    with urllib.request.urlopen(req, timeout=200) as resp:  # noqa: S310 (fixed host)
        body = resp.read().decode()
    raw = json.loads(body)
    raw_path.write_text(body)
    _write_manifest(out_dir, {
        "key": key, "provider": "osm", "endpoint": endpoint,
        "query": query, "bbox": list(bbox.as_tuple()),
        "elements": len(raw.get("elements", [])),
    })
    return CacheResult(key, raw_path, False, raw)


def fetch_overture(
    bbox: BBox,
    out_dir: Path,
    *,
    types: tuple[str, ...] = ("building", "segment", "place"),
    force: bool = False,
) -> CacheResult:
    """Shells out to the `overturemaps` CLI (uv sync --extra overture) and
    concatenates the requested feature types into one GeoJSON FeatureCollection.
    """
    key = cache_key("overture", "cli:" + ",".join(types), bbox.as_overture())
    raw_path = _cache_dir(out_dir) / f"{key}.json"
    if raw_path.exists() and not force:
        return CacheResult(key, raw_path, True, json.loads(raw_path.read_text()))

    features: list[dict[str, Any]] = []
    for t in types:
        proc = subprocess.run(
            ["overturemaps", "download", "--bbox", bbox.as_overture(),
             "-f", "geojson", "--type", t],
            capture_output=True, text=True, check=True,
        )
        fc = json.loads(proc.stdout)
        features.extend(fc.get("features", []))
    raw = {"type": "FeatureCollection", "features": features}
    raw_path.write_text(json.dumps(raw, sort_keys=True))
    _write_manifest(out_dir, {
        "key": key, "provider": "overture", "endpoint": "cli",
        "types": list(types), "bbox": list(bbox.as_tuple()),
        "features": len(features),
    })
    return CacheResult(key, raw_path, False, raw)