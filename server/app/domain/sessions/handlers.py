"""Side effects of session lifecycle, decoupled via dispatcher (ADR-009).
SessionService never knows these exist."""
from app.core.dispatch import DomainEvent, dispatcher


@dispatcher.subscribe("session_ended")
async def recompute_axis(event: DomainEvent) -> None:
    # later load event log -> domain.judge.axis.compute_axis -> profile update
    pass


@dispatcher.subscribe("session_ended")
async def update_leaderboards(event: DomainEvent) -> None:
    # later: Redis ZSET per axis band
    pass
