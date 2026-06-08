import asyncio
import json
import os
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.db.session import AsyncSessionLocal
from app.db.models import Equipment, EquipmentStatus

async def seed():
    async with AsyncSessionLocal() as session:
        # Verifica se já tem equipamentos
        result = await session.execute(select(Equipment).limit(1))
        if result.scalar_one_or_none():
            print("Banco já possui equipamentos, abortando seed.")
            return

        with open('/app/catalogo.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # O catalogo.json tem a forma [{ metadados: ..., estoque: [...] }]
        if isinstance(data, list) and len(data) > 0:
            estoque = data[0].get('estoque', [])
        else:
            estoque = data.get('estoque', [])
            
        print(f"Inserindo {len(estoque)} equipamentos do JSON antigo...")
        
        import uuid
        for item in estoque:
            id_patrimonio = item.get('idPatrimonio', '').strip()
            if not id_patrimonio or id_patrimonio == 'N/A':
                id_patrimonio = f"MISSING-{uuid.uuid4().hex[:8]}"
            
            eq = Equipment(
                id_patrimonio=id_patrimonio,
                id_glpi=item.get('idGlpi', ''),
                numero_serie=item.get('numeroSerie', ''),
                tipo=item.get('tipo', ''),
                marca=item.get('marca', ''),
                modelo=item.get('modelo', ''),
                fornecedor=item.get('fornecedor'),
                especificacoes=item.get('especificacoes', {}),
                status=EquipmentStatus.AVAILABLE
            )
            session.add(eq)
        
        await session.commit()
        print("Seed concluído com sucesso!")

if __name__ == "__main__":
    asyncio.run(seed())
