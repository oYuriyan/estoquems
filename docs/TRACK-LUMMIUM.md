# Lummium — acompanhamento da evolução

Atualizado em 19/11/2026. Este arquivo é a referência atual; PLANO-LOCACAO.md permanece como registro histórico.
Escopo: notebooks para locação, catálogo, propostas e reservas. Sem preços, margens ou cálculo financeiro.

## Entrega 1.2.0 — operações confiáveis

Histórico, resultado por item, bloqueios persistentes e recuperação foram
implementados e ensaiados. O guia atual está em [OPERACOES-CONFIAVEIS.md](OPERACOES-CONFIAVEIS.md).
A evidência inclui falha parcial e resposta perdida com reinício da API, pela
interface de homologação e com somente os dois equipamentos fictícios autorizados.
O quadro abaixo conserva a evolução anterior; não confundir validação local
com implantação na VM ou aceite dos cinco participantes em dispositivos reais.
O downgrade citado por Yuri significava retirar Telegram, sem rebaixar componentes.

## Estado publicado

- Base estavel: v1.1.0, commit 65be438, publicada e validada em 17/11. Migracao d1103_inventory_watermark ensaiada com restauracao PostgreSQL, aplicada com registros existentes preservados; CI aprovado.
- Proximo destino: VM Linux existente, com instalacao anterior congelada; diagnostico do destino pendente. Piloto com aproximadamente cinco pessoas, incluindo Yuri.
- Preparacao do proximo ciclo em homologacao: bloqueio de reservas por inventario vencido/nao validado, metadados persistentes e controle de acesso as integracoes. Nao confundir esse codigo candidato com a base estavel em uso.

- Aplicação: https://172.16.20.92:3443/ (rede interna; certificado local ainda sem confiança validada nos dispositivos).
- Recuperação por Gmail, token de uso único de 15 minutos, revogação de sessões e normalização do e-mail publicados.
- Usuário confirmou recuperação e login funcionando em 30/10/2026.
- Evidencias da v1.1.0: 90 testes backend e 22 frontend aprovados; um teste legado ignorado, substituido por concorrencia PostgreSQL isolada. Evidencias do ciclo candidato estao em [VALIDACAO-PILOTO-2026-11-17.md](VALIDACAO-PILOTO-2026-11-17.md). Nao somar execucoes repetidas como testes distintos.
- Inventário observado na última inspeção: 62 registros, data 17/06/2026. Revalidar antes de atribuir atualidade ao estoque.
- Reservas reais GLPI, falhas parciais e acesso móvel ainda não homologados ponta a ponta.

## Regras de acompanhamento

Estados: A fazer → Em execução → Em validação → Pronto para publicar → Publicado → Homologado. Usar Bloqueado apenas com impedimento descrito.
Cada item deve registrar alterações, evidência de teste, pendências e versão publicada. Teste simulado não comprova integração real.
Responsável técnico: Codex. Validação operacional e regras comerciais: Yuri/equipe indicada por ele.
Uma entrega pequena por vez. Backups e reversão antes de publicação; não alterar fluxos de terceiros nem enviar mensagens em testes sem autorização específica.

## Prioridades essenciais revisadas em 03/11/2026

**Objetivo da entrega:** permitir que o comercial consulte equipamentos confiáveis, monte uma proposta sem valores financeiros, reserve sem duplicidade e cancele com confirmação no GLPI.

P0 = bloqueador de confiabilidade, a concluir antes do piloto. P1 = mínimo funcional e validação necessários para o piloto. P2 = evolução posterior, sem bloquear o primeiro piloto, salvo falha que impeça o fluxo principal. Os identificadores abaixo foram preservados; a ordem de execução é a da tabela, não a numeração dos IDs.

| Ordem | Prioridade | Entrega essencial | Requisito funcional atendido | Motivo da prioridade |
|---|---|---|---|---|
| 1 | **P0 — essencial** | LUM-01: atualizar e conferir a origem do inventário | RF-01: consultar catálogo com origem e data verificáveis | Reserva correta depende de estoque confiável; a última observação registrada é antiga |
| 2 | **P0 — essencial** | LUM-02: disponibilidade explícita e importação segura | RF-02: selecionar apenas equipamentos reconhecidos como disponíveis | Estado ausente ou desconhecido não pode autorizar reserva |
| 3 | **P0 — essencial** | LUM-03: preservar reserva e cancelamento frente à sincronização | RF-03: manter estados coerentes entre catálogo, proposta e GLPI | Um snapshot antigo não pode desfazer uma operação confirmada |
| 4 | **P0 — essencial** | LUM-04: resultado por patrimônio, repetição segura e reconciliação | RF-04: reservar/cancelar com confirmação individual e pendência explícita | Timeout ou falha parcial não pode produzir falso sucesso nem liberar unidade de situação incerta |
| 5 | **P0 — essencial** | LUM-08: histórico mínimo persistente das operações | RF-05: rastrear autor, ação, proposta, patrimônio e resultado | É necessário investigar e resolver divergências durante a homologação; interface completa pode vir depois |
| 6 | **P0 — essencial** | LUM-05: homologação real de reserva/cancelamento | RF-06: garantir exclusividade da reserva e liberação confirmada | Testes simulados não comprovam o comportamento integrado no GLPI |
| 7 | **P1 — essencial** | LUM-06: consulta e seleção claras | RF-07: buscar, filtrar e entender disponibilidade e atualidade | O vendedor precisa encontrar a unidade correta e reconhecer dados antigos ou falhas |
| 8 | **P1 — essencial** | LUM-07: proposta persistente e sem conteúdo financeiro | RF-08: criar, salvar, reabrir e operar propostas sem duplicidade | Completa o fluxo comercial com mensagens coerentes com o resultado real |
| 9 | **P1 — essencial** | LUM-10: validar o fluxo completo nos dispositivos do piloto | RF-09: acessar e operar o sistema no desktop e celular | Acesso, recuperação de senha e ações principais precisam funcionar no uso real |
| 10 | **P1 — essencial** | LUM-12: piloto controlado com o comercial | RF-10: validar consulta → proposta → reserva → cancelamento com usuários | Fecha o aceite operacional e orienta a próxima rodada com evidências |

Os códigos RF-01 a RF-10 são uma síntese de rastreabilidade desta revisão, baseada no escopo e nos critérios já documentados; não representam novos requisitos aprovados. Segurança de acesso e isolamento entre usuários são critérios transversais: falhas de autorização ou recuperação que impeçam o uso seguro bloqueiam o piloto.

**Após o mínimo funcional:** LUM-09 (prazo/extensão, dependente de definição comercial), LUM-11 (polimento adicional de acesso), interface completa do histórico e melhorias visuais que não impeçam a operação. A definição comercial de LUM-09 pode ser levantada desde já, sem implementar liberação automática. Caso o comercial exija vencimento no piloto, redefinir o escopo e seus critérios antes de iniciá-lo.

### Fundamentação da revisão de 03/11 (historico anterior a v1.1.0)

- `backend/app/inventory.py`: a disponibilidade usa uma lista de estados bloqueados; estados desconhecidos não são rejeitados explicitamente. Sustenta a prioridade de LUM-02.
- `backend/app/catalog_sync.py`: status ausente assume `USADO`; a data da origem é lida sem rejeição explícita de snapshot antigo. A proteção de status depende de `is_reserved`, sem precedência documentada após cancelamento. Sustenta LUM-02 e LUM-03.
- `backend/app/api/quotes.py`: há bloqueio de equipamentos no banco e validação da resposta global do webhook, mas o fluxo lido não persiste identificação de operação, resultado individual ou reconciliação. Rollback local não comprova reversão remota. Sustenta LUM-04 e o histórico mínimo de LUM-08.
- O registro existente confirma recuperação/login em 30/10/2026, mas deixa a integração real e o acesso móvel sem homologação. Por isso, polimento de acesso vem depois da consistência operacional.

O texto acima registra a fundamentacao historica de 03/11. O quadro abaixo e o registro de execucao incorporam as evidencias posteriores; testes simulados continuam sem comprovar homologacao GLPI.

## Ordem de execução e critérios de aceite

| ID | Prioridade | Entrega | Dependência | Critério de aceite | Estado |
|---|---|---|---|---|---|
| LUM-01 | P0 | Diagnosticar atualização GLPI → n8n → JSON → API | Nenhuma | Identificar última execução, erro e caminho efetivamente servido; obter exportação atual válida e comparar quantidade, IDs e estados com a origem | Em execucao: origem TCP alcancavel, exportacao continua em 17/06; historico disponivel nao explica a falha. Endpoint HTTPS e exportacao real atual pendentes |
| LUM-02 | P0 | Disponibilidade explícita e integridade de importação | LUM-01: mapa dos estados | Somente estados GLPI reconhecidos como disponíveis permitem reserva; ausente/desconhecido não vira USADO disponível; arquivo vazio, duplicado, antigo ou inválido preserva estado seguro; testes documentados | Em validacao: bloqueio de nova reserva por idade/ausencia/data futura implementado e testado; metadados lidos do banco apos reinicio. Aceite com origem real pendente |
| LUM-03 | P0 | Sincronização não reverte reserva/cancelamento confirmado | LUM-02 | Reproduzir cancelamento seguido de snapshot antigo; equipamento não reaparece reservado indevidamente nem livre sem confirmação; política de precedência documentada e testada | Publicado na v1.1.0 e ensaiado em PostgreSQL; contrato e homologacao GLPI permanecem pendentes |
| LUM-04 | P0 | Resultado de integração por patrimônio e reconciliação | LUM-02, LUM-03 | Corrigir ramo de conflito n8n; identificar operação; repetição não duplica efeito; timeout e falha no segundo item deixam resultado pendente explícito; reconciliação consulta GLPI e resolve divergência | A fazer |
| LUM-08 | P0 mínimo / P2 interface completa | Histórico operacional consultável | LUM-04 | Antes de LUM-05, persistir autor, data, proposta, patrimônios, ação, resultado e ID de operação, com consulta técnica autorizada para investigar divergências; sem senhas/tokens. Interface completa por perfil fica para evolução posterior | A fazer |
| LUM-05 | P0 | Homologar reserva/cancelamento real | LUM-04, LUM-08 mínimo; patrimônio de teste indicado por Yuri | Dois vendedores disputam a mesma unidade: uma reserva; cancelamento confirmado libera corretamente; múltiplos itens e falha parcial conferidos no GLPI e no catálogo; evitar disparos reais do Telegram no ensaio | A fazer |
| LUM-06 | P1 | Clareza e usabilidade do catálogo | LUM-02 | Busca por patrimônio/modelo/série; filtros e limpar filtros previsíveis; quantidades coerentes; estados vazio, carregando, erro e inventário antigo claros; especificações legíveis no desktop e celular | Em validacao parcial: aviso, saldo de referencia e bloqueio de reserva conferidos em desktop e largura de celular com dados ficticios; aceite operacional pendente |
| LUM-07 | P1 | Polir propostas sem conteúdo financeiro | LUM-06 | Revisar campo legado margin/Condição e retirar conteúdo financeiro da interface e exportação sem apagar histórico; impedir envio duplicado; mensagens corretas para rascunho, reserva, cancelamento e erro; seleção e salvamento persistem após recarregar | A fazer |
| LUM-10 | P1 | Acesso móvel e atualização da aplicação | LUM-06, LUM-07 | Homologar Android/iOS disponível e desktop; modais/botões sem cortes; testar reconexão e cache PWA após deploy; planejar IP reservado, DNS e certificado confiável com TI; recuperar senha e entrar pelo celular | Previa responsiva conferida; dispositivos reais, confianca TLS e atualizacao PWA ainda pendentes. A previa exigiu novo reload apos ativacao do service worker |
| LUM-12 | P1 | Piloto com comercial e evidências | P0 concluídos; LUM-06, LUM-07 e fluxo móvel de LUM-10 homologados | Executar roteiro de consulta → proposta → reserva → cancelamento; registrar tempo de consulta, divergências, problemas de uso e feedback; priorizar próxima rodada com dados reais | Aguardando VM da TI e conclusao dos P0. Grupo de cinco pessoas, incluindo Yuri; roteiro e registro de feedback preparados |
| LUM-13 | P0 transversal | Restricao das rotas de integracao | LUM-02; revisao do proxy | Operacoes n8n somente pela API autorizada, arquivo bruto restrito a rede Docker, administracao n8n em loopback; testes de bloqueio e compatibilidade | Em validacao no candidato: controles de perfil na API, webhooks/JSON externos bloqueados e testes HTTP/HTTPS aprovados; nao aplicado ao ambiente estavel |
| LUM-09 | P2 condicionado à regra comercial | Prazo e extensão de reserva | Regra comercial de Yuri; LUM-04, LUM-08 | Definir prazo, responsável e extensão; distinguir aviso de vencimento de liberação real; não liberar equipamento automaticamente sem regra aprovada e confirmação GLPI; testar limite temporal e nova tentativa | Aguardando definição comercial |
| LUM-11 | P2; falhas impeditivas antecipadas | Polimento final de acesso e recuperação | Base publicada | Mostrar/ocultar senha com acessibilidade; autocomplete correto; erros distintos para limite de tentativas, indisponibilidade e credenciais inválidas; validar link expirado/reutilizado e falha SMTP; mensagens não revelam contas existentes | A fazer |

## Primeiro ciclo autorizado para planejamento

Em 17/11 o trabalho foi retomado com foco no piloto Linux. A requisicao para a
TI esta em [REQUISICAO-VM-PILOTO.md](REQUISICAO-VM-PILOTO.md), e o roteiro de
aceite e feedback em [PILOTO-COMERCIAL.md](PILOTO-COMERCIAL.md). LUM-13 passa a
integrar os bloqueadores transversais antes de LUM-05 e LUM-12. Nenhum fluxo
real ou notificacao externa foi executado na preparacao.

1. Iniciar LUM-01 com leitura de execuções/configuração n8n e comparação do catálogo servido.
2. Documentar estados GLPI encontrados e concluir regra de disponibilidade em LUM-02.
3. Reproduzir e corrigir sincronização em LUM-03 com testes isolados.
4. Definir contrato de operação e reconciliação em LUM-04 antes de alterar o fluxo real.
5. Implementar o histórico mínimo de LUM-08 para rastrear os resultados da integração.
6. Homologar LUM-05 com patrimônio de teste e controle dos efeitos externos.
7. Concluir o mínimo funcional de LUM-06, LUM-07 e LUM-10; executar o piloto LUM-12 antes das evoluções P2.

O restante está planejado; regras comerciais de vencimento, extensão, conversão para locação e devolução não devem ser inventadas. Conversão para locação/devolução fica fora deste ciclo até mapeamento operacional.

## Evidências obrigatórias antes de publicar cada entrega

- Testes apropriados à alteração aprovados, incluindo concorrência em PostgreSQL quando envolver reserva ou uso único.
- Build/tipagem/lint quando houver alteração de frontend; checagem visual desktop/móvel para mudanças visíveis.
- Backup, imagem anterior e instrução de reversão identificados; migração testada quando necessária.
- Após publicação: API/banco saudáveis, assets corretos, ausência de novos erros e teste do fluxo afetado.
- Marcar Homologado somente após validação operacional; registrar limitações sem substituir evidência por contagem de testes.

## Registro de execução

| Data | Item | Evidência/resultado | Próxima ação |
|---|---|---|---|
| 17/11/2026 | Base estavel v1.1.0 | Backups conferidos, migracao ensaiada/aplicada em PostgreSQL, registros existentes preservados, main local/GitHub e tag iguais, CI aprovado | Manter referencia estavel enquanto o candidato e homologado |
| 17/11/2026 | Preparacao do piloto Linux | Yuri confirmou cinco participantes e VM ainda a ser preparada pela TI; requisitos e roteiro de feedback registrados | TI fornecer VM, DNS, TLS, acesso SSH e destino de backups |
| 17/11/2026 | LUM-02 / LUM-06 / LUM-13 | 113 testes backend, 35 frontend, 10 de preflight e 12 verificacoes do proxy aprovados; um teste legado ignorado. Bloqueio por atualidade, metadados persistentes e rotas protegidas preparados em candidato, sem nova migracao | Fechar exportacao GLPI atual, LUM-04 e historico LUM-08; homologar com patrimonio definido |
| 30/10/2026 | Base de acesso | Yuri confirmou novo login após recuperação; normalização publicada | Iniciar LUM-01 |
| 30/10/2026 | Planejamento | Track criado com 12 itens, dependências e critérios de aceite | Revisar estado do inventário e execução n8n |
| 03/11/2026 | Revisão de prioridades | Requisitos funcionais relacionados às entregas; histórico mínimo antecipado para P0 e piloto para P1; prazo/extensão e polimento adicional classificados como P2. Leitura documental e de código, sem nova validação operacional | Iniciar LUM-01 e confirmar mapa de estados para LUM-02 |
| 03/11/2026 | LUM-01 / LUM-02 | Diagnóstico de caminho do inventário e primeira correção de disponibilidade; 36 testes API e 19 frontend aprovados; lint, tipagem e build aprovados. [Relatório da entrega](VALIDACAO-LUM-02-2026-11-03.md) | Recuperar acesso à origem, validar mapa GLPI e completar proteção temporal; não publicado |
| 03/11/2026 | Regra GLPI confirmada por Yuri | Disponíveis: DISPONIVEL NOVO e DISPONIVEL USADO. Indisponíveis: LOCADO, VENDIDO e RMA (manutenção). Removidos SEMINOVO e DISPONIVEL isolado da lista permitida; API, frontend e testes ajustados | Conferir o inventário servido e completar proteção temporal |
| 03/11/2026 | Escopo do estoque esclarecido por Yuri | Apenas DISPONIVEL NOVO/USADO entram no estoque. LOCADO/VENDIDO/RMA são excluídos da importação; registros existentes ficam inativos, preservando histórico. Cadastro manual restrito ao mesmo escopo | Validar origem e proteção temporal antes de publicar |
| 03/11/2026 | LUM-02 / LUM-03: temporalidade | Marco de inventário e confirmações persistidos; rejeição de snapshots antigos e proteção após cancelamento. 89 testes aprovados, 2 dependentes de PostgreSQL ignorados; migração/reversão SQLite e SQL PostgreSQL offline validados. [Relatório temporal](VALIDACAO-LUM-02-03-TEMPORAL-2026-11-03.md) | Concluir bloqueio de reserva por idade, metadados após reinício e contrato da origem; não publicado |
