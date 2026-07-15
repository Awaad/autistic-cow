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


def _coerce_ts(v: Any) -> Any:
    """Accepts datetime, ISO string (incl. 'Z'), or None. Exists because a
    serialization-mode mismatch once shipped strings here twice."""
    from datetime import datetime
    if v is None or isinstance(v, datetime):
        return v
    return datetime.fromisoformat(str(v).replace("Z", "+00:00"))


def _coerce_enum(v: Any) -> str | None:
    return None if v is None else (v.value if hasattr(v, "value") else str(v))


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
             "etype": _coerce_enum(e["event_type"]), "tk": e.get("target_kind"),
             "rage": e["rage_at_event"],
             "kw": weights.get(_coerce_enum(e["event_type"]) or "", 0.0),
             "seq": e["seq_in_session"], "cts": _coerce_ts(e.get("client_ts"))},
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


async def anon_session_count(conn: AsyncConnection, player_id: UUID) -> int | None:
    """Sessions STARTED by this player if anonymous; None if registered."""
    row = (
        await conn.execute(
            text("""SELECT p.is_anonymous, count(s.id)
                    FROM players p LEFT JOIN sessions s ON s.player_id = p.id
                    WHERE p.id = :pid GROUP BY p.is_anonymous"""),
            {"pid": player_id},
        )
    ).first()
    if row is None or not row[0]:
        return None
    return int(row[1])


async def insert_photo(
    conn: AsyncConnection, player_id: UUID, storage_key: str, purpose: str,
    label: str | None, confidence: float | None, auth_score: float,
    bonus_tier: str, in_herd: bool, session_id: UUID | None,
) -> UUID:
    pid = new_id()
    await conn.execute(
        text("""INSERT INTO photos (id, player_id, storage_key, purpose,
                  classifier_label, classifier_confidence, authenticity_score,
                  bonus_tier, in_herd, session_id)
                VALUES (:id, :pl, :sk, :pu, :cl, :cc, :au, :bt, :ih, :se)"""),
        {"id": pid, "pl": player_id, "sk": storage_key, "pu": purpose,
         "cl": label, "cc": confidence, "au": auth_score, "bt": bonus_tier,
         "ih": in_herd, "se": session_id},
    )
    return pid


async def insert_quarantine(
    conn: AsyncConnection, photo_id: UUID, capture_source: str,
    device_hint: str | None, exif_device: str | None, exif_present: bool,
    delta_s: int | None, gps_region: str | None, phash: str,
) -> None:
    await conn.execute(
        text("""INSERT INTO photo_meta_quarantine
                  (photo_id, capture_source, device_hint, exif_device,
                   exif_present, exif_datetime_delta_s, gps_region, phash,
                   purge_after)
                VALUES (:id, :cs, :dh, :ed, :ep, :dl, :gr, :ph,
                        now() + interval '30 days')"""),
        {"id": photo_id, "cs": capture_source, "dh": device_hint, "ed": exif_device,
         "ep": exif_present, "dl": delta_s, "gr": gps_region, "ph": phash},
    )


async def phash_seen(conn: AsyncConnection, player_id: UUID, phash: str) -> bool:
    row = (
        await conn.execute(
            text("""SELECT 1 FROM photo_meta_quarantine q
                    JOIN photos p ON p.id = q.photo_id
                    WHERE p.player_id = :pl AND q.phash = :ph LIMIT 1"""),
            {"pl": player_id, "ph": phash},
        )
    ).first()
    return row is not None


async def grant_photo_energy(conn: AsyncConnection, player_id: UUID) -> bool:
    """+1 energy for a passing LIVE photo, once per UTC day (tuning cap=1)."""
    res = await conn.execute(
        text("""UPDATE player_profiles
                SET energy = energy + 1,
                    photo_energy_granted_on = current_date
                WHERE player_id = :pid
                  AND (photo_energy_granted_on IS NULL
                       OR photo_energy_granted_on < current_date)"""),
        {"pid": player_id},
    )
    return bool(res.rowcount)


async def herd_consented(conn: AsyncConnection, player_id: UUID) -> bool:
    c = await latest_consents(conn, player_id)
    return bool(c.get("herd_album"))
