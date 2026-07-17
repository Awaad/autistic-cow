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


MISSION_SEED = """
INSERT INTO venues (id, district_id, slug, name, kind, ingame_coords)
SELECT gen_random_uuid(), d.id, 'harbor-bar-west',
       '{"en":"The West Quay Bar","de":"Bar am Westkai","ru":"Бар на западном пирсе"}'::jsonb,
       'bar', '{"x":-52,"z":28}'::jsonb
FROM districts d WHERE d.slug='kyrenia-harbor'
  AND NOT EXISTS (SELECT 1 FROM venues v WHERE v.slug='harbor-bar-west');

INSERT INTO missions (id, district_id, mission_type, config, reward, text, active)
SELECT gen_random_uuid(), d.id, m.mtype::mission_type, m.cfg::jsonb, m.rew::jsonb, m.txt::jsonb, true
FROM districts d, (VALUES
  ('bar_pilgrimage',
   '{"venue_slug":"harbor-bar-west","x":-52,"z":28,"radius":6,"dwell_s":2}',
   '{"currency":120}',
   '{"en":{"title":"Quiet Pilgrimage","brief":"Reach the West Quay Bar SERENE and stay 2s. She walks in calm or not at all."},
     "de":{"title":"Stille Wallfahrt","brief":"Erreichen Sie die Bar am Westkai GELASSEN und verweilen Sie 2s."},
     "ru":{"title":"Тихое паломничество","brief":"Дойди до бара на западном пирсе БЕЗМЯТЕЖНОЙ и постой 2с."}}'),
  ('rescue_chain',
   '{"count":3}',
   '{"currency":100}',
   '{"en":{"title":"Shepherd of the Harbor","brief":"Rescue 3 creatures in one session."},
     "de":{"title":"Hirte des Hafens","brief":"Retten Sie 3 Tiere in einer Sitzung."},
     "ru":{"title":"Пастырь гавани","brief":"Спаси троих за одну сессию."}}'),
  ('controlled_demolition',
   '{"count":5}',
   '{"currency":150}',
   '{"en":{"title":"Surgical","brief":"Destroy ONLY the 5 marked targets. One unmarked hit resets the count."},
     "de":{"title":"Chirurgisch","brief":"Zerstören Sie NUR die 5 markierten Ziele. Ein falscher Treffer setzt zurück."},
     "ru":{"title":"Хирургически","brief":"Разнеси ТОЛЬКО 5 отмеченных целей. Один лишний удар — счёт заново."}}'),
  ('wine_hunt',
   '{"clue":true}',
   '{"currency":200}',
   '{"en":{"title":"The One True Zero","brief":"Somewhere behind, between, forgotten: the wine waits."},
     "de":{"title":"Die einzige echte Null","brief":"Irgendwo dahinter, dazwischen, vergessen: der Wein wartet."},
     "ru":{"title":"Единственный настоящий ноль","brief":"Где-то позади, между, в забытом углу — ждёт вино."}}')
) AS m(mtype, cfg, rew, txt)
WHERE d.slug='kyrenia-harbor'
  AND NOT EXISTS (SELECT 1 FROM missions x WHERE x.district_id=d.id AND x.mission_type=m.mtype::mission_type);
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
