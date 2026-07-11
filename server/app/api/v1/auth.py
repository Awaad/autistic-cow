"""Auth routes — Anonymous-first: /auth/anon persists a real player
row so the landing-page player is first-class from second one. Merge token
parked in Redis (24h) for the Stage 3 Drop 2 signup wall."""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncConnection

from app.core.ids import new_token
from app.core.security import access_token
from app.core.settings import settings
from app.db.repo import create_anon_player
from app.db.session import get_conn

log = logging.getLogger("auth")
router = APIRouter(prefix="/auth", tags=["auth"])


class AnonIn(BaseModel):
    locale: str = "en"


class AnonSessionOut(BaseModel):
    player_id: str
    access_token: str
    merge_token: str


@router.post("/anon", response_model=AnonSessionOut)
async def create_anon_identity(
    body: AnonIn, conn: AsyncConnection = Depends(get_conn)
) -> AnonSessionOut:
    locale = body.locale if body.locale in ("en", "de", "ru") else "en"
    pid = await create_anon_player(conn, locale)
    merge = new_token()
    try:
        import redis.asyncio as aioredis

        r = aioredis.from_url(settings().redis_url)
        await r.set(f"anon:merge:{merge}", str(pid), ex=60 * 60 * 24)
        await r.aclose()
    except Exception:  # noqa: BLE001 — merge is Drop 2; dev without redis still plays
        log.warning("redis unavailable; merge token not persisted")
    return AnonSessionOut(
        player_id=str(pid),
        access_token=access_token(pid, anon=True),
        merge_token=merge,
    )

# Next: POST /auth/signup, /auth/login, /auth/refresh, /auth/merge, oauth.
