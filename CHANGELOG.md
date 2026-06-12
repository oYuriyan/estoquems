# Changelog

Todas as mudanças notáveis deste projeto estão documentadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

---

## [Unreleased]

### Added
- Logging estruturado com `X-Request-ID` em todas as requisições HTTP
- Integração com **Sentry** (backend + frontend) para error tracking e performance
- **Error Boundary** React com UI de fallback premium e reporte automático ao Sentry
- **Rate limiting** no Nginx (5 req/min para auth, 120 req/min para API geral)
- **Security headers** fortalecidos: `X-DNS-Prefetch-Control`, `frame-ancestors 'none'` no CSP, `server_tokens off`
- `GET /api/health` enriquecido: verifica DB, retorna latência, versão e conexões WebSocket ativas
- **CI/CD** com GitHub Actions: lint → testes → build frontend → validação Docker
- Fixtures de testes com SQLite in-memory (sem Docker para testes unitários)
- Suite de testes para auth (`test_auth.py`) e equipamentos/propostas (`test_equipments_quotes.py`)
- `APP_VERSION`, `SENTRY_DSN`, `LOG_LEVEL`, `RATE_LIMIT_PER_MINUTE` nas configurações

---

## [1.0.0] — 2026-05

### Added
- **Catálogo de equipamentos** com agrupamento por modelo/especificações
- **Sistema de propostas** com status: DRAFT → RESERVED → CANCELED/WON
- **Lock pessimista** (`SELECT FOR UPDATE`) para garantir integridade de reservas concorrentes
- **WebSockets** para atualização em tempo real do catálogo (broadcast RESERVED/CANCELED)
- **Autenticação JWT** com papéis ADMIN e SALES
- **PWA** com suporte offline via Service Worker
- **Sidebar** com gestão de múltiplas propostas simultâneas
- **Modo escuro** persistido
- **Exportação PDF** das propostas
- **Compartilhamento WhatsApp** com formatação automática de proposta
- **GLPI integration** via n8n webhooks (reserva e cancelamento espelham no GLPI)
- **Docker Compose** com nginx + FastAPI + PostgreSQL + n8n
- **Paginação** do catálogo (grupos de 24) com infinite scroll
- **Filtros** por marca, status (novo/usado) e busca fulltext em especificações
- **Painel Admin** para gerenciamento de usuários
- Migrações de banco de dados com **Alembic**
- Teste de **race condition** para validar lock pessimista

[Unreleased]: https://github.com/oYuriyan/estoquems/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/oYuriyan/estoquems/releases/tag/v1.0.0
