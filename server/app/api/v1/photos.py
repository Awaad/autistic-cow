"""Pet-photo ingestion. The 15s max-rage timer demands a
SYNCHRONOUS decision: classify + score + strip + store inline. Invariants:
- exif.parse() is the only place precise GPS ever exists (in memory);
- strip() ALWAYS runs before storage.put() — this file is the single call site;
- quarantine rows never join photos in any response;
- soft enforcement: an animal photo is never hard-blocked."""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy.ext.asyncio import AsyncConnection

from app.core.deps import current_player
from app.core.tuning import tuning
from app.db import repo
from app.db.session import get_conn
from app.domain.photos import storage
from app.domain.photos.authenticity import AuthenticityInput, score, tier_for
from app.domain.photos.classifier import classifier
from app.domain.photos.exif import parse, strip
from app.domain.photos.phash import average_hash
from app.schemas import PhotoDecision

router = APIRouter(prefix="/photos", tags=["photos"])


@router.post("", response_model=PhotoDecision)
async def upload_photo(
    request: Request,
    file: UploadFile = File(...),
    live_capture: bool = Form(False),
    session_id: UUID | None = Form(None),
    player_id: UUID = Depends(current_player),
    conn: AsyncConnection = Depends(get_conn),
) -> PhotoDecision:
    cfg = tuning()["photos"]
    data = await file.read()
    if len(data) > int(cfg["max_bytes"]):
        raise HTTPException(413, "photo too large")

    sig = parse(data)  # precise GPS lives and dies inside parse()
    cls = classifier.classify(data)
    ph = average_hash(data) if cls.label != "unreadable" else "0" * 16
    dupe = await repo.phash_seen(conn, player_id, ph)

    delta_s = None
    if sig.capture_dt:
        delta_s = abs(int((datetime.now(timezone.utc) - sig.capture_dt).total_seconds()))
    ua = (request.headers.get("user-agent") or "")[:64]
    device_match = None
    if sig.exif_device:
        device_match = any(tok and tok in ua for tok in sig.exif_device.split())

    auth = score(AuthenticityInput(
        live_capture=live_capture, exif_present=sig.exif_present,
        exif_device_matches_ua=device_match, capture_upload_delta_s=delta_s,
        phash_duplicate=dupe,
    ))
    tier = tier_for(auth, cls.is_animal)

    energy_granted = False
    rage_floor = 100
    quip = None
    reduced_reason = None
    if tier == "rejected":
        quip = "photo.reject_not_animal"   # "That is a sandwich." — client localizes
    else:
        rage_floor = int(cfg["rage_floor_full" if tier == "full" else "rage_floor_reduced"])
        if tier == "reduced":
            reduced_reason = "duplicate" if dupe else ("not_live" if not live_capture else "low_signals")
        if tier == "full" and live_capture:
            energy_granted = await repo.grant_photo_energy(conn, player_id)

    # strip ALWAYS precedes storage — the only put() call site
    clean = strip(data) if cls.label != "unreadable" else b""
    key = f"{player_id}/{ph}-{len(clean)}.jpg"
    stored = False
    if clean:
        try:
            storage.put(key, clean)
            stored = True
        except Exception:  # noqa: BLE001 — storage down ≠ gameplay down (soft everywhere)
            stored = False

    in_herd = stored and tier != "rejected" and await repo.herd_consented(conn, player_id)
    photo_id = await repo.insert_photo(
        conn, player_id, key if stored else "", "pet_calm",
        cls.label, cls.confidence, auth, tier, in_herd, session_id,
    )
    await repo.insert_quarantine(
        conn, photo_id, "live_camera" if live_capture else "gallery",
        ua or None, sig.exif_device, sig.exif_present, delta_s,
        sig.gps_region, ph,
    )
    return PhotoDecision(
        photo_id=str(photo_id), bonus_tier=tier, is_animal=cls.is_animal,
        classifier_label=cls.label, rage_floor=rage_floor,
        energy_granted=energy_granted, reject_quip_key=quip,
        reduced_reason=reduced_reason,
    )
