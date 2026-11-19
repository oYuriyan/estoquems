"""Persist operations, item outcomes, events and durable equipment claims."""

from alembic import op
import sqlalchemy as sa

revision = "e1119_operation_ledger"
down_revision = "d1103_inventory_watermark"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "quote_operations",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("quote_id", sa.String(), sa.ForeignKey("quotes.id"), nullable=False),
        sa.Column("actor_id", sa.String(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "parent_id",
            sa.String(),
            sa.ForeignKey("quote_operations.id"),
            nullable=True,
        ),
        sa.Column("action", sa.String(16), nullable=False),
        sa.Column("status", sa.String(24), nullable=False, server_default="PENDING"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("generation", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("lease_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("message", sa.String(), nullable=False, server_default=""),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_quote_operations_quote_id", "quote_operations", ["quote_id"])
    op.create_index("ix_quote_operations_status", "quote_operations", ["status"])
    op.create_table(
        "operation_items",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "operation_id",
            sa.String(),
            sa.ForeignKey("quote_operations.id"),
            nullable=False,
        ),
        sa.Column(
            "equipment_id", sa.String(), sa.ForeignKey("equipments.id"), nullable=False
        ),
        sa.Column("id_glpi", sa.String(), nullable=False),
        sa.Column("serial", sa.String(), nullable=False),
        sa.Column("original_status", sa.String(), nullable=False),
        sa.Column("observed_state", sa.String(24), nullable=True),
        sa.Column("status", sa.String(24), nullable=False, server_default="pending"),
        sa.Column(
            "message",
            sa.String(),
            nullable=False,
            server_default="Aguardando confirmação",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("operation_id", "equipment_id"),
    )
    op.create_index(
        "ix_operation_items_operation_id", "operation_items", ["operation_id"]
    )
    op.create_table(
        "operation_events",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column(
            "operation_id",
            sa.String(),
            sa.ForeignKey("quote_operations.id"),
            nullable=False,
        ),
        sa.Column("actor_id", sa.String(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("kind", sa.String(40), nullable=False),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("data", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_operation_events_operation_id", "operation_events", ["operation_id"]
    )
    op.add_column(
        "equipments", sa.Column("reservation_operation_id", sa.String(), nullable=True)
    )
    op.create_foreign_key(
        "fk_equipment_pending_operation",
        "equipments",
        "quote_operations",
        ["reservation_operation_id"],
        ["id"],
    )
    op.create_index(
        "ix_equipments_reservation_operation_id",
        "equipments",
        ["reservation_operation_id"],
    )


def downgrade():
    connection = op.get_bind()
    if connection.execute(sa.text("SELECT count(*) FROM quote_operations")).scalar():
        raise RuntimeError(
            "O histórico de operações existe; exporte e planeje a reversão sem apagá-lo."
        )
    op.drop_index("ix_equipments_reservation_operation_id", table_name="equipments")
    op.drop_constraint(
        "fk_equipment_pending_operation", "equipments", type_="foreignkey"
    )
    op.drop_column("equipments", "reservation_operation_id")
    op.drop_table("operation_events")
    op.drop_table("operation_items")
    op.drop_table("quote_operations")
