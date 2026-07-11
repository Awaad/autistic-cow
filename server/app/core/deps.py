"""FastAPI dependencies: bearer auth (anon or full), db connection."""
from uuid import UUID

from fastapi import Depends, HTTPException, Request

from app.core.security import decode


def current_player(request: Request) -> UUID:
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "missing bearer token")
    try:
        claims = decode(auth.removeprefix("Bearer "))
        return UUID(claims["sub"])
    except Exception as exc:  # noqa: BLE001 — any decode failure is a 401
        raise HTTPException(401, "invalid token") from exc


CurrentPlayer = Depends(current_player)
