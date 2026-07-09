"""Auth routes. Anonymous-first: /auth/anon issues a real (anon) identity
so the landing-page player is a first-class citizen from second one.
Merge flow per 04_ARCHITECTURE §6.2 — Stage 3 completes signup/oauth."""
from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.ids import new_id, new_token
from app.core.security import access_token

router = APIRouter(prefix="/auth", tags=["auth"])


class AnonSessionOut(BaseModel):
    player_id: str
    access_token: str
    merge_token: str  # client holds this; presented at signup to absorb profile


@router.post("/anon", response_model=AnonSessionOut)
async def create_anon_identity() -> AnonSessionOut:
    pid = new_id()
    # Later: persist anon merge_token -> Redis anon:merge:{token} (TTL 24h)
    return AnonSessionOut(
        player_id=str(pid),
        access_token=access_token(pid, anon=True),
        merge_token=new_token(),
    )

# Stage 3: POST /auth/signup, /auth/login, /auth/refresh, /auth/merge,
#          GET /auth/oauth/{google|apple} — see docs/03 Stage 3.
