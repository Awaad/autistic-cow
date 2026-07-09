# ADR-009: In-process domain-event dispatcher, arq-backed
**Status:** accepted
**Context:** Side effects of domain events (session_ended → axis recompute,
leaderboards, analytics) must not couple to emitting services. Kafka/RabbitMQ
at our scale is questionable.
**Decision:** `core/dispatch.py` dispatcher; handlers choose sync vs arq
enqueue. This is the single seam where Redis Streams (or more) slot in later.
**Consequences:** decoupling now, migration path contained to one module;
handler failures never fail the emitting request (logged, monitored).
