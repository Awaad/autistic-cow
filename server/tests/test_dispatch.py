import pytest

from app.core.dispatch import Dispatcher, DomainEvent


@pytest.mark.asyncio
async def test_emit_reaches_all_handlers_and_survives_failures() -> None:
    d = Dispatcher()
    seen: list[str] = []

    @d.subscribe("thing_happened")
    async def ok_handler(e: DomainEvent) -> None:
        seen.append(e.payload["x"])

    @d.subscribe("thing_happened")
    async def bad_handler(e: DomainEvent) -> None:
        raise RuntimeError("side effect failed")

    await d.emit(DomainEvent("thing_happened", {"x": "a"}))
    assert seen == ["a"]  # failure of one handler never blocks others
