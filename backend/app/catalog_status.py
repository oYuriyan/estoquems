"""Atualidade do inventário aceito, sempre consultada no banco persistente."""
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import select

from app.core.config import get_settings
from app.db.models import CatalogSyncState


def catalog_status(state, *, now=None, max_age_hours=None):
    now = now or datetime.now(timezone.utc)
    max_age_hours = max_age_hours if max_age_hours is not None else get_settings().CATALOG_MAX_AGE_HOURS
    status = 'unverified'
    message = 'O inventário ainda não foi validado. Atualize e sincronize o estoque antes de reservar.'
    source = state.source_updated_at if state is not None else None
    synced = state.synced_at if state is not None else None
    if source is not None:
        source = source.replace(tzinfo=timezone.utc) if source.tzinfo is None else source.astimezone(timezone.utc)
        if source > now:
            status = 'invalid'
            message = 'A data do inventário é inválida. Solicite a conferência antes de reservar.'
        elif now - source > timedelta(hours=max_age_hours):
            status = 'stale'
            message = 'O inventário está desatualizado. Atualize e sincronize o estoque antes de reservar.'
        else:
            status = 'fresh'
            message = None
    if synced is not None:
        synced = synced.replace(tzinfo=timezone.utc) if synced.tzinfo is None else synced.astimezone(timezone.utc)
    return {
        'source_updated_at': source.isoformat() if source is not None else None,
        'synced_at': synced.isoformat() if synced is not None else None,
        'inventory_status': status,
        'reservation_allowed': status == 'fresh',
        'reservation_block_reason': message,
        'inventory_fresh_until': (source + timedelta(hours=max_age_hours)).isoformat() if source is not None else None,
        'catalog_max_age_hours': max_age_hours,
    }


async def get_catalog_status(db, *, lock=False):
    query = select(CatalogSyncState).where(CatalogSyncState.id == 1).execution_options(populate_existing=True)
    if lock:
        # A importacao bloqueia este registro antes dos equipamentos. Compartilhar
        # a mesma ordem impede a troca do snapshot durante a confirmacao da reserva.
        query = query.with_for_update(read=True)
    state = (await db.execute(query)).scalar_one_or_none()
    return catalog_status(state)


async def require_fresh_inventory(db):
    status = await get_catalog_status(db, lock=True)
    if not status['reservation_allowed']:
        raise HTTPException(status_code=409, detail={
            'code': 'inventory_' + status['inventory_status'],
            'message': status['reservation_block_reason'],
        })
