"""Async engine + connection dependency. Repositories speak SQL text —
the schema is raw SQL (genesis), the queries match it."""
from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncConnection, AsyncEngine, create_async_engine

from app.core.settings import settings

_engine: AsyncEngine | None = None


def engine() -> AsyncEngine:
    global _engine
    if _engine is None:
        _engine = create_async_engine(settings().database_url, pool_size=10)
    return _engine


async def get_conn() -> AsyncIterator[AsyncConnection]:
    async with engine().begin() as conn:
        yield conn
