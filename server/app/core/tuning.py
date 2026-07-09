"""Loads shared/tuning/tuning.json, the single source of gameplay numbers.
Sessions pin tuning_version at start."""
import json
from functools import lru_cache
from pathlib import Path
from typing import Any

_TUNING_PATH = Path(__file__).resolve().parents[3] / "shared" / "tuning" / "tuning.json"


@lru_cache
def tuning() -> dict[str, Any]:
    return json.loads(_TUNING_PATH.read_text())
