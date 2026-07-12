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


async def upgrade_anon_to_registered(
    conn: AsyncConnection, player_id: UUID, email: str, password_hash: str,
    birth_year: int, display_name: str, locale: str,
) -> bool:
    res = await conn.execute(
        text("""UPDATE players SET email = :em, password_hash = :ph,
                  birth_year = :by, display_name = :dn, locale = :loc,
                  is_anonymous = false, auth_provider = 'email'
                WHERE id = :pid AND is_anonymous"""),
        {"em": email, "ph": password_hash, "by": birth_year,
         "dn": display_name, "loc": locale, "pid": player_id},
    )
    return bool(res.rowcount)


async def create_registered_player(
    conn: AsyncConnection, email: str, password_hash: str,
    birth_year: int, display_name: str, locale: str,
) -> UUID:
    pid = new_id()
    await conn.execute(
        text("""INSERT INTO players (id, email, password_hash, birth_year,
                                     display_name, locale, is_anonymous, auth_provider)
                VALUES (:id, :em, :ph, :by, :dn, :loc, false, 'email')"""),
        {"id": pid, "em": email, "ph": password_hash, "by": birth_year,
         "dn": display_name, "loc": locale},
    )
    await conn.execute(
        text("INSERT INTO player_profiles (player_id) VALUES (:id)"), {"id": pid},
    )
    return pid


async def player_by_email(conn: AsyncConnection, email: str) -> dict[str, Any] | None:
    row = (
        await conn.execute(
            text("""SELECT id, password_hash, display_name, status FROM players
                    WHERE email = :em AND NOT is_anonymous"""),
            {"em": email},
        )
    ).first()
    if row is None:
        return None
    return {"id": row[0], "password_hash": row[1], "display_name": row[2], "status": row[3]}


async def set_consent(
    conn: AsyncConnection, player_id: UUID, key: str, granted: bool,
    source: str, policy_version: str,
) -> None:
    await conn.execute(
        text("""INSERT INTO consents (player_id, consent_key, granted, source, policy_version)
                VALUES (:pid, :key, :g, :src, :pv)"""),
        {"pid": player_id, "key": key, "g": granted, "src": source, "pv": policy_version},
    )


async def latest_consents(conn: AsyncConnection, player_id: UUID) -> dict[str, bool]:
    rows = await conn.execute(
        text("""SELECT DISTINCT ON (consent_key) consent_key, granted
                FROM consents WHERE player_id = :pid
                ORDER BY consent_key, created_at DESC"""),
        {"pid": player_id},
    )
    return {str(k): bool(g) for k, g in rows}



async def spend_energy(conn: AsyncConnection, player_id: UUID) -> tuple[int, int] | None:
    """Compute regen, spend 1. Returns (remaining, next_in_s) or None if broke."""
    from app.domain.economy.energy import energy_now

    row = (
        await conn.execute(
            text("""SELECT energy, energy_updated_at FROM player_profiles
                    WHERE player_id = :pid FOR UPDATE"""),
            {"pid": player_id},
        )
    ).first()
    if row is None:
        return None
    current, next_in = energy_now(int(row[0]), row[1])
    if current <= 0:
        return None if next_in else None
    await conn.execute(
        text("""UPDATE player_profiles SET energy = :e, energy_updated_at = now()
                WHERE player_id = :pid"""),
        {"e": current - 1, "pid": player_id},
    )
    return current - 1, next_in


async def profile_me(conn: AsyncConnection, player_id: UUID) -> dict[str, Any] | None:
    row = (
        await conn.execute(
            text("""SELECT p.display_name, p.is_anonymous, pr.level, pr.xp,
                           pr.axis_band, pr.cow_name, pr.energy, pr.energy_updated_at
                    FROM players p JOIN player_profiles pr ON pr.player_id = p.id
                    WHERE p.id = :pid"""),
            {"pid": player_id},
        )
    ).first()
    if row is None:
        return None
    from app.domain.economy.energy import energy_now
    from app.core.tuning import tuning
    e, nxt = energy_now(int(row[6]), row[7])
    return {
        "player_id": str(player_id),
        "display_name": row[0] or "Anonymous",
        "is_anonymous": bool(row[1]),
        "level": int(row[2]), "xp": int(row[3]),
        "axis_band": str(row[4]), "cow_name": row[5],
        "energy": {"energy": e, "energy_max": int(tuning()["energy"]["max"]),
                   "next_energy_in_s": nxt},
    }


async def orphan_player(conn: AsyncConnection, player_id: UUID) -> None:
    """User-initiated deletion: same procedure as the retention sweep."""
    await conn.execute(
        text("""UPDATE players SET email = NULL, password_hash = NULL,
                  display_name = 'deleted_' || left(id::text, 8),
                  status = 'orphaned', orphaned_at = now()
                WHERE id = :pid"""),
        {"pid": player_id},
    )
    await conn.execute(
        text("UPDATE player_profiles SET cow_name = NULL WHERE player_id = :pid"),
        {"pid": player_id},
    )


async def export_bundle(conn: AsyncConnection, player_id: UUID) -> dict[str, Any]:
    prof = await profile_me(conn, player_id)
    sessions = [
        dict(r._mapping) for r in await conn.execute(
            text("""SELECT id, started_at, ended_at, end_reason, destruction_score,
                           rescue_score, peak_rage, nerves_lost FROM sessions
                    WHERE player_id = :pid ORDER BY started_at"""),
            {"pid": player_id},
        )
    ]
    events = [
        dict(r._mapping) for r in await conn.execute(
            text("""SELECT event_type, target_kind, rage_at_event, seq_in_session,
                           created_at FROM judge_events
                    WHERE player_id = :pid ORDER BY id LIMIT 10000"""),
            {"pid": player_id},
        )
    ]
    consents = await latest_consents(conn, player_id)
    return {"profile": prof, "sessions": sessions, "judge_events": events,
            "consents": consents}


async def display_names(conn: AsyncConnection, ids: list[UUID]) -> dict[str, str]:
    if not ids:
        return {}
    rows = await conn.execute(
        text("SELECT id, display_name, is_anonymous FROM players WHERE id = ANY(:ids)"),
        {"ids": ids},
    )
    return {str(i): ("Anonymous" if anon or not dn else dn) for i, dn, anon in rows}
