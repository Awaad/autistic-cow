# ADR-010: Asynchronous multiplayer; single-simulation engine
**Status:** accepted
**Context:** Real-time shared physics is so expensive feature fo us now. The social value here is comparative, not co-present.
**Decision:** Engine stays single-simulation. Server treats
shared events/aggregates as first-class from Stage 3: weekly seeded challenges
(same spawn_seed), community destruction meters (Redis counters + WS feed),
ghost markers from event-log aggregation, herd galleries, live psycho/saint
census. One WS channel per session reserved in the protocol.
**Consequences:** multiplayer feel at single-player cost; real-time co-op
remains possible later, nothing built blocks it.
