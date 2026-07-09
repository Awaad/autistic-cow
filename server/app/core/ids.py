"""Centralized ID generation — ADR-001 / ADR-007.

UUIDv7 (time-ordered) for B-tree locality on hot tables.
Backed by uuid-utils until Python 3.14 stdlib / PG18 native uuidv7().
Swapping the backend is a change to THIS FILE ONLY.

Rule: IDs are identifiers, never secrets. Shareable/guessing-sensitive
tokens (merge tokens, signed URLs) use `new_token()` instead.
"""
from __future__ import annotations

import secrets
from uuid import UUID

import uuid_utils


def new_id() -> UUID:
    """Time-ordered UUIDv7. Use for every primary key."""
    return UUID(bytes=uuid_utils.uuid7().bytes)


def new_token(nbytes: int = 16) -> str:
    """Opaque random token (128-bit default). For secrets, never for PKs."""
    return secrets.token_urlsafe(nbytes)
