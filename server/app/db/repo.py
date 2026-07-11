"""Repositories — the only place SQL lives. All IDs via core.ids (ADR-001).
Event inserts are append-only (ADR-004); idempotent on (session_id, event_id)."""
from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

from app.core.ids import new_id
from app.core.tuning import tuning


async def create_anon_player(conn: AsyncConnection, locale: str) -> UUID:
    pid = new_id()
    await conn.execute(
        text("""INSERT INTO players (id, is_anonymous, locale, status)
                VALUES (:id, true, :locale, 'active')"""),
        {"id": pid, "locale": locale},
    )
    await conn.execute(
        text("INSERT INTO player_profiles (player_id) VALUES (:id)"),
        {"id": pid},
    )
    return pid


async def touch_last_seen(conn: AsyncConnection, player_id: UUID) -> None:
    await conn.execute(
        text("UPDATE players SET last_seen_at = now() WHERE id = :id"),
        {"id": player_id},
    )


async def active_district(conn: AsyncConnection, slug: str) -> UUID | None:
    row = (
        await conn.execute(
            text("SELECT id FROM districts WHERE slug = :slug AND active"),
            {"slug": slug},
        )
    ).first()
    return row[0] if row else None


async def create_session(
    conn: AsyncConnection, player_id: UUID, district_id: UUID,
    spawn_seed: int, tuning_version: str, locale: str,
) -> UUID:
    sid = new_id()
    await conn.execute(
        text("""INSERT INTO sessions (id, player_id, district_id, spawn_seed,
                                      tuning_version, locale)
                VALUES (:id, :pid, :did, :seed, :tv, :loc)"""),
        {"id": sid, "pid": player_id, "did": district_id,
         "seed": spawn_seed, "tv": tuning_version, "loc": locale},
    )
    return sid


async def insert_judge_events(
    conn: AsyncConnection, session_id: UUID, player_id: UUID,
    events: list[dict[str, Any]],
) -> int:
    weights: dict[str, float] = tuning()["judge"]["karma_weights"]
    inserted = 0
    for e in events:
        res = await conn.execute(
            text("""INSERT INTO judge_events
                      (event_id, session_id, player_id, event_type, target_kind,
                       rage_at_event, karma_weight, seq_in_session, client_ts)
                    VALUES (:eid, :sid, :pid, :etype, :tk, :rage, :kw, :seq, :cts)
                    ON CONFLICT (session_id, event_id) DO NOTHING"""),
            {"eid": e["event_id"], "sid": session_id, "pid": player_id,
             "etype": e["event_type"], "tk": e.get("target_kind"),
             "rage": e["rage_at_event"],
             "kw": weights.get(e["event_type"], 0.0),
             "seq": e["seq_in_session"], "cts": e.get("client_ts")},
        )
        inserted += res.rowcount or 0
    return inserted


async def session_axis(conn: AsyncConnection, player_id: UUID) -> float:
    row = (
        await conn.execute(
            text("""SELECT COALESCE(SUM(karma_weight), 0) FROM judge_events
                    WHERE player_id = :pid"""),
            {"pid": player_id},
        )
    ).first()
    v = float(row[0]) if row else 0.0
    return max(-1.0, min(1.0, v))


async def end_session(
    conn: AsyncConnection, session_id: UUID, player_id: UUID,
    destruction: int, rescue: int, peak_rage: int, nerves_lost: int,
    end_reason: str,
) -> dict[str, Any]:
    from app.domain.economy.levels import level_for
    from app.domain.judge.axis import band_for
 
    res = await conn.execute(
        text("""UPDATE sessions SET ended_at = now(), end_reason = :reason,
                  destruction_score = :d, rescue_score = :r,
                  peak_rage = :pr, nerves_lost = :nl
                WHERE id = :sid AND player_id = :pid AND ended_at IS NULL"""),
        {"reason": end_reason, "d": destruction, "r": rescue,
         "pr": peak_rage, "nl": nerves_lost, "sid": session_id, "pid": player_id},
    )
    if res.rowcount == 0:
        # already ended, or not this player's session: idempotent replay —
        # return current truth, award NOTHING twice.
        row = (
            await conn.execute(
                text("""SELECT xp, level, moral_axis, axis_band
                        FROM player_profiles WHERE player_id = :pid"""),
                {"pid": player_id},
            )
        ).first()
        if row is None:
            return {"xp": 0, "level": 1, "level_up": False,
                    "moral_axis": 0.0, "axis_band": "flexible"}
        return {"xp": int(row[0]), "level": int(row[1]), "level_up": False,
                "moral_axis": float(row[2]), "axis_band": str(row[3])}
 
    xp_gain = max(0, destruction) + max(0, rescue)  # direction-blind (ADR-013)
    axis = await session_axis(conn, player_id)
    row = (
        await conn.execute(
            text("""UPDATE player_profiles SET
                      total_sessions = total_sessions + 1,
                      total_destruction_score = total_destruction_score + :d,
                      total_rescue_score = total_rescue_score + :r,
                      xp = xp + :xp,
                      moral_axis = :axis,
                      axis_band = :band,
                      updated_at = now()
                    WHERE player_id = :pid
                    RETURNING xp, level"""),
            {"d": destruction, "r": rescue, "xp": xp_gain,
             "axis": axis, "band": band_for(axis), "pid": player_id},
        )
    ).first()
    xp, old_level = (int(row[0]), int(row[1])) if row else (xp_gain, 1)
    new_level = level_for(xp)
    if new_level != old_level:
        await conn.execute(
            text("UPDATE player_profiles SET level = :lv WHERE player_id = :pid"),
            {"lv": new_level, "pid": player_id},
        )
    return {"xp": xp, "level": new_level, "level_up": new_level > old_level,
            "moral_axis": axis, "axis_band": band_for(axis)}
