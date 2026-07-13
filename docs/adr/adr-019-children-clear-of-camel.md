# ADR-019: Children are never placed in or near the camel's path
**Status:** accepted
**Amends:** ADR-012 (children as attractors). **Reinforces:** Repo Law 4.
**Context:** ADR-012 permits children as attractors with contact held impossible
by collision masks + the flee system (Repo Law 4). The Max-Rage Resolution
introduces a distinct, high-motion event: the camel walks fixed approach lanes
into the play area and performs a slapstick takedown of the cow. That space is
categorically unsafe for child NPCs — not because contact is possible (masks
still forbid it) but because the child no-contact guarantee must hold visibly
and absolutely, with zero ambiguity, in the one moment the camera is on a
collision.
**Decision:** Child placement is spatially excluded from the camel's space, at
generation time and forever in CI.
1. The gameplay stage places NO child zone inside a camel approach lane, nor
   within a buffer radius of any camel path or the takedown locus. Buffer default
   lives in `shared/tuning/tuning.json` (`camel_child_exclusion_m`), not code.
2. The camel never enters a child zone: its lanes are routed clear of child
   zones by construction; if a candidate lane cannot clear them, the lane is
   rejected and re-routed, never the child zone moved into tolerance.
3. A permanent CI test sits beside the Repo Law 4 suite: for every generated
   district, assert every child zone is outside every camel lane + buffer. A
   district that fails does not ship. This test must never be weakened (Law 4).
**Consequences:** the gameplay layer carries a placement constraint solved
before beer/wine/smashable placement (children first, camel lanes routed around
them, then everything else). A generated district gains a machine-checkable
child-safety property. This records a spatial-separation rule only; it says
nothing about why the camel is present.
