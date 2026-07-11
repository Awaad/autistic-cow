"""Consent matrix — append-only rows, latest wins.
Registered players only; anonymous play is functional-scope by definition."""
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncConnection

from app.core.deps import current_player
from app.core.settings import settings
from app.db import repo
from app.db.session import get_conn
from app.schemas import ConsentSetRequest, ConsentState

router = APIRouter(prefix="/consents", tags=["consents"])


@router.get("", response_model=ConsentState)
async def get_consents(
    player_id: UUID = Depends(current_player),
    conn: AsyncConnection = Depends(get_conn),
) -> ConsentState:
    return ConsentState(consents=await repo.latest_consents(conn, player_id))


@router.post("", response_model=ConsentState)
async def set_consent(
    body: ConsentSetRequest,
    player_id: UUID = Depends(current_player),
    conn: AsyncConnection = Depends(get_conn),
) -> ConsentState:
    await repo.set_consent(
        conn, player_id, body.consent_key.value, body.granted,
        body.source or "settings", settings().policy_version,
    )
    return ConsentState(consents=await repo.latest_consents(conn, player_id))
