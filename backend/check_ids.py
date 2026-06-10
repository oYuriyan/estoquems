import asyncio
import httpx
from app.db.session import AsyncSessionLocal
from app.db.models import Equipment
from sqlalchemy.future import select

async def fetch():
    async with httpx.AsyncClient() as client:
        r = await client.get('http://nginx/catalogo.json')
        data = r.json()
        items = data[0]['estoque'] if isinstance(data, list) else data['estoque']
        
    incoming_ids = set()
    for item in items:
        id_pat = item.get('idPatrimonio')
        if not id_pat:
            continue
        if id_pat == 'N/A':
            id_pat = f"N/A-{item.get('numeroSerie', '')}"
        incoming_ids.add(id_pat)
    
    print('incoming_ids length:', len(incoming_ids))
    
    async with AsyncSessionLocal() as db:
        existing = (await db.execute(select(Equipment))).scalars().all()
        existing_map = {eq.id_patrimonio: eq for eq in existing}
        
        insert_count = 0
        update_count = 0
        for incoming in incoming_ids:
            if incoming in existing_map:
                update_count += 1
            else:
                insert_count += 1
        
        print('To Update:', update_count, 'To Insert:', insert_count)

asyncio.run(fetch())
