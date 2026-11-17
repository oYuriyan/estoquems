from docx import Document
from docx.shared import Pt, RGBColor, Cm, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
import os

def set_cell_background(cell, fill, color=None, val=None):
    """Set the background color for a cell."""
    tcPr = cell._tc.get_or_add_tcPr()
    tcBorders = tcPr.first_child_found_in("w:tcBorders")
    if tcBorders is None:
        tcBorders = OxmlElement('w:tcBorders')
        tcPr.append(tcBorders)

    # Add shading
    shd = OxmlElement('w:shd')
    shd.set(qn('w:val'), val if val else 'clear')
    shd.set(qn('w:color'), color if color else 'auto')
    shd.set(qn('w:fill'), fill)
    tcPr.append(shd)

def create_document():
    doc = Document()

    # Configure margins
    sections = doc.sections
    for section in sections:
        section.top_margin = Cm(2.5)
        section.bottom_margin = Cm(2.5)
        section.left_margin = Cm(2.5)
        section.right_margin = Cm(2.5)

    # Styles
    styles = doc.styles
    normal_style = styles['Normal']
    normal_font = normal_style.font
    normal_font.name = 'Calibri'
    normal_font.size = Pt(11)
    normal_font.color.rgb = RGBColor(0x1F, 0x29, 0x37) # Dark gray

    # Cover Page
    doc.add_paragraph()
    doc.add_paragraph()
    doc.add_paragraph()

    title = doc.add_paragraph('LUMMIUM')
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title_font = title.runs[0].font
    title_font.name = 'Calibri Light'
    title_font.size = Pt(48)
    title_font.bold = True
    title_font.color.rgb = RGBColor(0x4F, 0x46, 0xE5) # Indigo

    subtitle = doc.add_paragraph('Inteligência e fluidez para o seu estoque.')
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sub_font = subtitle.runs[0].font
    sub_font.name = 'Calibri Light'
    sub_font.size = Pt(18)
    sub_font.color.rgb = RGBColor(0x37, 0x41, 0x51)

    doc.add_paragraph()
    doc.add_paragraph()

    doc_type = doc.add_paragraph('Documento Técnico e Executivo')
    doc_type.alignment = WD_ALIGN_PARAGRAPH.CENTER
    dt_font = doc_type.runs[0].font
    dt_font.name = 'Calibri Light'
    dt_font.size = Pt(14)
    dt_font.bold = True

    doc.add_paragraph()

    info_date = doc.add_paragraph('Julho de 2026')
    info_date.alignment = WD_ALIGN_PARAGRAPH.CENTER

    info_author = doc.add_paragraph('Autor: Yuri Yan')
    info_author.alignment = WD_ALIGN_PARAGRAPH.CENTER

    doc.add_page_break()

    # Heading Styles
    h1_style = styles['Heading 1']
    h1_font = h1_style.font
    h1_font.name = 'Calibri Light'
    h1_font.size = Pt(18)
    h1_font.bold = True
    h1_font.color.rgb = RGBColor(0x4F, 0x46, 0xE5)

    h2_style = styles['Heading 2']
    h2_font = h2_style.font
    h2_font.name = 'Calibri Light'
    h2_font.size = Pt(14)
    h2_font.bold = True
    h2_font.color.rgb = RGBColor(0x37, 0x30, 0xA3)

    h3_style = styles['Heading 3']
    h3_font = h3_style.font
    h3_font.name = 'Calibri Light'
    h3_font.size = Pt(12)
    h3_font.bold = True
    h3_font.color.rgb = RGBColor(0x37, 0x41, 0x51)

    # Sumário
    doc.add_heading('Sumário', level=1)
    toc_items = [
        "1. Sumário Executivo",
        "2. Problema e Contexto",
        "3. Solução — Mapeamento Dor → Solução",
        "4. Arquitetura Técnica",
        "5. Funcionalidades Detalhadas",
        "6. Segurança",
        "7. Observabilidade e Monitoramento",
        "8. DevOps e CI/CD",
        "9. Testes Automatizados",
        "10. Métricas e Impacto",
        "11. Roadmap",
        "12. Conclusão"
    ]
    for item in toc_items:
        p = doc.add_paragraph(item)
        p.paragraph_format.left_indent = Pt(20)

    doc.add_page_break()

    # Section 1
    doc.add_heading('1. Sumário Executivo', level=1)
    doc.add_paragraph('O Lummium é uma plataforma web completa de gerenciamento de alocações e reservas de equipamentos de TI, desenvolvida internamente para resolver gargalos operacionais críticos no fluxo de venda e distribuição de ativos tecnológicos. A solução integra catálogo inteligente, sistema de propostas com reserva em tempo real, e sincronização bidirecional com o GLPI — o sistema de gestão de ativos já utilizado pela organização.')
    doc.add_paragraph('O projeto nasceu da necessidade de eliminar processos manuais, conflitos de reserva concorrente, e a falta de visibilidade em tempo real sobre a disponibilidade de equipamentos. O Lummium substitui planilhas, comunicações informais e processos fragmentados por uma plataforma única, em tempo real, com controle de acesso e auditoria completa.')

    # Section 2
    doc.add_heading('2. Problema e Contexto', level=1)
    doc.add_heading('2.1 Dores Identificadas', level=2)

    table_dores = doc.add_table(rows=1, cols=3)
    table_dores.style = 'Table Grid'
    hdr_cells = table_dores.rows[0].cells
    hdr_cells[0].text = '#'
    hdr_cells[1].text = 'Dor'
    hdr_cells[2].text = 'Impacto Operacional'

    for cell in hdr_cells:
        set_cell_background(cell, '4F46E5')
        for paragraph in cell.paragraphs:
            for run in paragraph.runs:
                run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
                run.font.bold = True

    dores_data = [
        ('1', 'Reservas conflitantes — dois vendedores reservam o mesmo equipamento', 'Retrabalho, atrasos na entrega, insatisfação do cliente'),
        ('2', 'Falta de visibilidade — ninguém sabe em tempo real o que está disponível', 'Vendedores consultam manualmente ou ligam para o estoque'),
        ('3', 'Processos manuais — propostas e reservas geridas em planilhas/e-mails', 'Perda de dados, ausência de histórico, zero auditoria'),
        ('4', 'Sistemas desconectados — GLPI não reflete reservas feitas fora dele', 'Divergência de inventário, informação duplicada'),
        ('5', 'Sem mobilidade — vendedores externos não têm acesso remoto ao catálogo', 'Dependência de acesso presencial ou comunicação por telefone'),
        ('6', 'Sem controle de acesso — qualquer pessoa pode alterar dados críticos', 'Risco de alterações indevidas, sem rastreabilidade')
    ]
    for idx, (num, dor, imp) in enumerate(dores_data):
        row_cells = table_dores.add_row().cells
        row_cells[0].text = num
        row_cells[1].text = dor
        row_cells[2].text = imp
        if idx % 2 != 0:
            for cell in row_cells:
                set_cell_background(cell, 'F9FAFB')

    # Section 3
    doc.add_heading('3. Solução — Mapeamento Dor → Solução', level=1)

    table_sol = doc.add_table(rows=1, cols=3)
    table_sol.style = 'Table Grid'
    hdr_cells = table_sol.rows[0].cells
    hdr_cells[0].text = 'Dor'
    hdr_cells[1].text = 'Solução Lummium'
    hdr_cells[2].text = 'Mecanismo Técnico'

    for cell in hdr_cells:
        set_cell_background(cell, '4F46E5')
        for paragraph in cell.paragraphs:
            for run in paragraph.runs:
                run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
                run.font.bold = True

    sol_data = [
        ('Reservas conflitantes', 'Lock pessimista garante integridade atômica', 'SELECT ... FOR UPDATE no PostgreSQL'),
        ('Falta de visibilidade', 'WebSockets atualizam catálogo em tempo real', 'Broadcast de eventos RESERVED/CANCELED'),
        ('Processos manuais', 'Sistema de propostas digital com fluxo de status', 'DRAFT → RESERVED → WON/CANCELED'),
        ('Sistemas desconectados', 'Integração GLPI automática via n8n', 'Webhooks bidirecionais'),
        ('Sem mobilidade', 'PWA com suporte offline e instalável', 'Service Worker + Cache API'),
        ('Sem controle de acesso', 'RBAC com JWT e papéis ADMIN/SALES', 'Tokens JWT com expiração + bcrypt')
    ]
    for idx, (dor, sol, mec) in enumerate(sol_data):
        row_cells = table_sol.add_row().cells
        row_cells[0].text = dor
        row_cells[1].text = sol
        row_cells[2].text = mec
        if idx % 2 != 0:
            for cell in row_cells:
                set_cell_background(cell, 'F9FAFB')

    doc.add_page_break()

    # Section 4
    doc.add_heading('4. Arquitetura Técnica', level=1)
    doc.add_heading('4.1 Stack Tecnológico', level=2)

    table_stack = doc.add_table(rows=1, cols=4)
    table_stack.style = 'Table Grid'
    hdr_cells = table_stack.rows[0].cells
    hdr_cells[0].text = 'Camada'
    hdr_cells[1].text = 'Tecnologia'
    hdr_cells[2].text = 'Versão'
    hdr_cells[3].text = 'Justificativa'

    for cell in hdr_cells:
        set_cell_background(cell, '4F46E5')
        for paragraph in cell.paragraphs:
            for run in paragraph.runs:
                run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
                run.font.bold = True

    stack_data = [
        ('Frontend', 'React + TypeScript', '19.x', 'Ecossistema maduro, tipagem forte, performance'),
        ('Bundler', 'Vite', '8.x', 'Build extremamente rápido, HMR instantâneo'),
        ('Estilização', 'TailwindCSS', '4.x', 'Produtividade, design system consistente'),
        ('Backend', 'FastAPI (Python)', '0.115.x', 'Async nativo, documentação automática (OpenAPI), alta performance'),
        ('ORM', 'SQLAlchemy', '2.0.x', 'Mapeamento objeto-relacional assíncrono, maturidade'),
        ('Banco de Dados', 'PostgreSQL', '15 Alpine', 'Confiabilidade, locks pessimistas, performance'),
        ('Migrations', 'Alembic', '1.14.x', 'Versionamento de schema, rollback seguro'),
        ('Automação', 'n8n', 'Latest', 'Fluxos visuais, integrações low-code com GLPI'),
        ('Proxy Reverso', 'Nginx', 'Alpine', 'SSL, rate limiting, caching de assets, gzip'),
        ('Contêineres', 'Docker Compose', '—', 'Orquestração simplificada, reprodutibilidade'),
        ('CI/CD', 'GitHub Actions', '—', 'Automação de lint, testes e build'),
        ('Monitoramento', 'Sentry', '2.19.x / 10.57.x', 'Error tracking + performance monitoring')
    ]
    for idx, (camada, tech, ver, just) in enumerate(stack_data):
        row_cells = table_stack.add_row().cells
        row_cells[0].text = camada
        row_cells[1].text = tech
        row_cells[2].text = ver
        row_cells[3].text = just
        if idx % 2 != 0:
            for cell in row_cells:
                set_cell_background(cell, 'F9FAFB')

    doc.add_heading('4.2 Topologia de Rede', level=2)
    topo = doc.add_paragraph('''REDE CORPORATIVA

Vendedor ──────────► Nginx :443 (HTTPS/TLS)
                      │
                      ├── /api/*    → FastAPI :8000
                      ├── /api/ws   → WebSocket :8000
                      ├── /webhook/ → n8n (interno)
                      └── /*        → React SPA

Admin (SSH Tunnel) ──► n8n :5678 (127.0.0.1 only)

PostgreSQL :5432 (não exposto)
API :8000 (não exposto)''')
    topo.runs[0].font.name = 'Consolas'
    topo.runs[0].font.size = Pt(9)

    p = doc.add_paragraph()
    r = p.add_run('Nenhuma porta de serviço interno está exposta à rede. Apenas o Nginx (80/443) é acessível externamente.')
    r.bold = True
    r.italic = True

    # Section 5
    doc.add_heading('5. Funcionalidades Detalhadas', level=1)

    doc.add_heading('5.1 Catálogo de Equipamentos em Tempo Real', level=2)
    doc.add_paragraph('Agrupamento inteligente por modelo, especificações e condição (novo/usado)', style='List Bullet')
    doc.add_paragraph('Busca full-text com Fuse.js (fuzzy search)', style='List Bullet')
    doc.add_paragraph('Filtros compostos: marca, status, texto livre', style='List Bullet')
    doc.add_paragraph('Paginação infinita em lotes de 24 grupos', style='List Bullet')
    doc.add_paragraph('Atualização em tempo real via WebSocket — todos os vendedores conectados veem mudanças instantaneamente', style='List Bullet')

    doc.add_heading('5.2 Sistema de Propostas', level=2)
    doc.add_paragraph('Múltiplas propostas simultâneas via sidebar lateral', style='List Bullet')
    doc.add_paragraph('Seleção de quantidade limitada pelo estoque disponível', style='List Bullet')
    doc.add_paragraph('Reserva atômica com lock pessimista', style='List Bullet')
    doc.add_paragraph('Exportação em PDF profissional com jsPDF', style='List Bullet')
    doc.add_paragraph('Compartilhamento via WhatsApp com texto pré-formatado', style='List Bullet')
    doc.add_paragraph('Campos de detalhamento do cliente (nome, e-mail, empresa, telefone)', style='List Bullet')
    doc.add_paragraph('Fluxo de status: DRAFT → RESERVED → WON/CANCELED', style='List Bullet')

    doc.add_heading('5.3 Lock Pessimista — Integridade de Reservas', level=2)
    p = doc.add_paragraph()
    r = p.add_run('Este é o mecanismo mais crítico do sistema. Sem ele, dois vendedores poderiam reservar o mesmo equipamento simultaneamente.')
    r.bold = True

    table_lock = doc.add_table(rows=1, cols=3)
    table_lock.style = 'Table Grid'
    hdr_cells = table_lock.rows[0].cells
    hdr_cells[0].text = 'Aspecto'
    hdr_cells[1].text = 'Lock Otimista'
    hdr_cells[2].text = 'Lock Pessimista (escolhido)'
    for cell in hdr_cells:
        set_cell_background(cell, '4F46E5')
        for paragraph in cell.paragraphs:
            for run in paragraph.runs:
                run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
                run.font.bold = True

    lock_data = [
        ('Conflito detectado em', 'Momento do commit', 'Momento da leitura'),
        ('Experiência do usuário', 'Erro após preencher toda a proposta', 'Impedido antes de iniciar'),
        ('Adequado para', 'Baixa concorrência', 'Alta concorrência (cenário do Lummium)'),
        ('Integridade', 'Pode haver janela de inconsistência', 'Garantia absoluta')
    ]
    for idx, (asp, ot, pe) in enumerate(lock_data):
        row_cells = table_lock.add_row().cells
        row_cells[0].text = asp
        row_cells[1].text = ot
        row_cells[2].text = pe
        if idx % 2 != 0:
            for cell in row_cells:
                set_cell_background(cell, 'F9FAFB')

    doc.add_heading('5.4 Integração GLPI via n8n', level=2)
    doc.add_paragraph('Reserva (POST /webhook/reserve) — atualiza status dos ativos no GLPI', style='List Bullet')
    doc.add_paragraph('Cancelamento (POST /webhook/cancel) — reverte status no GLPI', style='List Bullet')
    doc.add_paragraph('n8n roda como container Docker isolado com acesso administrativo restrito via SSH tunnel', style='List Bullet')

    doc.add_heading('5.5 Autenticação e Autorização (RBAC)', level=2)
    table_rbac = doc.add_table(rows=1, cols=2)
    table_rbac.style = 'Table Grid'
    hdr_cells = table_rbac.rows[0].cells
    hdr_cells[0].text = 'Papel'
    hdr_cells[1].text = 'Permissões'
    for cell in hdr_cells:
        set_cell_background(cell, '4F46E5')
        for paragraph in cell.paragraphs:
            for run in paragraph.runs:
                run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
                run.font.bold = True

    rbac_data = [
        ('ADMIN', 'Gerenciamento de usuários, acesso ao painel administrativo, todas as operações'),
        ('SALES', 'Visualizar catálogo, criar/gerenciar propostas, exportar PDFs')
    ]
    for idx, (papel, perm) in enumerate(rbac_data):
        row_cells = table_rbac.add_row().cells
        row_cells[0].text = papel
        row_cells[1].text = perm
        if idx % 2 != 0:
            for cell in row_cells:
                set_cell_background(cell, 'F9FAFB')
    doc.add_paragraph('Tokens JWT com expiração, senhas com bcrypt, middleware de autenticação.')

    doc.add_heading('5.6 PWA — Progressive Web App', level=2)
    doc.add_paragraph('Service Worker para cache de assets estáticos', style='List Bullet')
    doc.add_paragraph('Manifesto PWA com ícones, tema e splash screen', style='List Bullet')
    doc.add_paragraph('Suporte offline', style='List Bullet')
    doc.add_paragraph('Instalável em dispositivos móveis e desktops', style='List Bullet')

    doc.add_page_break()

    # Section 6
    doc.add_heading('6. Segurança', level=1)
    doc.add_heading('6.1 Quatro Camadas de Proteção', level=2)
    doc.add_paragraph('Camada 1 — Rede: SSL/TLS, portas internas não expostas, n8n via SSH tunnel', style='List Bullet')
    doc.add_paragraph('Camada 2 — Nginx: Rate Limiting (5 req/min auth, 120 req/min API), Security Headers, Gzip, server_tokens off', style='List Bullet')
    doc.add_paragraph('Camada 3 — Aplicação: JWT, bcrypt, RBAC, CORS restrito, Pydantic validation', style='List Bullet')
    doc.add_paragraph('Camada 4 — Banco de Dados: Lock pessimista, credenciais via env vars, porta não exposta', style='List Bullet')

    doc.add_heading('6.2 Headers de Segurança', level=2)
    table_headers = doc.add_table(rows=1, cols=3)
    table_headers.style = 'Table Grid'
    hdr_cells = table_headers.rows[0].cells
    hdr_cells[0].text = 'Header'
    hdr_cells[1].text = 'Valor'
    hdr_cells[2].text = 'Proteção'
    for cell in hdr_cells:
        set_cell_background(cell, '4F46E5')
        for paragraph in cell.paragraphs:
            for run in paragraph.runs:
                run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
                run.font.bold = True

    headers_data = [
        ('X-Frame-Options', 'DENY', 'Previne clickjacking'),
        ('X-Content-Type-Options', 'nosniff', 'Previne MIME sniffing'),
        ('Referrer-Policy', 'strict-origin-when-cross-origin', 'Controla vazamento de referrer'),
        ('Permissions-Policy', 'Camera, mic, geo, payment desabilitados', 'Minimiza superfície de ataque'),
        ('Content-Security-Policy', 'Whitelist restrita', 'Previne XSS e injeção de conteúdo'),
        ('server_tokens', 'off', 'Oculta versão do Nginx')
    ]
    for idx, (hdr, val, prot) in enumerate(headers_data):
        row_cells = table_headers.add_row().cells
        row_cells[0].text = hdr
        row_cells[1].text = val
        row_cells[2].text = prot
        if idx % 2 != 0:
            for cell in row_cells:
                set_cell_background(cell, 'F9FAFB')

    # Section 7
    doc.add_heading('7. Observabilidade e Monitoramento', level=1)
    doc.add_paragraph('Sentry integrado no backend (FastAPI) e frontend (React) — error tracking e performance', style='List Bullet')
    doc.add_paragraph('Error Boundary React com UI de fallback e report automático ao Sentry', style='List Bullet')
    doc.add_paragraph('Health Check enriquecido (GET /api/health): status do DB, latência, versão, conexões WebSocket', style='List Bullet')
    doc.add_paragraph('Logging estruturado com X-Request-ID em todas as requisições', style='List Bullet')

    # Section 8
    doc.add_heading('8. DevOps e CI/CD', level=1)
    doc.add_heading('8.1 Containerização', level=2)
    table_cont = doc.add_table(rows=1, cols=3)
    table_cont.style = 'Table Grid'
    hdr_cells = table_cont.rows[0].cells
    hdr_cells[0].text = 'Serviço'
    hdr_cells[1].text = 'Imagem'
    hdr_cells[2].text = 'Função'
    for cell in hdr_cells:
        set_cell_background(cell, '4F46E5')
        for paragraph in cell.paragraphs:
            for run in paragraph.runs:
                run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
                run.font.bold = True

    cont_data = [
        ('nginx', 'nginx:alpine', 'Reverse proxy, SSL, cache, rate limiting'),
        ('api', 'Custom (Dockerfile)', 'Backend FastAPI'),
        ('db', 'postgres:15-alpine', 'Banco de dados'),
        ('n8n', 'n8nio/n8n:latest', 'Automação de workflows'),
        ('init-perms', 'alpine', 'Inicialização de permissões de volumes')
    ]
    for idx, (srv, img, fun) in enumerate(cont_data):
        row_cells = table_cont.add_row().cells
        row_cells[0].text = srv
        row_cells[1].text = img
        row_cells[2].text = fun
        if idx % 2 != 0:
            for cell in row_cells:
                set_cell_background(cell, 'F9FAFB')

    doc.add_heading('8.2 Pipeline CI/CD (GitHub Actions)', level=2)
    doc.add_paragraph('Job 1 — Backend: Python 3.12, pip cache, pyflakes lint, pytest com SQLite in-memory', style='List Bullet')
    doc.add_paragraph('Job 2 — Frontend: Node 22, npm ci, ESLint, build de produção, verificação de bundle size', style='List Bullet')
    doc.add_paragraph('Job 3 — Docker Build: Build da imagem, validação de import da aplicação', style='List Bullet')
    doc.add_paragraph('Features: Concorrência inteligente, cache de dependências, testes sem Docker')

    doc.add_page_break()

    # Section 9
    doc.add_heading('9. Testes Automatizados', level=1)
    table_testes = doc.add_table(rows=1, cols=2)
    table_testes.style = 'Table Grid'
    hdr_cells = table_testes.rows[0].cells
    hdr_cells[0].text = 'Área'
    hdr_cells[1].text = 'O que testa'
    for cell in hdr_cells:
        set_cell_background(cell, '4F46E5')
        for paragraph in cell.paragraphs:
            for run in paragraph.runs:
                run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
                run.font.bold = True

    testes_data = [
        ('Autenticação', 'Login, JWT, expiração de tokens, acesso não autorizado'),
        ('Equipamentos e Propostas', 'CRUD de equipamentos, criação de propostas, reserva, cancelamento'),
        ('Race Condition', 'Dois vendedores tentando reservar simultaneamente — valida o lock pessimista')
    ]
    for idx, (area, teste) in enumerate(testes_data):
        row_cells = table_testes.add_row().cells
        row_cells[0].text = area
        row_cells[1].text = teste
        if idx % 2 != 0:
            for cell in row_cells:
                set_cell_background(cell, 'F9FAFB')
    doc.add_paragraph('Details: pytest + pytest-asyncio, banco in-memory com aiosqlite, fixtures isoladas, CI integrado')

    # Section 10
    doc.add_heading('10. Métricas e Impacto', level=1)
    table_metr = doc.add_table(rows=1, cols=3)
    table_metr.style = 'Table Grid'
    hdr_cells = table_metr.rows[0].cells
    hdr_cells[0].text = 'Métrica'
    hdr_cells[1].text = 'Antes (estimativa)'
    hdr_cells[2].text = 'Com Lummium'
    for cell in hdr_cells:
        set_cell_background(cell, '4F46E5')
        for paragraph in cell.paragraphs:
            for run in paragraph.runs:
                run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
                run.font.bold = True

    metr_data = [
        ('Tempo para verificar disponibilidade', '30min–2h', '< 5 segundos'),
        ('Conflitos de reserva por mês', '3–5 ocorrências', 'Zero (lock pessimista)'),
        ('Tempo para montar uma proposta', '20–40 minutos', '< 5 minutos'),
        ('Sincronização com GLPI', 'Diária (quando lembrado)', 'Automática e instantânea'),
        ('Visibilidade do estoque para vendedores', 'Sob demanda (ligar/WhatsApp)', 'Tempo real, 24/7')
    ]
    for idx, (met, ant, lum) in enumerate(metr_data):
        row_cells = table_metr.add_row().cells
        row_cells[0].text = met
        row_cells[1].text = ant
        row_cells[2].text = lum
        if idx % 2 != 0:
            for cell in row_cells:
                set_cell_background(cell, 'F9FAFB')

    doc.add_paragraph('\nGanhos qualitativos:')
    doc.add_paragraph('Auditabilidade — cada ação é rastreável', style='List Bullet')
    doc.add_paragraph('Padronização — propostas em formato consistente', style='List Bullet')
    doc.add_paragraph('Escalabilidade — preparado para crescer', style='List Bullet')
    doc.add_paragraph('Confiabilidade — Sentry, health checks, testes', style='List Bullet')
    doc.add_paragraph('Autonomia — vendedores independentes', style='List Bullet')

    # Section 11
    doc.add_heading('11. Roadmap', level=1)
    doc.add_heading('11.1 Entregues (v1.0.0 — Mai/2026)', level=2)
    entregues = ['Catálogo com agrupamento inteligente', 'Sistema de propostas com ciclo de vida completo', 'Lock pessimista para integridade', 'WebSockets tempo real', 'JWT com RBAC', 'PWA offline', 'PDF e WhatsApp', 'Integração GLPI via n8n', 'Docker + Nginx + SSL', 'Painel administrativo']
    for e in entregues:
        doc.add_paragraph(e, style='List Bullet')

    doc.add_heading('11.2 Em Desenvolvimento', level=2)
    dev = ['Logging com X-Request-ID', 'Sentry (backend + frontend)', 'Error Boundary React', 'Rate limiting dupla camada', 'Security headers fortalecidos', 'Health check enriquecido', 'CI/CD GitHub Actions', 'Suite de testes automatizados']
    for d in dev:
        doc.add_paragraph(d, style='List Bullet')

    doc.add_heading('11.3 Futuro', level=2)
    fut = ['Dashboard analítico', 'Notificações push', 'Relatórios gerenciais', 'Integração com outros sistemas', 'API pública', 'Suporte multi-filial']
    for f in fut:
        doc.add_paragraph(f, style='List Bullet')

    doc.add_page_break()

    # Section 12
    doc.add_heading('12. Conclusão', level=1)
    doc.add_paragraph('O Lummium representa uma transformação digital no processo de gestão de equipamentos de TI. Ao substituir processos manuais, fragmentados e propensos a erro por uma plataforma unificada, em tempo real e com garantias de integridade, o projeto entrega:')
    conclusao_list = [
        'Eliminação de conflitos de reserva — com garantia matemática via lock pessimista',
        'Visibilidade completa e instantânea — via WebSockets e PWA',
        'Integração nativa com o ecossistema existente — GLPI sincronizado automaticamente',
        'Segurança em múltiplas camadas — do TLS ao RBAC',
        'Autonomia da equipe comercial — vendedores independentes, mesmo em campo',
        'Base sólida para evolução — arquitetura modular, containerizada, com CI/CD e testes'
    ]
    for c in conclusao_list:
        doc.add_paragraph(c, style='List Number')

    p = doc.add_paragraph()
    r = p.add_run('O Lummium não é apenas um sistema de estoque — é uma plataforma de inteligência operacional que transforma dados em decisões e processos manuais em fluxos automatizados.')
    r.bold = True

    doc.add_paragraph('\n---\n')
    doc.add_paragraph('Repositório: github.com/oYuriyan/estoquems')
    doc.add_paragraph('Versão: 1.0.0 (Mai/2026)')
    doc.add_paragraph('Autor: Yuri Yan')
    doc.add_paragraph('Data: Julho de 2026')

    doc.save(r'C:\Users\Yuri Yan\Documents\estoque\Lummium_Documento_Tecnico.docx')

if __name__ == '__main__':
    create_document()
