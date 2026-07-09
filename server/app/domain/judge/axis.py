"""Moral axis computation — pure function over the judge-event log.

Derived, never stored as truth: the log is truth (ADR-004); this recomputes.
Recency weighting: last N sessions carry `recency_weight` of the total.
"""
from __future__ import annotations

from app.core.tuning import tuning

AXIS_BANDS = [
    (-1.0, -0.6, "menace"),
    (-0.6, -0.2, "enthusiast"),
    (-0.2, 0.2, "flexible"),
    (0.2, 0.6, "hero"),
    (0.6, 1.01, "whisperer"),
]


def clamp(v: float, lo: float = -1.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, v))


def band_for(axis: float) -> str:
    for lo, hi, name in AXIS_BANDS:
        if lo <= axis < hi:
            return name
    return "flexible"


def compute_axis(
    recent_events: list[str], older_events: list[str]
) -> float:
    """`recent_events`/`older_events`: event_type lists from the log,
    split at the recency-session boundary."""
    weights: dict[str, float] = tuning()["judge"]["karma_weights"]
    w_recent = float(tuning()["judge"]["recency_weight"])

    def score(events: list[str]) -> float:
        return clamp(sum(weights.get(e, 0.0) for e in events))

    return clamp(w_recent * score(recent_events) + (1 - w_recent) * score(older_events))
