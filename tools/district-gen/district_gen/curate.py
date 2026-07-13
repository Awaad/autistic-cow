"""Curation stage.

Reads the generated district and reports whether it SHIPS: the hard perf budget
(≤350 static colliders, ≤250 dynamic bodies), the required invariants (≥2 camel
lanes, child-safety, beer sparsity), and the diff vs the hand-authored
kyrenia-harbor.ts — the curation-cost delta that is the spike's actual finding.

Over budget -> the report fails and says shrink the cell (project --half-extent),
never the frame rate.
"""
from __future__ import annotations

from typing import Any

# Reference counts read from the hand-authored client/src/game/assets/kyrenia-harbor.ts
# (the spike measures the delta from this).
HAND_AUTHORED = {
    "buildings": 19, "palms": 8, "beerSpots": 6, "wineHides": 4,
    "rescueSpots": 8, "childZones": 4, "stallCount": 20, "crateCount": 36,
    "scooterCount": 16,
}

MAX_STATIC_COLLIDERS = 350
MAX_DYNAMIC_BODIES = 250
MAX_DRAW_CALLS = 150
MIN_CAMEL_LANES = 2


def build_curation(d: dict[str, Any]) -> dict[str, Any]:
    colliders = len(d["buildings"])
    dynamic = len(d["smashables"]) + d["stallCount"] + d["crateCount"] + d["scooterCount"]
    # draw calls depend on client instancing (ADR-014): buildings instanced by
    # (wall, roof) variant. Estimate variants + a small fixed overhead.
    variants = len({(b["wall"], b["roof"]) for b in d["buildings"]})
    draw_estimate = variants + 4  # + ground, sea, palms, cow

    budget = {
        "static_colliders": {"value": colliders, "max": MAX_STATIC_COLLIDERS,
                             "ok": colliders <= MAX_STATIC_COLLIDERS},
        "dynamic_bodies": {"value": dynamic, "max": MAX_DYNAMIC_BODIES,
                           "ok": dynamic <= MAX_DYNAMIC_BODIES},
        "draw_calls_estimate": {"value": draw_estimate, "max": MAX_DRAW_CALLS,
                                "ok": draw_estimate <= MAX_DRAW_CALLS,
                                "_note": "estimate assumes ADR-014 instancing by (wall,roof)"},
    }
    invariants = {
        "camel_lanes": {"value": len(d["camelLanes"]), "min": MIN_CAMEL_LANES,
                        "ok": len(d["camelLanes"]) >= MIN_CAMEL_LANES},
        "beer_spots": {"value": len(d["beerSpots"]),
                       "ok": len(d["beerSpots"]) > 0},
        "children_present": {"value": len(d["childZones"]),
                             "ok": len(d["childZones"]) > 0},
    }
    diff = {
        "buildings": {"generated": colliders, "hand_authored": HAND_AUTHORED["buildings"],
                      "ratio": round(colliders / HAND_AUTHORED["buildings"], 2)},
        "beerSpots": {"generated": len(d["beerSpots"]), "hand_authored": HAND_AUTHORED["beerSpots"]},
        "rescueSpots": {"generated": len(d["rescueSpots"]), "hand_authored": HAND_AUTHORED["rescueSpots"]},
        "childZones": {"generated": len(d["childZones"]), "hand_authored": HAND_AUTHORED["childZones"]},
        "new_layers": {"venues": len(d["venues"]), "smashables": len(d["smashables"]),
                       "backdrop": len(d["backdrop"]), "densityZones": len(d["densityZones"])},
    }
    warnings: list[str] = []
    if not budget["static_colliders"]["ok"]:
        warnings.append(f"static colliders {colliders} > {MAX_STATIC_COLLIDERS}: "
                        f"merge more terraces or crop the cell (project --half-extent)")
    if not budget["dynamic_bodies"]["ok"]:
        warnings.append(f"dynamic bodies {dynamic} > {MAX_DYNAMIC_BODIES}: reduce smashable density")
    if not invariants["camel_lanes"]["ok"]:
        warnings.append(f"only {len(d['camelLanes'])} camel lane(s) (need >={MIN_CAMEL_LANES}): "
                        f"crop or curate open corridors")

    ship = (all(v["ok"] for v in budget.values())
            and all(v["ok"] for v in invariants.values()))
    return {"ship": ship, "budget": budget, "invariants": invariants,
            "diff_vs_hand_authored": diff, "warnings": warnings}