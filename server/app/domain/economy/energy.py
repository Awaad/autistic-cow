"""Energy regen math — pure, State lives in player_profiles
(energy, energy_updated_at); this computes the truth at any instant."""
from __future__ import annotations

from datetime import datetime, timezone

from app.core.tuning import tuning


def energy_now(
    stored: int, updated_at: datetime, now: datetime | None = None,
) -> tuple[int, int]:
    """Returns (current_energy, seconds_until_next). Regen fills toward max."""
    cfg = tuning()["energy"]
    cap = int(cfg["max"])
    regen_s = int(cfg["regen_hours"]) * 3600
    now = now or datetime.now(timezone.utc)
    elapsed = max(0, int((now - updated_at).total_seconds()))
    gained = elapsed // regen_s
    current = min(cap, stored + gained)
    if current >= cap:
        return cap, 0
    return current, regen_s - (elapsed % regen_s)
