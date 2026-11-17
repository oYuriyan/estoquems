"""Persist inventory watermark and confirmed equipment operations."""
from alembic import op
import sqlalchemy as sa

revision = 'd1103_inventory_watermark'
down_revision = 'c10230_password_recovery'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('equipments', sa.Column('inventory_confirmed_at', sa.DateTime(timezone=True), nullable=True))
    op.create_table(
        'catalog_sync_state',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('source_updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('fingerprint', sa.String(64), nullable=False),
        sa.Column('synced_at', sa.DateTime(timezone=True), nullable=False),
    )


def downgrade():
    op.drop_table('catalog_sync_state')
    op.drop_column('equipments', 'inventory_confirmed_at')
