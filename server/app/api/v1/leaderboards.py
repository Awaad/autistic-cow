"""Per-band leaderboards — psychos compete with psychos (GAME_LOOP).
Redis ZSET per band; shadow exclusion: flagged sessions never write here
(the cheater sees their score, nobody else does — ADR-005)."""
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncConnection

from app.core.settings import settings
from app.db import repo
from app.db.session import get_conn
from app.schemas import LeaderboardEntry, LeaderboardResponse

router = APIRouter(prefix="/leaderboards", tags=["leaderboards"])

BANDS = {"menace", "enthusiast", "flexible", "hero", "whisperer"}


async def zadd_score(band: str, player_id: str, xp: int) -> None:
    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(settings().redis_url)
        await r.zadd(f"leaderboard:{band}:alltime", {player_id: xp})
        await r.aclose()
    except Exception:  # noqa: BLE001 — leaderboards are decorative, never fatal
        pass


@router.get("/{band}", response_model=LeaderboardResponse)
async def top(
    band: str, conn: AsyncConnection = Depends(get_conn),
) -> LeaderboardResponse:
    if band not in BANDS:
        return LeaderboardResponse(band=band, entries=[])
    ids_scores: list[tuple[bytes, float]] = []
    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(settings().redis_url)
        ids_scores = await r.zrevrange(f"leaderboard:{band}:alltime", 0, 9, withscores=True)
        await r.aclose()
    except Exception:  # noqa: BLE001
        pass
    ids = [UUID(i.decode()) for i, _ in ids_scores]
    names = await repo.display_names(conn, ids)
    entries = []
    for raw_id, score in ids_scores:
        pid = raw_id.decode()
        entries.append(LeaderboardEntry(
            display_name=names.get(pid, "Anonymous"),
            xp=int(score),
            level=1 + int(score) // 1500,
        ))
    return LeaderboardResponse(band=band, entries=entries)
