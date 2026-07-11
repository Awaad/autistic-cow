"""Session lifecycle — server-authoritative. The client proposes,
this file disposes: seeds issued here, events land append-only here, the
end-of-session verdict (xp, level, axis band) is computed here."""
from __future__ import annotations

import secrets
from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncConnection

from app.core.deps import current_player
from app.core.dispatch import DomainEvent, dispatcher
from app.core.ids import new_token
from app.core.settings import settings
from app.core.tuning import tuning
from app.db import repo
from app.db.session import get_conn

router = APIRouter(prefix="/sessions", tags=["sessions"])

VALID_EVENT_TYPES = {
    "rescue_completed", "rescue_ignored", "child_scared", "child_helped",
    "destruction_spree", "photo_calm_used", "cameld", "lure_executed",
    "wine_found", "mission_completed", "mission_abandoned", "hesitation",
}


class SessionStartOut(BaseModel):
    session_id: UUID
    spawn_seed: int
    session_token: str
    tuning_version: str
    district_slug: str


class JudgeEventIn(BaseModel):
    event_id: UUID
    seq_in_session: int = Field(ge=0)
    event_type: str
    target_kind: str | None = None
    rage_at_event: int = Field(ge=0, le=100)
    payload: dict[str, Any] = {}
    client_ts: datetime | None = None


class EventBatchIn(BaseModel):
    events: list[JudgeEventIn] = Field(max_length=100)


class SessionEndIn(BaseModel):
    destruction_score: int = Field(ge=0, le=1_000_000)
    rescue_score: int = Field(ge=0, le=1_000_000)
    peak_rage: int = Field(ge=0, le=100)
    nerves_lost: int = Field(ge=0, le=3)
    end_reason: str = Field(pattern="^(timer|cameld|player_exit)$")


class SessionEndOut(BaseModel):
    xp: int
    level: int
    level_up: bool
    moral_axis: float
    axis_band: str


@router.post("", response_model=SessionStartOut)
async def start_session(
    player_id: UUID = Depends(current_player),
    conn: AsyncConnection = Depends(get_conn),
) -> SessionStartOut:
    district = await repo.active_district(conn, "kyrenia-harbor")
    if district is None:
        raise HTTPException(503, "no active district — run tools/seed_dev.py")
    seed = secrets.randbits(31)
    sid = await repo.create_session(
        conn, player_id, district, seed, settings().tuning_version, "en",
    )
    await repo.touch_last_seen(conn, player_id)
    return SessionStartOut(
        session_id=sid,
        spawn_seed=seed,
        session_token=new_token(),
        tuning_version=settings().tuning_version,
        district_slug="kyrenia-harbor",
    )


@router.post("/{session_id}/events", status_code=202)
async def ingest_events(
    session_id: UUID,
    batch: EventBatchIn,
    player_id: UUID = Depends(current_player),
    conn: AsyncConnection = Depends(get_conn),
) -> dict[str, int]:
    events = [e.model_dump() for e in batch.events if e.event_type in VALID_EVENT_TYPES]
    inserted = await repo.insert_judge_events(conn, session_id, player_id, events)
    await dispatcher.emit(DomainEvent(
        "events_ingested", {"session_id": str(session_id), "count": inserted},
    ))
    return {"accepted": inserted}


@router.post("/{session_id}/end", response_model=SessionEndOut)
async def end_session(
    session_id: UUID,
    body: SessionEndIn,
    player_id: UUID = Depends(current_player),
    conn: AsyncConnection = Depends(get_conn),
) -> SessionEndOut:
    # plausibility bounds (04_ARCH §7 layer 1); deep validation is post-beta
    max_score = int(tuning()["integrity"].get("max_session_score", 200_000))
    if body.destruction_score + body.rescue_score > max_score:
        body.destruction_score = min(body.destruction_score, max_score)
        body.rescue_score = 0  # flagged path; shadow rules arrive with leaderboards
    verdict = await repo.end_session(
        conn, session_id, player_id,
        body.destruction_score, body.rescue_score,
        body.peak_rage, body.nerves_lost, body.end_reason,
    )
    await dispatcher.emit(DomainEvent("session_ended", {"session_id": str(session_id)}))
    return SessionEndOut(**verdict)
