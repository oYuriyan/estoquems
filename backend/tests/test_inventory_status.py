from types import SimpleNamespace

import pytest

from app.inventory import is_available


@pytest.mark.parametrize('status', [
    'DISPONIVEL NOVO', 'DISPONIVEL USADO', ' disponível  usado ',
])
def test_explicit_available_states(status):
    equipment = SimpleNamespace(status=status, is_active=True, is_reserved=False)
    assert is_available(equipment)
    equipment.is_reserved = True
    assert not is_available(equipment)
    equipment.is_reserved = False
    equipment.is_active = False
    assert not is_available(equipment)
