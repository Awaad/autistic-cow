"""nerves, levels, cow naming — ADR-013 + name-your-cow feature

Mutable aggregate tables only; append-only law (ADR-004) governs event
tables and is untouched. cow_name is free-text user input: moderated at
submit, nulled by the orphan sweep (privacy — free text can carry PII).
"""
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE player_profiles ADD COLUMN level SMALLINT NOT NULL DEFAULT 1")
    op.execute("ALTER TABLE player_profiles ADD COLUMN xp BIGINT NOT NULL DEFAULT 0")
    op.execute("ALTER TABLE player_profiles ADD COLUMN cow_name TEXT")  # NULL = localized default
    op.execute("ALTER TABLE sessions ADD COLUMN nerves_lost SMALLINT NOT NULL DEFAULT 0")


def downgrade() -> None:
    op.execute("ALTER TABLE sessions DROP COLUMN nerves_lost")
    op.execute("ALTER TABLE player_profiles DROP COLUMN cow_name")
    op.execute("ALTER TABLE player_profiles DROP COLUMN xp")
    op.execute("ALTER TABLE player_profiles DROP COLUMN level")
