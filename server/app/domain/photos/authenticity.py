"""Authenticity scoring — fraud prevention, functional (always on).
SOFT enforcement only: low score = reduced reward, never accusation,
never hard block. EXIF-missing is NEUTRAL (browsers strip it)."""
from __future__ import annotations

from dataclasses import dataclass

from app.core.tuning import tuning


@dataclass(frozen=True)
class AuthenticityInput:
    live_capture: bool            # client claims getUserMedia (weak but a signal)
    exif_present: bool
    exif_device_matches_ua: bool | None   # None = can't tell
    capture_upload_delta_s: int | None    # |EXIF time - now|; None = no EXIF time
    phash_duplicate: bool                 # seen this exact image before (this player)


def score(sig: AuthenticityInput) -> float:
    s = 0.5                                # neutral start; EXIF absence stays here
    if sig.live_capture:
        s += 0.25
    if sig.exif_present:
        s += 0.05
        if sig.exif_device_matches_ua is True:
            s += 0.10
        if sig.capture_upload_delta_s is not None:
            if sig.capture_upload_delta_s < 300:
                s += 0.15                  # taken just now: strongest honest signal
            elif sig.capture_upload_delta_s > 86400 * 30:
                s -= 0.10                  # month-old photo: fine, slightly less fresh
    if sig.phash_duplicate:
        s -= 0.35                          # recycled love. she can tell.
    return max(0.0, min(1.0, s))


def tier_for(auth_score: float, is_animal: bool) -> str:
    if not is_animal:
        return "rejected"
    th = tuning()["photos"]["authenticity_thresholds"]
    if auth_score >= float(th["full"]):
        return "full"
    if auth_score >= float(th["reduced"]):
        return "reduced"
    return "reduced"                       # soft floor: an animal photo never hard-fails
