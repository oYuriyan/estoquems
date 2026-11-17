# Guia de Deploy — Estoque MS

> Para o Compose atual, configure `.env` na raiz a partir de `.env.example`.
> `backend/.env` serve para execucao direta do backend, nao para interpolacao
> do Compose. Consulte [DEPLOYMENT.md](../DEPLOYMENT.md) e
> [ATUALIZACAO-SEGURA.md](ATUALIZACAO-SEGURA.md) antes de modificar ambientes
> existentes. Credenciais e chaves TLS reais nao acompanham novos clones.

## Requisitos

| Dependência | Versão mínima |
|-------------|---------------|
| Docker | 24+ |
| Docker Compose | v2.20+ |
| (Opcional) Git | Qualquer |

> [!IMPORTANT]
> O sistema roda **100% em containers Docker**. Não é necessário instalar Python ou Node.js no servidor de produção.

---

## 1. Preparação do Ambiente

### 1.1 Clone o repositório

```bash
git clone https://github.com/oYuriyan/estoquems.git
cd estoquems
```

### 1.2 Configure as variáveis de ambiente

```bash
cp backend/.env.example backend/.env
```

Edite `backend/.env` com os valores reais:

```env
# Banco de dados
DATABASE_URL=postgresql+asyncpg://estoque_user:SENHA_FORTE@db:5432/estoque_db

# Autenticação (gere com: python -c "import secrets; print(secrets.token_hex(32))")
JWT_SECRET_KEY=sua_chave_secreta_de_64_chars_aqui

# CORS — URL pública do seu servidor
FRONTEND_ORIGIN=https://seu-dominio.com.br

# Versão da app
APP_VERSION=1.0.0

# Observabilidade (Sentry — preencher após configurar no dashboard)
SENTRY_DSN=

# Log
LOG_LEVEL=INFO
APP_ENV=production
```

> [!CAUTION]
> **Nunca** comite o arquivo `.env` real. Ele já está no `.gitignore`.

### 1.3 Configure variáveis do docker-compose.yml

Abra `docker-compose.yml` e substitua os placeholders:
- `TROQUE_A_SENHA` → mesma senha do `.env`
- `TROQUE_PARA_UM_SEGREDO_FORTE_DE_64_CHARS` → mesma `JWT_SECRET_KEY`

---

## 2. Build do Frontend

O frontend precisa ser compilado antes do deploy:

```bash
cd frontend

# Crie o arquivo de variáveis do Vite
cat > .env.production << 'EOF'
VITE_SENTRY_DSN=
VITE_APP_VERSION=1.0.0
EOF

# Instale dependências e faça o build
npm install --legacy-peer-deps
npm run build
```

O build gera o diretório `frontend/dist/` que é servido pelo Nginx.

---

## 3. Subir os Containers

```bash
# Na raiz do projeto (onde está o docker-compose.yml)
docker compose up -d

# Verificar que todos os serviços estão healthy
docker compose ps
```

Serviços esperados:
| Serviço | Porta externa | Descrição |
|---------|--------------|-----------|
| `nginx` | 3030 | Serve o frontend + proxy da API |
| `api` | — (interno) | FastAPI backend |
| `db` | — (interno) | PostgreSQL |
| `n8n` | — (interno) | Automações GLPI |

---

## 4. Migração do Banco de Dados

Na **primeira execução** (ou após migrations novas):

```bash
# Executa as migrations Alembic
docker compose exec api alembic upgrade head
```

Para criar um usuário ADMIN inicial:

```bash
docker compose exec api python seed.py
```

---

## 5. Verificar Health

```bash
curl http://localhost:3030/api/health
```

Resposta esperada:
```json
{
  "status": "ok",
  "app": "Micro Estoque API",
  "version": "1.0.0",
  "environment": "production",
  "database": {
    "status": "ok",
    "latency_ms": 1.2
  },
  "websocket": {
    "active_connections": 0
  },
  "sentry": "disabled"
}
```

---

## 6. Atualizações (Deploy de Nova Versão)

```bash
# 1. Pull das alterações
git pull origin main

# 2. Rebuild do frontend
cd frontend && npm run build && cd ..

# 3. Rebuild e restart dos containers (zero-downtime aproximado)
docker compose up -d --build api

# 4. Rodar migrations se houver novas
docker compose exec api alembic upgrade head

# 5. Verificar saúde
curl http://localhost:3030/api/health
```

---

## 7. Configuração do Sentry ✅

> [!NOTE]
> O Sentry já está configurado e ativo. DSN plugado em `frontend/.env.production` e `backend/.env.example`.

### Backend (`backend/.env`)
Adicione a linha abaixo ao `.env` real do servidor:
```env
SENTRY_DSN=
```

Após adicionar, reiniciar o container da API:
```bash
docker compose restart api
```

Verifique que o Sentry está ativo no health check:
```bash
curl http://localhost:3030/api/health | grep sentry
# Esperado: "sentry": "active"
```

### Frontend (`frontend/.env.production`) ✅
Já configurado com o DSN. O arquivo `frontend/.env.production` contém:
```env
VITE_SENTRY_DSN=
```

### Source Maps (opcional — melhora os stack traces no Sentry)
Crie um **Auth Token** em `Sentry > Settings > Auth Tokens` e adicione ao `.env.production`:
```env
SENTRY_AUTH_TOKEN=sntrys_xxxx
SENTRY_ORG=seu-org-slug
SENTRY_PROJECT=estoque-frontend
```

Após isso, refaça o build — o plugin do Vite fará o upload automático dos source maps:
```bash
cd frontend && npm run build
docker compose restart nginx
```

---

## 8. Rollback

```bash
# Ver histórico de imagens
docker images | grep estoque

# Reverter para versão anterior (se usando tags)
docker compose up -d --no-build

# Reverter migration do banco (se necessário)
docker compose exec api alembic downgrade -1
```

---

## 9. Logs e Monitoramento

```bash
# Logs ao vivo de todos os serviços
docker compose logs -f

# Apenas API
docker compose logs -f api

# Ver request_id de uma requisição específica
docker compose logs api | grep "request_id=xxxx"
```

> [!TIP]
> Use o `X-Request-ID` que aparece nos headers de resposta para correlacionar logs com erros no Sentry.

---

## 10. Backup do Banco de Dados

```bash
# Backup
docker compose exec db pg_dump -U estoque_user estoque_db > backup_$(date +%Y%m%d).sql

# Restore
docker compose exec -T db psql -U estoque_user estoque_db < backup_20260101.sql
```
