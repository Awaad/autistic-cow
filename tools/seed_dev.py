"""Seed one grey-box district (Stage 0 exit criteria). Run after alembic:
    cd server && uv run python ../tools/seed_dev.py
"""
import asyncio
import json

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

from app.core.settings import settings


SEED = """
INSERT INTO regions (slug, name, active)
VALUES ('north-cyprus', '{"en":"North Cyprus","de":"Nordzypern","ru":"Северный Кипр"}', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO districts (region_id, slug, name, scene_asset_key, spawn_template, active)
SELECT r.id, 'kyrenia-harbor',
       '{"en":"Kyrenia Harbor","de":"Hafen von Kyrenia","ru":"Гавань Кирении"}',
       'greybox/harbor-v0',
       '{"smashables": 80, "rescueables": 8, "children": 4, "beer": 6, "wine_chance": 0.33}',
       true
FROM regions r WHERE r.slug = 'north-cyprus'
ON CONFLICT (region_id, slug) DO NOTHING;
"""


async def main() -> None:
    engine = create_async_engine(settings().database_url)
    async with engine.begin() as conn:
        for stmt in SEED.split(";"):
            if stmt.strip():
                await conn.execute(text(stmt))
    await engine.dispose()
    print("seeded: north-cyprus / kyrenia-harbor (greybox)")


if __name__ == "__main__":
    asyncio.run(main())
