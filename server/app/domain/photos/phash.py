"""Average-hash for duplicate detection ("recycled love"). 64-bit hex."""
from __future__ import annotations

import io

from PIL import Image


def average_hash(data: bytes) -> str:
    img = Image.open(io.BytesIO(data)).convert("L").resize((8, 8))
    px = list(img.getdata())
    avg = sum(px) / 64
    bits = 0
    for i, p in enumerate(px):
        if p > avg:
            bits |= 1 << i
    return f"{bits:016x}"


def hamming(a: str, b: str) -> int:
    return bin(int(a, 16) ^ int(b, 16)).count("1")
