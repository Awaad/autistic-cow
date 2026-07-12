"""The player's own data: profile, GDPR export, user-initiated deletion.
Deletion = the same orphan procedure the retention sweep runs."""
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncConnection

from app.core.deps import current_player
from app.db import repo
from app.db.session import get_conn
from app.schemas import ProfileMe

router = APIRouter(prefix="/me", tags=["me"])


@router.get("", response_model=ProfileMe)
async def me(
    player_id: UUID = Depends(current_player),
    conn: AsyncConnection = Depends(get_conn),
) -> ProfileMe:
    prof = await repo.profile_me(conn, player_id)
    if prof is None:
        raise HTTPException(404, "no profile")
    return ProfileMe(**prof)


@router.get("/export")
async def export(
    player_id: UUID = Depends(current_player),
    conn: AsyncConnection = Depends(get_conn),
) -> dict[str, Any]:
    return await repo.export_bundle(conn, player_id)


@router.post("/delete", status_code=204)
async def delete_me(
    player_id: UUID = Depends(current_player),
    conn: AsyncConnection = Depends(get_conn),
) -> None:
    await repo.orphan_player(conn, player_id)
