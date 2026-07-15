"""photo energy daily cap tracking"""
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE player_profiles ADD COLUMN photo_energy_granted_on DATE")


def downgrade() -> None:
    op.execute("ALTER TABLE player_profiles DROP COLUMN photo_energy_granted_on")
