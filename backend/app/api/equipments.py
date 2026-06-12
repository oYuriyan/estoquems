from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, String, cast, Text
from sqlalchemy.orm import selectinload
from typing import List, Optional
import math
import httpx

from app.db.session import get_db
from app.db.models import User, Equipment
from app.schemas.all import EquipmentResponse, EquipmentCreate
from app.api.deps import get_current_user, get_current_active_superuser

router = APIRouter()

@router.get("/", response_model=List[EquipmentResponse])
async def get_equipments(
    skip: int = 0, limit: int = 1000, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Equipment).where(Equipment.is_active == True).offset(skip).limit(limit))
    return result.scalars().all()

@router.get("/grouped")
async def get_equipments_grouped(
    page: int = 1,
    limit: int = 24,
    search: Optional[str] = None,
    brand: Optional[str] = None,
    status_filter: Optional[str] = None,
    sort_key: Optional[str] = None,
    sort_dir: Optional[str] = "desc",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Base Query apenas com itens ativos
    query = select(Equipment).where(Equipment.is_active == True)

    # 2. Filtros
    if brand:
        query = query.where(Equipment.marca == brand)
    
    if status_filter:
        if status_filter == "NOVO":
            query = query.where(Equipment.status.ilike("%NOVO%"))
        else:
            query = query.where(~Equipment.status.ilike("%NOVO%"))
            
    if search:
        search_term = f"%{search}%"
        # Busca em modelo, marca, tipo, serie, patrimonio e JSON
        query = query.where(
            (Equipment.modelo.ilike(search_term)) |
            (Equipment.marca.ilike(search_term)) |
            (Equipment.tipo.ilike(search_term)) |
            (Equipment.numero_serie.ilike(search_term)) |
            (Equipment.id_patrimonio.ilike(search_term))
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
        key = f"{eq.modelo}|{proc}|{ram}|{arm}|{so}"
        
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
                "novos": 0,
                "usados": 0,
                "items": []
            }
            
        groups_dict[key]["items"].append(eq)
        if "NOVO" in str(eq.status).upper():
            groups_dict[key]["novos"] += 1
        else:
            groups_dict[key]["usados"] += 1

    grouped_list = list(groups_dict.values())
    
    # Ordenação
    if sort_key:
        reverse = sort_dir == "desc"
        if sort_key == "qtd":
            grouped_list.sort(key=lambda x: len(x["items"]), reverse=reverse)
        else:
            grouped_list.sort(key=lambda x: str(x.get(sort_key, "")), reverse=reverse)
    else:
        # Default sort (por tipo e depois quantidade, para evitar layout shift no frontend durante paginação)
        grouped_list.sort(key=lambda x: (str(x.get("tipo", "")).upper(), len(x["items"])), reverse=True)

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
                "especificacoes": i.especificacoes
            })
        
        g_copy = {**g, "items": items_serialized}
        serialized_groups.append(g_copy)

    # Agrupar as marcas disponíveis para o filtro do frontend
    available_brands = sorted(list(set(eq.marca for eq in equipments)))

    total_novos = sum(1 for eq in equipments if "NOVO" in str(eq.status).upper())
    total_usados = len(equipments) - total_novos

    return {
        "groups": serialized_groups,
        "available_brands": available_brands,
        "total_groups": total_groups,
        "total_pages": total_pages,
        "current_page": page,
        "total_equipments": len(equipments),
        "total_novos": total_novos,
        "total_usados": total_usados
    }

@router.post("/sync")
async def sync_from_json(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    try:
        async with httpx.AsyncClient() as client:
            res = await client.get("http://nginx/catalogo.json")
            res.raise_for_status()
            data = res.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar catalogo.json: {str(e)}")
        
    items = data[0]["estoque"] if isinstance(data, list) else data.get("estoque", [])
    
    existing = (await db.execute(select(Equipment))).scalars().all()
    existing_map = {eq.id_patrimonio: eq for eq in existing}
    
    incoming_ids = set()
    for item in items:
        id_pat = item.get("idPatrimonio")
        if id_pat is None or str(id_pat).strip() == "":
            continue
            
        id_pat = str(id_pat)
            
        # Garante unicidade para itens não patrimoniados (N/A)
        if id_pat == "N/A":
            id_pat = f"N/A-{str(item.get('numeroSerie', ''))}"
            
        incoming_ids.add(id_pat)
        if id_pat in existing_map:
            eq = existing_map[id_pat]
            eq.status = str(item.get("status", eq.status))
            eq.is_active = True
            eq.id_glpi = str(item.get("idGlpi", eq.id_glpi))
            eq.numero_serie = str(item.get("numeroSerie", eq.numero_serie))
            eq.tipo = str(item.get("tipo", eq.tipo))
            eq.marca = str(item.get("marca", eq.marca))
            eq.modelo = str(item.get("modelo", eq.modelo))
            eq.fornecedor = item.get("fornecedor") if item.get("fornecedor") is None else str(item.get("fornecedor"))
            eq.especificacoes = item.get("especificacoes", eq.especificacoes)
        else:
            eq = Equipment(
                id_patrimonio=id_pat,
                numero_serie=str(item.get("numeroSerie", "")),
                id_glpi=str(item.get("idGlpi", "")),
                tipo=str(item.get("tipo", "")),
                marca=str(item.get("marca", "")),
                modelo=str(item.get("modelo", "")),
                status=str(item.get("status", "USADO")),
                fornecedor=item.get("fornecedor") if item.get("fornecedor") is None else str(item.get("fornecedor")),
                especificacoes=item.get("especificacoes", {}),
                is_active=True
            )
            db.add(eq)
            
    for eq in existing:
        if eq.id_patrimonio not in incoming_ids:
            eq.is_active = False
            
    await db.commit()
    return {"message": "Sincronizado com sucesso."}

@router.post("/", response_model=EquipmentResponse)
async def create_equipment(
    equipment_in: EquipmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verifica se já existe um com mesmo id_patrimonio
    result = await db.execute(select(Equipment).where(Equipment.id_patrimonio == equipment_in.id_patrimonio))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Equipamento com este ID Patrimônio já existe.")
        
    equipment = Equipment(**equipment_in.model_dump())
    db.add(equipment)
    await db.commit()
    await db.refresh(equipment)
    return equipment
