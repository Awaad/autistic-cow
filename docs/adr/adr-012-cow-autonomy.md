# ADR-012: The cow is autonomous; the player is restraint
**Status:** accepted (proven in Stage 1 playable)
**Context:** Vehicle-style controls made destruction a chore and morality a
menu. Playtesting the grey box showed steering-toward-targets is dead time.
**Decision:** The cow always moves and always wants something (nearest
attractor). Two band-scaled forces contest the heading each frame: her SEEK
(grows with rage) and the player's AUTHORITY (shrinks with rage). Player
correction applies last. Target ratios: serene ~17x (obedient), irritated
~3.75x (noticeable), furious ~1.55x (contestable fight), berserk ~0.2x
(passenger). Ratios live in tuning.json and are the core game balance.
**Consequences:** Morality becomes physical (saving = fighting her for the
wheel); the Judge's richest signal becomes steering telemetry (fought /
yielded / hesitated). Stage 2 attractor taxonomy (cars, florist, children,
scooters — weighted, karma-tagged) becomes THE content system. Children as
attractors are permitted: wanting is judged, contact remains impossible
(collision masks + flee system, Repo Law 4).
