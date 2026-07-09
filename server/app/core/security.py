"""Auth primitives.

argon2id password hashing + JWT access/refresh. Anonymous players get a
real JWT with anon=True so pre-signup traffic is authenticated,
rate-limitable, and mergeable at the wall.
"""
from __future__ import annotations

import time
from typing import Any
from uuid import UUID

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.core.settings import settings

_ph = PasswordHasher()  # argon2id defaults


def hash_password(raw: str) -> str:
    return _ph.hash(raw)


def verify_password(raw: str, hashed: str) -> bool:
    try:
        return _ph.verify(hashed, raw)
    except VerifyMismatchError:
        return False


def _make_jwt(claims: dict[str, Any], ttl_s: int) -> str:
    now = int(time.time())
    return jwt.encode(
        {**claims, "iat": now, "exp": now + ttl_s},
        settings().jwt_secret,
        algorithm="HS256",
    )


def access_token(player_id: UUID, *, anon: bool = False) -> str:
    return _make_jwt({"sub": str(player_id), "anon": anon, "typ": "access"},
                     settings().jwt_access_ttl_s)


def refresh_token(player_id: UUID) -> str:
    return _make_jwt({"sub": str(player_id), "typ": "refresh"},
                     settings().jwt_refresh_ttl_s)


def decode(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings().jwt_secret, algorithms=["HS256"])
