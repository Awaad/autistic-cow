"""Session lifecycle — server-authoritative (ADR-003). The client proposes,
this file disposes: seeds issued here, events land append-only here, the
end-of-session verdict (xp, level, axis band) is computed here."""
from __future__ import annotations

import secrets
from datetime import datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncConnection

from app.core.deps import current_player
from app.core.dispatch import DomainEvent, dispatcher
from app.core.ids import new_token
from app.core.settings import settings
from app.core.tuning import tuning
from app.db import repo
from app.db.session import get_conn
from app.schemas import EventBatch, SessionEndRequest, SessionEndResponse, SessionStartResponse
from app.schemas.gen.sessions_schema import EventType

router = APIRouter(prefix="/sessions", tags=["sessions"])

