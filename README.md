# WORKING_TITLE (codename: autistic-cow)
Browser-first 3D rampage game. Rage earns. Calm spends. The Judge remembers.


**Read first, in order:** `docs/01-GAME-LOOP.md` → `02-DATA-SCHEMA.md` →
`03-ARCHITECTURE.md`. Decisions live in `docs/adr/`.

## Dev quickstart
```bash
docker compose up -d postgres redis minio   # infra
cd server && uv sync && uv run alembic upgrade head && uv run uvicorn app.main:app --reload
cd client && pnpm install && pnpm dev
```

## Repo laws (enforced in CI, see docs/04 §2)
1. `client/src/game/` never imports React.
2. Payload types come from `shared/contracts/` codegen only.
3. No hardcoded UI strings — i18n keys with en/de/ru parity (CI-checked). content systems (Judge pool, mission text, generated lines) localize through their own locale-aware pipelines and are exempt from key parity.
4. The children no-contact guarantee tests must pass, forever.
5. The camel is never explained. Not even in code comments.
