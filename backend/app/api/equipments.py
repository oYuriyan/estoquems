from fastapi import APIRouter, Depends, HTTPException, Query, Request
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import cast, Text
from typing import List, Optional
import math
import httpx

from app.db.session import get_db
from app.db.models import User, Equipment
from app.schemas.all import EquipmentResponse, EquipmentCreate
from app.api.deps import get_current_user, get_current_active_superuser
from app.inventory import is_available, is_reserved, is_new, is_stock_status
from app.catalog_sync import catalog_synchronizer
from app.catalog_status import get_catalog_status

router = APIRouter()

@router.get("/", response_model=List[EquipmentResponse])
async def get_equipments(
    skip: int = 0, limit: int = 50, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if limit > 100:
        limit = 100
    result = await db.execute(select(Equipment).where(Equipment.is_active).offset(skip).limit(limit))
    return result.scalars().all()

@router.get("/grouped")
async def get_equipments_grouped(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=24, ge=1, le=100),
    search: Optional[str] = None,
    brand: Optional[str] = None,
    status_filter: Optional[str] = None,
    type_filter: Optional[str] = None,
    sort_key: Optional[str] = None,
    sort_dir: Optional[str] = "desc",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Base Query apenas com itens ativos
    query = select(Equipment).where(Equipment.is_active)
    if type_filter:
        query = query.where(Equipment.tipo == type_filter)

    # A lista de marcas não desaparece quando uma marca é selecionada.
    brand_query = select(Equipment.marca).where(Equipment.is_active)
    if type_filter:
        brand_query = brand_query.where(Equipment.tipo == type_filter)
    brand_result = await db.execute(brand_query.distinct())
    available_brands = sorted(brand_result.scalars().all())
    available_types = sorted((await db.execute(select(Equipment.tipo).where(Equipment.is_active).distinct())).scalars().all())

    # 2. Filtros
    if brand:
        query = query.where(Equipment.marca == brand)
    
    if status_filter:
        if status_filter == "NOVO":
            query = query.where(Equipment.status.ilike("%NOVO%"), ~Equipment.status.ilike("%SEMINOVO%"))
        else:
            query = query.where((~Equipment.status.ilike("%NOVO%")) | Equipment.status.ilike("%SEMINOVO%"))
            
    if search:
        search_terms = search.split()
        for term in search_terms:
            t = f"%{term}%"
            # Busca em modelo, marca, tipo, serie, patrimonio e JSON
            query = query.where(
                (Equipment.modelo.ilike(t)) |
                (Equipment.marca.ilike(t)) |
                (Equipment.tipo.ilike(t)) |
                (Equipment.numero_serie.ilike(t)) |
                (Equipment.id_patrimonio.ilike(t)) |
                (cast(Equipment.especificacoes, Text).ilike(t))
            )

    # Pegamos a lista bruta e agrupamos no python para montar a paginação correta 
    # Fazer um GROUP BY complexo no postgres retornando array de objetos em SQLAlchemy async pode ser frágil. 
    # Dado que o volume é ~5000 itens, puxar filtrado e agrupar na memória backend é extremamente rápido (O(N)).
    result = await db.execute(query)
    equipments = result.scalars().all()
    
    # Agrupamento
    groups_dict = {}
    for eq in equipments:
        proc = eq.especificacoes.get("processador", "N/A") if eq.especificacoes else "N/A"
        ram = eq.especificacoes.get("ram", "N/A") if eq.especificacoes else "N/A"
        arm = eq.especificacoes.get("armazenamento", "N/A") if eq.especificacoes else "N/A"
        so = eq.especificacoes.get("so", "N/A") if eq.especificacoes else "N/A"
        
        # Chave de Agrupamento Exata
        screen = eq.especificacoes.get("tela", "N/A") if eq.especificacoes else "N/A"
        key = "|".join(str(value) for value in (eq.tipo, eq.marca, eq.modelo, proc, ram, arm, so, screen))
        
        if key not in groups_dict:
            groups_dict[key] = {
                "key": key,
                "modelo": eq.modelo,
                "marca": eq.marca,
                "tipo": eq.tipo,
                "processador": proc,
                "ram": ram,
                "armazenamento": arm,
                "so": so,
                "tela": screen,
                "available_count": 0,
                "reserved_count": 0,
                "unavailable_count": 0,
                "novos": 0,
                "usados": 0,
                "items": []
            }
            
        groups_dict[key]["items"].append(eq)
        if is_available(eq):
            groups_dict[key]["available_count"] += 1
            groups_dict[key]["novos" if is_new(eq) else "usados"] += 1
        elif is_reserved(eq):
            groups_dict[key]["reserved_count"] += 1
        else:
            groups_dict[key]["unavailable_count"] += 1

    grouped_list = list(groups_dict.values())
    
    # Ordenação
    if sort_key:
        reverse = sort_dir == "desc"
        if sort_key == "qtd":
            grouped_list.sort(key=lambda x: (x["available_count"], x["key"]), reverse=reverse)
        else:
            grouped_list.sort(key=lambda x: (str(x.get(sort_key, "")), x["key"]), reverse=reverse)
    else:
        # Default sort (por tipo e depois quantidade, para evitar layout shift no frontend durante paginação)
        grouped_list.sort(key=lambda x: (x["available_count"], x["key"]), reverse=True)

    # Paginação
    total_groups = len(grouped_list)
    total_pages = math.ceil(total_groups / limit) if limit > 0 else 1
    skip = (page - 1) * limit
    
    paginated_groups = grouped_list[skip:skip + limit]
    
    # Precisamos serializar o Pydantic / SQLAlchemy -> dict
    # Para items, vamos retornar as propriedades essenciais para o carrinho
    serialized_groups = []
    for g in paginated_groups:
        # Sort items inside group: available first, then reserved
        g["items"].sort(key=lambda i: i.is_reserved)
        
        items_serialized = []
        for i in g["items"]:
            items_serialized.append({
                "id": i.id,
                "idPatrimonio": i.id_patrimonio,
                "numeroSerie": i.numero_serie,
                "marca": i.marca,
                "modelo": i.modelo,
                "tipo": i.tipo,
                "status": i.status,
                "fornecedor": i.fornecedor,
                "is_reserved": i.is_reserved,
                "is_available": is_available(i),
                "especificacoes": i.especificacoes
            })
        
        g_copy = {**g, "items": items_serialized}
        serialized_groups.append(g_copy)

    # Agrupar as marcas disponíveis para o filtro do frontend
    available = [eq for eq in equipments if is_available(eq)]
    total_novos = sum(1 for eq in available if is_new(eq))
    total_usados = len(available) - total_novos
    inventory = await get_catalog_status(db)

    return {
        "groups": serialized_groups,
        "available_brands": available_brands,
        "available_types": available_types,
        "total_groups": total_groups,
        "total_pages": total_pages,
        "current_page": page,
        "total_equipments": len(equipments),
        "total_available": len(available),
        "total_reserved": sum(1 for eq in equipments if is_reserved(eq)),
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
        **inventory,
        "total_novos": total_novos,
        "total_usados": total_usados
    }

@router.get("/source-status")
async def get_inventory_source_status(
    current_user: User = Depends(get_current_active_superuser)
):
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get('http://nginx:8080/catalogo.json')
            if response.status_code == 404:
                return {'source_updated_at': None}
            response.raise_for_status()
            payload = response.json()
        if isinstance(payload, list) and len(payload) == 1:
            payload = payload[0]
        if not isinstance(payload, dict) or not isinstance(payload.get('estoque'), list):
            raise ValueError('invalid source')
        metadata = payload.get('metadados')
        stamp = metadata.get('ultimaAtualizacao') if isinstance(metadata, dict) else None
        return {'source_updated_at': stamp if isinstance(stamp, str) else None}
    except Exception:
        raise HTTPException(status_code=502, detail='Não foi possível consultar a exportação do inventário. O catálogo foi preservado.')


@router.post("/refresh-source", status_code=202)
async def request_inventory_refresh(
    current_user: User = Depends(get_current_active_superuser)
):
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get('http://n8n:5678/webhook/atualizar_estoque')
            response.raise_for_status()
    except Exception:
        raise HTTPException(status_code=502, detail='Não foi possível solicitar a atualização do inventário. Nenhuma importação foi confirmada.')
    return {'message': 'Atualização solicitada. Aguarde a exportação antes de confirmar a importação.'}


@router.post("/sync")
async def sync_from_json(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    try:
        await catalog_synchronizer.sync(db, force=True)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error))
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=502, detail="Não foi possível importar o inventário do GLPI. O catálogo anterior foi preservado.")
    await request.app.state.ws_manager.broadcast('CATALOG_UPDATED')
    return {"message": "Sincronizado com sucesso."}

@router.post("/", response_model=EquipmentResponse)
async def create_equipment(
    equipment_in: EquipmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not is_stock_status(equipment_in.status):
        raise HTTPException(status_code=422, detail="O estoque aceita apenas DISPONIVEL NOVO e DISPONIVEL USADO.")
    # Verifica se já existe um com mesmo id_patrimonio
    result = await db.execute(select(Equipment).where(Equipment.id_patrimonio == equipment_in.id_patrimonio))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Equipamento com este ID Patrimônio já existe.")
        
    equipment = Equipment(**equipment_in.model_dump())
    db.add(equipment)
    await db.commit()
    await db.refresh(equipment)
    return equipment
