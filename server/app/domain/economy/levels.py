"""Level curve — direction-blind XP (ADR-013). Curve lives in tuning."""
from app.core.tuning import tuning


def level_for(xp: int) -> int:
    cfg = tuning().get("levels", {"xp_per_level": 400, "max_level": 30})
    return min(int(cfg["max_level"]), 1 + max(0, xp) // int(cfg["xp_per_level"]))


def naming_unlocked(level: int) -> bool:
    return level >= 3
