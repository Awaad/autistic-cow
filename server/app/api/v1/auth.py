"""Auth — email-first (OAuth behind flags, Later when consoles
approve). Signup consumes the parked merge token: the anonymous profile with
all its judged history becomes the account. She remembers you — literally."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncConnection

from app.core.ids import new_token
from app.core.security import access_token, decode, hash_password, refresh_token, verify_password
from app.core.settings import settings
from app.db import repo
from app.db.session import get_conn
from app.schemas import (
    AnonRequest, AnonResponse, AuthTokens, LoginRequest, RefreshRequest, SignupRequest,
)

log = logging.getLogger("auth")
router = APIRouter(prefix="/auth", tags=["auth"])

MIN_AGE = 18


async def _redis():
    import redis.asyncio as aioredis
    return aioredis.from_url(settings().redis_url)


@router.post("/anon", response_model=AnonResponse)
async def create_anon_identity(
    body: AnonRequest, conn: AsyncConnection = Depends(get_conn)
) -> AnonResponse:
    locale = body.locale.value if body.locale else "en"
    pid = await repo.create_anon_player(conn, locale)
    merge = new_token()
    try:
        r = await _redis()
        await r.set(f"anon:merge:{merge}", str(pid), ex=60 * 60 * 24)
        await r.aclose()
    except Exception:  # noqa: BLE001
        log.warning("redis unavailable; merge token not persisted")
    return AnonResponse(player_id=str(pid), access_token=access_token(pid, anon=True), merge_token=merge)


@router.post("/signup", response_model=AuthTokens)
async def signup(body: SignupRequest, conn: AsyncConnection = Depends(get_conn)) -> AuthTokens:
    if datetime.now(timezone.utc).year - body.birth_year < MIN_AGE:
        raise HTTPException(403, "18+ only")  # year-only check; minimal PII by design
    if await repo.player_by_email(conn, str(body.email)):
        raise HTTPException(409, "email already registered")

    ph = hash_password(body.password)
    locale = body.locale.value if body.locale else "en"

    pid: UUID | None = None
    if body.merge_token:
        try:
            r = await _redis()
            raw = await r.get(f"anon:merge:{body.merge_token}")
            if raw:
                candidate = UUID(raw.decode())
                if await repo.upgrade_anon_to_registered(
                    conn, candidate, str(body.email), ph, body.birth_year,
                    body.display_name, locale,
                ):
                    pid = candidate  # the anon history is now the account
                await r.delete(f"anon:merge:{body.merge_token}")
            await r.aclose()
        except HTTPException:
            raise
        except Exception:  # noqa: BLE001 — merge is best-effort; signup never fails on redis
            log.warning("merge unavailable; fresh account created")
    if pid is None:
        pid = await repo.create_registered_player(
            conn, str(body.email), ph, body.birth_year, body.display_name, locale,
        )
    # functional ToS consent is signup itself — recorded for the audit trail
    await repo.set_consent(conn, pid, "functional_tos", True, "signup", settings().policy_version)
    return AuthTokens(
        player_id=str(pid), access_token=access_token(pid),
        refresh_token=refresh_token(pid), display_name=body.display_name,
    )


@router.post("/login", response_model=AuthTokens)
async def login(body: LoginRequest, conn: AsyncConnection = Depends(get_conn)) -> AuthTokens:
    p = await repo.player_by_email(conn, str(body.email))
    if not p or not p["password_hash"] or not verify_password(body.password, p["password_hash"]):
        raise HTTPException(401, "invalid credentials")
    if p["status"] in ("orphaned", "deleted"):
        raise HTTPException(401, "invalid credentials")
    await repo.touch_last_seen(conn, p["id"])
    return AuthTokens(
        player_id=str(p["id"]), access_token=access_token(p["id"]),
        refresh_token=refresh_token(p["id"]), display_name=p["display_name"] or "",
    )


@router.post("/refresh", response_model=AuthTokens)
async def refresh(body: RefreshRequest) -> AuthTokens:
    try:
        claims = decode(body.refresh_token)
        if claims.get("typ") != "refresh":
            raise ValueError("not a refresh token")
        pid = UUID(claims["sub"])
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(401, "invalid refresh token") from exc
    return AuthTokens(
        player_id=str(pid), access_token=access_token(pid),
        refresh_token=refresh_token(pid), display_name="",
    )
