"""Animal classifier seam. Production model (ONNX MobileNet or a vision API)
plugs in via AnimalClassifier; the HEURISTIC below is an honest placeholder:
it verifies the upload is a plausible photograph (decodes, reasonable size,
non-flat color variance) and defers the pet/not-pet call with mid confidence.
Swapping the model is a one-line change in photos.py — that seam existing IS
the deliverable of this stub."""
from __future__ import annotations

import io
from dataclasses import dataclass
from typing import Protocol

from PIL import Image


@dataclass(frozen=True)
class Classification:
    label: str           # 'dog' | 'cat' | 'animal' | 'not_animal' | 'unreadable'
    confidence: float
    is_animal: bool


class AnimalClassifier(Protocol):
    def classify(self, data: bytes) -> Classification: ...


class HeuristicClassifier:
    """Plausible-photo gate; generous on the animal question by design
    (soft enforcement) until the real model lands."""

    def classify(self, data: bytes) -> Classification:
        try:
            img = Image.open(io.BytesIO(data)).convert("L")
        except Exception:  # noqa: BLE001
            return Classification("unreadable", 1.0, False)
        w, h = img.size
        if w < 64 or h < 64:
            return Classification("not_animal", 0.7, False)
        small = list(img.resize((16, 16)).getdata())
        mean = sum(small) / 256
        variance = sum((p - mean) ** 2 for p in small) / 256
        if variance < 40:  # near-flat image: screenshot of a blank page, not a pet
            return Classification("not_animal", 0.6, False)
        return Classification("animal", 0.55, True)


classifier: AnimalClassifier = HeuristicClassifier()
