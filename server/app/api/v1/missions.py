"""Missions — map-as-content: types are code, missions are rows.
Offer flow: GET returns up to 2 for the district; accept marks active;
completion arrives with /end (client-tracked v1; deep validation post-beta,
same trust tier as scores under the integrity clamps)."""
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncConnection

from app.core.deps import current_player
from app.db import repo
from app.db.session import get_conn
from app.schemas import MissionList, MissionOffer

router = APIRouter(prefix="/missions", tags=["missions"])


@router.get("", response_model=MissionList)
async def offered(
    locale: str = Query("en"),
    player_id: UUID = Depends(current_player),
    conn: AsyncConnection = Depends(get_conn),
) -> MissionList:
    loc = locale if locale in ("en", "de", "ru") else "en"
    rows = await repo.offered_missions(conn, player_id, "kyrenia-harbor", loc)
    return MissionList(missions=[MissionOffer(**r) for r in rows])


@router.post("/{mission_id}/accept", status_code=204)
async def accept(
    mission_id: UUID,
    player_id: UUID = Depends(current_player),
    conn: AsyncConnection = Depends(get_conn),
) -> None:
    await repo.mark_mission(conn, player_id, mission_id, "active", None)
