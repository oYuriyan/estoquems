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
```bash
# Isso subirá a infraestrutura secundária sem rodar o frontend no modo build.
docker compose up -d db n8n api nginx
```

**3. Inicie o Frontend (Vite):**
```bash
cd frontend
npm install
npm run dev
```

O Frontend estará disponível em `http://localhost:5173`.
O Backend (Swagger) estará em `http://localhost:8000/docs`.
O n8n estará rodando em `http://localhost:5678`.

---

## 🔒 Implantação em Produção (Deploy)

Para acessar o manual completo de implantação em Máquinas Virtuais (VMs) internas ou servidores VPS, por favor consulte o documento exclusivo de infraestrutura:

👉 [**Acessar Guia de Deploy (DEPLOYMENT.md)**](./DEPLOYMENT.md)
