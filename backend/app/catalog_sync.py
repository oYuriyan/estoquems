"""Importação do inventário gerado pelo n8n, sem executar fluxos do GLPI."""
import asyncio
import hashlib
import json
from datetime import datetime, timezone, timedelta

import httpx
from sqlalchemy import select
from app.db.models import Equipment, CatalogSyncState
from app.core.config import get_settings
from app.inventory import is_stock_status


def utc(value):
    # SQLite de testes remove o fuso de DateTime; PostgreSQL usa timezone=True.
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def source_timestamp(payload):
    metadata = payload.get('metadados')
    value = metadata.get('ultimaAtualizacao') if isinstance(metadata, dict) else None
    try:
        stamp = datetime.fromisoformat(value.replace('Z', '+00:00'))
        if stamp.tzinfo is None:
            raise ValueError()
    except (AttributeError, TypeError, ValueError):
        raise ValueError('Inventário exige ultimaAtualizacao válida com fuso horário.') from None
    now = datetime.now(timezone.utc)
    stamp = utc(stamp)
    if stamp > now:
        raise ValueError('Inventário com data futura; verifique o relógio da origem.')
    if now - stamp > timedelta(hours=get_settings().CATALOG_MAX_AGE_HOURS):
        raise ValueError('Inventário antigo; atualize a exportação GLPI antes de importar.')
    return stamp


class CatalogSynchronizer:
    def __init__(self):
        self.lock = asyncio.Lock()
        self.fingerprint = None
        self.source_updated_at = None
        self.synced_at = None

    async def sync(self, db, force=False):
        async with self.lock:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get('http://nginx:8080/catalogo.json')
                response.raise_for_status()
                payload = response.json()
            if isinstance(payload, list) and len(payload) == 1:
                payload = payload[0]
            if not isinstance(payload, dict) or not isinstance(payload.get('estoque'), list):
                raise ValueError('Formato do inventário inválido. O catálogo anterior foi preservado.')
            items = payload['estoque']
            if not items:
                raise ValueError('Inventário vazio. Confirme o resultado no GLPI antes de remover todo o catálogo.')
            prepared = []
            identities = set()
            for item in items:
                if not isinstance(item, dict):
                    raise ValueError('Registro inválido no inventário.')
                identity = str(item.get('idPatrimonio') or '').strip()
                if identity == 'N/A':
                    serial = str(item.get('numeroSerie') or '').strip()
                    if not serial:
                        raise ValueError('Equipamento sem patrimônio e sem número de série.')
                    identity = f'N/A-{serial}'
                if not identity or identity in identities:
                    raise ValueError('Inventário com patrimônio ausente ou duplicado. Nenhuma alteração foi aplicada.')
                if not isinstance(item.get('especificacoes', {}), dict):
                    raise ValueError('Especificações inválidas no inventário.')
                identities.add(identity)
                prepared.append((identity, item))

            fingerprint = hashlib.sha256(json.dumps(items, sort_keys=True).encode()).hexdigest()
            stamp = source_timestamp(payload)
            state = (await db.execute(select(CatalogSyncState).where(CatalogSyncState.id == 1).with_for_update())).scalar_one_or_none()
            if state and stamp < utc(state.source_updated_at):
                raise ValueError('Inventário anterior ao último snapshot aceito; catálogo preservado.')
            if state and stamp == utc(state.source_updated_at) and fingerprint != state.fingerprint:
                raise ValueError('Conteúdo alterado sem nova data de inventário; catálogo preservado.')
            if state and stamp == utc(state.source_updated_at) and not force:
                self.fingerprint = state.fingerprint
                self.source_updated_at = utc(state.source_updated_at).isoformat()
                self.synced_at = utc(state.synced_at).isoformat()
                await db.commit()
                return False

            # A mesma ordem de bloqueio das reservas evita disputas com a importação.
            existing = (await db.execute(select(Equipment).order_by(Equipment.id).with_for_update().execution_options(populate_existing=True))).scalars().all()
            by_identity = {equipment.id_patrimonio: equipment for equipment in existing}
            for identity, item in prepared:
                equipment = by_identity.get(identity)
                if equipment is not None and equipment.reservation_operation_id:
                    continue
                if equipment is not None and equipment.inventory_confirmed_at and stamp <= utc(equipment.inventory_confirmed_at):
                    continue
                if not is_stock_status(item.get('status')):
                    # Fora do estoque comercial: não cadastrar nem importar o estado.
                    # Preservar vínculos e reservas locais para consulta histórica.
                    if equipment is not None:
                        equipment.is_active = False
                    continue
                if equipment is None:
                    equipment = Equipment(id_patrimonio=identity)
                    db.add(equipment)
                if not equipment.is_reserved:
                    equipment.status = str(item.get('status') or '').strip() or 'DESCONHECIDO'
                equipment.is_active = True
                equipment.id_glpi = str(item.get('idGlpi') or equipment.id_glpi or '')
                equipment.numero_serie = str(item.get('numeroSerie') or '')
                equipment.tipo = str(item.get('tipo') or '')
                equipment.marca = str(item.get('marca') or '')
                equipment.modelo = str(item.get('modelo') or '')
                equipment.fornecedor = item.get('fornecedor')
                equipment.especificacoes = item.get('especificacoes', {})
            for equipment in existing:
                protected = equipment.reservation_operation_id or (equipment.inventory_confirmed_at and stamp <= utc(equipment.inventory_confirmed_at))
                if equipment.id_patrimonio not in identities and not protected:
                    equipment.is_active = False
            if state is None:
                state = CatalogSyncState(id=1)
                db.add(state)
            state.source_updated_at = stamp
            state.fingerprint = fingerprint
            state.synced_at = datetime.now(timezone.utc)
            await db.commit()
            self.fingerprint = fingerprint
            self.source_updated_at = stamp.isoformat()
            self.synced_at = utc(state.synced_at).isoformat()
            return True


catalog_synchronizer = CatalogSynchronizer()
