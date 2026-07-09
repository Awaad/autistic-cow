"""In-process domain-event dispatcher - ADR-009.

Services emit domain events; handlers subscribe. Handlers decide sync vs
enqueue-to-arq. This is the single seam where a Redis Stream / external
queue slots in if ingestion volume ever demands it (for today, it does not need).
"""
from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable

log = logging.getLogger("dispatch")


@dataclass(frozen=True)
class DomainEvent:
    name: str                     # "session_ended", "photo_verified" etc.
    payload: dict[str, Any] = field(default_factory=dict)


Handler = Callable[[DomainEvent], Awaitable[None]]


class Dispatcher:
    def __init__(self) -> None:
        self._handlers: dict[str, list[Handler]] = defaultdict(list)

    def subscribe(self, event_name: str) -> Callable[[Handler], Handler]:
        def deco(fn: Handler) -> Handler:
            self._handlers[event_name].append(fn)
            return fn
        return deco

    async def emit(self, event: DomainEvent) -> None:
        handlers = self._handlers.get(event.name, [])
        if not handlers:
            log.debug("no handlers for %s", event.name)
            return
        results = await asyncio.gather(
            *(h(event) for h in handlers), return_exceptions=True
        )
        for h, r in zip(handlers, results):
            if isinstance(r, Exception):
                # A failing side effect never fails the emitting request.
                log.exception("handler %s failed for %s", h.__name__, event.name, exc_info=r)


dispatcher = Dispatcher()
