# ADR-004: Append-only judge/telemetry log
**Status:** accepted
**Context:** moral_axis must be recomputable after karma retuning; cheat
forensics need a tamper-evident trail; insert-only tables partition cleanly.
**Decision:** No UPDATE/DELETE on event tables. Corrections are compensating
rows (`event_invalidated` referencing the original). Mutable aggregates
(profiles, session totals) are caches derived from the log; the log is truth.
**Consequences:** recomputability, forensics, cheap writes; storage growth
handled by monthly partitions + 90d rollups (docs/02).
