"""Session lifecycle — server-authoritative (ADR-003). The client proposes,
this file disposes: seeds issued here, events land append-only here, the
end-of-session verdict (xp, level, axis band) is computed here."""
from __future__ import annotations

import secrets
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncConnection

from app.core.deps import current_player
from app.core.dispatch import DomainEvent, dispatcher
from app.core.ids import new_token
from app.core.settings import settings
from app.core.tuning import tuning
from app.db import repo
from app.db.session import get_conn
from app.schemas import (
    EventBatch, SessionEndRequest, SessionEndResponse, SessionStartResponse,
)

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("", response_model=SessionStartResponse)
async def start_session(
    player_id: UUID = Depends(current_player),
    conn: AsyncConnection = Depends(get_conn),
) -> SessionStartResponse:
    district = await repo.active_district(conn, "kyrenia-harbor")
    if district is None:
        raise HTTPException(503, "no active district — run tools/seed_dev.py")
    anon_count = await repo.anon_session_count(conn, player_id)
    if anon_count is not None and anon_count >= int(tuning()["wall"]["free_anon_sessions"]):
        # she remembers you — and the server does too. localStorage tricks won't help.
        raise HTTPException(403, detail={"error": "account_required"})
    spent = await repo.spend_energy(conn, player_id)
    if spent is None:
        from app.domain.economy.energy import energy_now
        from datetime import datetime, timezone
        prof = await repo.profile_me(conn, player_id)
        nxt = prof["energy"]["next_energy_in_s"] if prof else 0
        raise HTTPException(409, detail={"error": "no_energy", "next_energy_in_s": nxt})
    energy_remaining, _ = spent
    seed = secrets.randbits(31)
    sid = await repo.create_session(
        conn, player_id, district, seed, settings().tuning_version, "en",
    )
    await repo.touch_last_seen(conn, player_id)
    return SessionStartResponse(
        session_id=str(sid),
        spawn_seed=seed,
        session_token=new_token(),
        tuning_version=settings().tuning_version,
        district_slug="kyrenia-harbor",
        energy_remaining=energy_remaining,
    )


@router.post("/{session_id}/events", status_code=202)
async def ingest_events(
    session_id: UUID,
    batch: EventBatch,
    player_id: UUID = Depends(current_player),
    conn: AsyncConnection = Depends(get_conn),
) -> dict[str, int]:
    # explicit construction: no dump-mode ambiguity — event_type as str for
    # the pg enum, client_ts as a real datetime for asyncpg, UUIDs as UUIDs
    events = [
        {
            "event_id": e.event_id,
            "seq_in_session": e.seq_in_session,
            "event_type": e.event_type.value,
            "target_kind": e.target_kind,
            "rage_at_event": e.rage_at_event,
            "client_ts": e.client_ts,
        }
        for e in batch.events
    ]
    inserted = await repo.insert_judge_events(conn, session_id, player_id, events)
    await dispatcher.emit(DomainEvent(
        "events_ingested", {"session_id": str(session_id), "count": inserted},
    ))
    return {"accepted": inserted}


@router.post("/{session_id}/end", response_model=SessionEndResponse)
async def end_session(
    session_id: UUID,
    body: SessionEndRequest,
    player_id: UUID = Depends(current_player),
    conn: AsyncConnection = Depends(get_conn),
) -> SessionEndResponse:
    max_score = int(tuning()["integrity"].get("max_session_score", 200_000))
    d, r = body.destruction_score, body.rescue_score
    if d + r > max_score:
        d, r = min(d, max_score), 0  # flagged path; shadow rules arrive with leaderboards
    flagged = (d, r) != (body.destruction_score, body.rescue_score)
    verdict = await repo.end_session(
        conn, session_id, player_id, d, r,
        body.peak_rage, body.nerves_lost, body.end_reason.value,
    )
    for mr in (body.missions or []):
        status = mr.status.value if hasattr(mr.status, "value") else str(mr.status)
        await repo.mark_mission(conn, player_id, mr.mission_id, status, session_id)
        if status == "completed" and not flagged:
            await repo.add_currency(conn, player_id, await repo.mission_reward(conn, mr.mission_id))

    if not flagged:  # shadow exclusion: flagged sessions never reach the board (ADR-005)
        from app.api.v1.leaderboards import zadd_score
        await zadd_score(verdict["axis_band"], str(player_id), verdict["xp"])
    await dispatcher.emit(DomainEvent("session_ended", {"session_id": str(session_id)}))
    return SessionEndResponse(**verdict)
