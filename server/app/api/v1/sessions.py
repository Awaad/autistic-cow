"""Session lifecycle — 04_ARCHITECTURE.
Server-authoritative: client proposes, server disposes."""
from __future__ import annotations

import random
from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.core.dispatch import DomainEvent, dispatcher
from app.core.ids import new_id, new_token
from app.core.settings import settings

router = APIRouter(prefix="/sessions", tags=["sessions"])


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
    client_ts: datetime


class EventBatchIn(BaseModel):
    events: list[JudgeEventIn]


@router.post("", response_model=SessionStartOut)
async def start_session() -> SessionStartOut:
    # Later persist session row, check energy, resolve district.
    return SessionStartOut(
        session_id=new_id(),
        spawn_seed=random.getrandbits(31),
        session_token=new_token(),
        tuning_version=settings().tuning_version,
        district_slug="kyrenia-harbor",
    )


@router.post("/{session_id}/events", status_code=202)
async def ingest_events(session_id: UUID, batch: EventBatchIn) -> dict[str, int]:
    # shape validation vs tuning integrity limits, append to
    # judge_events, flag seq gaps as integrity signals (never hard-reject).
    await dispatcher.emit(DomainEvent(
        "events_ingested",
        {"session_id": str(session_id), "count": len(batch.events)},
    ))
    return {"accepted": len(batch.events)}


@router.post("/{session_id}/end")
async def end_session(session_id: UUID) -> dict[str, str]:
    # Later: server recomputes authoritative summary from the event log.
    await dispatcher.emit(DomainEvent("session_ended", {"session_id": str(session_id)}))
    return {"session_id": str(session_id), "status": "ended"}
