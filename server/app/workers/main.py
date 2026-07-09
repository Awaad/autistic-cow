"""arq worker — photo pipeline + retention jobs (docs/02 §1, §4)."""
from __future__ import annotations

from arq.connections import RedisSettings

from app.core.settings import settings


async def process_photo(ctx: dict, photo_id: str) -> None:
    """Stage 4: EXIF quarantine -> authenticity -> classifier -> strip -> store.
    Precise GPS lives in memory only; gps_region coarsened to disk."""


async def retention_sweep(ctx: dict) -> None:
    """Nightly: 150d -> dormant_warned (+email), 180d -> orphan.
    Orphan = null identity, delete Herd objects, keep behavior layer."""


async def purge_photo_meta(ctx: dict) -> None:
    """Nightly: delete photo_meta_quarantine rows past purge_after."""


class WorkerSettings:
    functions = [process_photo, retention_sweep, purge_photo_meta]
    redis_settings = RedisSettings.from_dsn(settings().redis_url)
    cron_jobs: list = []  # Wire retention_sweep + purge nightly
