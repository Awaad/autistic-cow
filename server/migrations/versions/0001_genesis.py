"""genesis schema — applies server/app/db/schema.sql verbatim (docs/02)"""
from pathlib import Path
import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

_SCHEMA = Path(__file__).resolve().parents[2] / "app" / "db" / "schema.sql"

def _statements(sql: str) -> list[str]:
    # strip line comments, then split on ';'
    lines = [ln.split("--", 1)[0] for ln in sql.splitlines()]
    return [s.strip() for s in "\n".join(lines).split(";") if s.strip()]


def upgrade() -> None:
    for stmt in _statements(_SCHEMA.read_text()):
        op.execute(sa.text(stmt))


def downgrade() -> None:
    raise NotImplementedError("genesis is not reversible; drop the database in dev")
