"""arq worker — photo pipeline + retention jobs (docs/02 §1, §4)."""
from __future__ import annotations
 
import logging
 
from arq import cron
from arq.connections import RedisSettings
from sqlalchemy import text
 
from app.core.settings import settings
from app.db.session import engine
 
log = logging.getLogger("workers")
 
 
async def process_photo(ctx: dict, photo_id: str) -> None:
    """ EXIF quarantine -> authenticity -> classifier -> strip -> store.
    Precise GPS lives in memory only; gps_region coarsened to disk."""
 
 
async def close_stale_sessions(ctx: dict) -> None:
    """Sessions abandoned without an end call (tab killed, network death,
    pagehide lost): close as 'error' after 30 minutes. No XP path — the
    profile is only ever paid through the idempotent end_session flow."""
    async with engine().begin() as conn:
        res = await conn.execute(
            text("""UPDATE sessions SET ended_at = now(), end_reason = 'error'
                    WHERE ended_at IS NULL
                      AND started_at < now() - interval '30 minutes'""")
        )
        if res.rowcount:
            log.info("closed %d stale sessions", res.rowcount)
 
 
async def retention_sweep(ctx: dict) -> None:
    """Nightly. Warn at 150d, orphan at 180d (docs/02 retention job)."""
    async with engine().begin() as conn:
        warned = await conn.execute(
            text("""UPDATE players SET status = 'dormant_warned'
                    WHERE status = 'active'
                      AND last_seen_at < now() - interval '150 days'
                    RETURNING id""")
        )
        for (pid,) in warned:
            # real email ("your herd misses you")
            log.info("dormancy warning due for player %s", pid)
 
        orphaned = await conn.execute(
            text("""UPDATE players SET
                      email = NULL, password_hash = NULL,
                      display_name = 'deleted_' || left(id::text, 8),
                      status = 'orphaned', orphaned_at = now()
                    WHERE status IN ('active', 'dormant_warned')
                      AND last_seen_at < now() - interval '180 days'
                    RETURNING id""")
        )
        ids = [row[0] for row in orphaned]
        if ids:
            await conn.execute(
                text("""UPDATE player_profiles SET cow_name = NULL
                        WHERE player_id = ANY(:ids)"""),
                {"ids": ids},
            )
            # Later delete Herd objects from object storage for these ids
            log.info("orphaned %d players (identity nulled, cow_name cleared)", len(ids))
 
 
async def purge_photo_meta(ctx: dict) -> None:
    """Nightly: EXIF quarantine rows past their purge date are deleted."""
    async with engine().begin() as conn:
        res = await conn.execute(
            text("DELETE FROM photo_meta_quarantine WHERE purge_after < now()")
        )
        if res.rowcount:
            log.info("purged %d quarantine rows", res.rowcount)
 
 
class WorkerSettings:
    functions = [process_photo, close_stale_sessions, retention_sweep, purge_photo_meta]
    redis_settings = RedisSettings.from_dsn(settings().redis_url)
    cron_jobs = [
        cron(close_stale_sessions, minute={0, 30}),        # every half hour
        cron(retention_sweep, hour=3, minute=0),           # nightly, quiet hours
        cron(purge_photo_meta, hour=3, minute=30),
    ]
 