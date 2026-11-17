# Lummium.
**Inteligência e fluidez para o seu estoque.**

O Lummium é uma plataforma moderna e completa (Frontend, Backend e Integrações) para o gerenciamento de alocações e reservas de equipamentos em TI, integrando-se nativamente a ferramentas corporativas como o GLPI através de webhooks e fluxos automatizados.

## 🚀 Tecnologias

- **Frontend:** React, Vite, TypeScript, TailwindCSS, Lucide Icons
- **Backend:** Python, FastAPI, SQLAlchemy, PostgreSQL
- **Integrações/Automação:** n8n (Node-based Workflow Automation)
- **Infraestrutura:** Docker, Docker Compose, Nginx (Reverse Proxy)

## 📦 Estrutura do Projeto

```
/
├── backend/          # API em Python (FastAPI)
├── frontend/         # Aplicação SPA em React/Vite
├── nginx/            # Configurações do proxy reverso e certificados SSL
├── docker-compose.yml       # Orquestração do ambiente de Desenvolvimento
├── docker-compose.prod.yml  # Orquestração do ambiente de Produção
├── DEPLOYMENT.md     # Guia oficial de instalação em Servidor/VM
└── README.md         # Esta documentação
```

## 🛠️ Como rodar o ambiente de Desenvolvimento

Para desenvolvedores que queiram testar ou modificar o código localmente no próprio computador:

**1. Clone o projeto:**
```bash
git clone https://github.com/oYuriyan/estoquems.git
cd estoquems
```

**2. Rode a base de dados, n8n e Nginx (Docker):**

Configure primeiro o ambiente a partir de `.env.example`. Os arquivos `.env`
reais e as chaves TLS sao privados e nao acompanham novos clones. Preserve os
arquivos existentes em atualizacoes; em instalacoes novas, gere seu proprio
certificado e chave conforme `DEPLOYMENT.md`.
```bash
# Isso subirá a infraestrutura secundária sem rodar o frontend no modo build.
npm --prefix frontend ci --legacy-peer-deps
npm --prefix frontend run build
docker compose up -d db n8n api nginx
```

**3. Inicie o Frontend (Vite):**
```bash
cd frontend
npm install
npm run dev
```

O Frontend estará disponível em `http://localhost:5173`.
No ambiente Docker local, a aplicacao e o Swagger ficam em
`https://localhost:3443` e `https://localhost:3443/api/docs`; a porta 8000 da API
nao e publicada diretamente. O Nginx serve `frontend/dist`: execute `npm ci
--legacy-peer-deps` e `npm run build` em `frontend/` para gerar esse diretorio.
O n8n estará rodando em `http://localhost:5678`.

---

## 🔒 Implantação em Produção (Deploy)

Para acessar o manual completo de implantação em Máquinas Virtuais (VMs) internas ou servidores VPS, por favor consulte o documento exclusivo de infraestrutura:

👉 [**Acessar Guia de Deploy (DEPLOYMENT.md)**](./DEPLOYMENT.md)

Antes de atualizar um ambiente com dados, leia
[Atualizacao com preservacao dos dados](docs/ATUALIZACAO-SEGURA.md).
