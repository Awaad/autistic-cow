import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.settings import settings

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = None  # genesis schema is raw SQL; models mirror it


def run_migrations_offline() -> None:
    context.configure(url=settings().database_url, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    print(f"CONNECTING TO: {settings().database_url}")

    engine = create_async_engine(settings().database_url)
    async with engine.connect() as conn:
        await conn.run_sync(
            lambda c: context.configure(connection=c, target_metadata=target_metadata)
        )
        await conn.run_sync(lambda c: context.run_migrations())
        await conn.commit()
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())