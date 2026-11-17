"""Exercise this migration and rollback against an isolated prior schema."""
import importlib.util
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect, text


def test_inventory_migration_preserves_equipment_on_upgrade_and_downgrade():
    path = Path(__file__).parents[1] / 'alembic/versions/d1103_inventory_watermark.py'
    spec = importlib.util.spec_from_file_location('inventory_migration', path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = create_engine('sqlite:///:memory:')
    with engine.begin() as connection:
        connection.execute(text('CREATE TABLE equipments (id VARCHAR PRIMARY KEY, status VARCHAR NOT NULL)'))
        connection.execute(text("INSERT INTO equipments VALUES ('existing', 'DISPONIVEL NOVO')"))
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
            assert 'catalog_sync_state' in inspect(connection).get_table_names()
            assert connection.execute(text('SELECT inventory_confirmed_at FROM equipments')).scalar() is None
            migration.downgrade()
        assert 'catalog_sync_state' not in inspect(connection).get_table_names()
        assert 'inventory_confirmed_at' not in {column['name'] for column in inspect(connection).get_columns('equipments')}
        assert connection.execute(text('SELECT status FROM equipments')).scalar_one() == 'DISPONIVEL NOVO'
    engine.dispose()
