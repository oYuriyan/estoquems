# Preparacao do piloto Linux — 17/11/2026

Estado: candidato em homologacao isolada. A base estavel permanece v1.1.0; a
VM de destino ainda sera preparada pela TI. Nao declarar o piloto operacional
aberto nem a integracao GLPI homologada.

## Alteracoes preparadas

- Novas reservas exigem snapshot aceito e persistido com idade de ate
  CATALOG_MAX_AGE_HOURS, atualmente 48 horas. Ausencia de validacao, data futura
  ou idade excedida bloqueiam a chamada ao n8n antes de alterar a reserva.
- Consulta e preparacao de proposta continuam disponiveis. Cancelamento de
  reserva existente continua dependendo da confirmacao GLPI, sem exigir que a
  exportacao atual esteja recente.
- Datas e permissao de reserva sao lidas do PostgreSQL, sem depender de cache
  de processo apos reinicio. O navegador usa tambem o prazo retornado pela API.
- A tela explica o bloqueio no catalogo e na revisao da proposta; o saldo
  antigo nao e apresentado como livre para reservar.
- Solicitacao e acompanhamento da exportacao passam por endpoints de
  administrador na API. HTTP 202 significa solicitacao aceita, nao importacao
  confirmada; sucesso so aparece apos validar e consultar o catalogo importado.
- O proxy publico bloqueia /webhook/ e /catalogo.json. O arquivo bruto fica
  disponivel somente em nginx:8080 na rede Docker. A porta nao e publicada no
  host. A API continua chamando n8n pela rede interna, sem mudar os workflows.
- Administracao n8n restrita ao loopback nos dois arquivos Compose. O URL
  mostrado para administracao corresponde ao tunel localhost:5678.
- Compose Linux com nome de projeto estavel, variaveis essenciais obrigatorias
  e imagens de infraestrutura fixadas nos digests ja validados. O Nginx
  redireciona para 443 na VM e preserva 3030/3443 no ambiente local.
- Preflight somente leitura para conferir ambiente Linux, URLs, volumes,
  exposicao de portas, imagens, arquivos privados, certificado e chave.

Nao ha nova migracao nesta entrega. A tabela catalog_sync_state existente na
v1.1.0 e utilizada; nao foi preenchida artificialmente na base operacional.

## Evidencias

| Controle | Resultado |
| --- | --- |
| Backend em PostgreSQL temporario separado | 113 testes passaram; 1 teste legado ignorado |
| Frontend Vitest | 35 testes passaram |
| Preflight Linux | 10 testes passaram, incluindo certificado/nome/chave incompatíveis e escapes de senha |
| ESLint, pyflakes, TypeScript e build | aprovados |
| Proxy Nginx de teste | 12 verificacoes HTTP/HTTPS: redirecionamentos, bloqueio dos webhooks/arquivo bruto e catalogo interno acessivel |
| Compose local e producao | configuracoes validadas sem iniciar a aplicacao |
| Previa visual | desktop 1280x720 e viewport de celular 390x844; botao de reserva bloqueado, aviso visivel, sem overflow horizontal |

A previa utilizou usuario, proposta e equipamentos ficticios, com banco e API
em rede interna separada e proxy ligado somente ao loopback para o navegador.
Telemetria e webhooks reais ficaram desabilitados nesse ambiente. Nenhuma
reserva GLPI, notificacao Telegram ou mensagem SMTP foi enviada pelos testes.

## Diagnostico e proximas dependencias

A leitura do n8n confirmou o agendamento diario as 06:00, o caminho do arquivo
exportado e referencia a um no ausente no ramo de conflito da reserva, inclusive
na versao publicada do workflow. A exportacao servida continua datada de
17/06/2026. O historico disponivel nao permite determinar a causa da falta de
atualizacao; nao atribuir a falha somente ao agendamento ou a rede sem evidencia.
Os detalhes operacionais e logs ficam em pasta privada, fora do Git.

Continuam necessarios: endpoint HTTPS e exportacao atual na origem, contrato
de resultado por patrimonio, idempotencia/reconciliacao, historico minimo,
patrimonio de homologacao e controle dos efeitos externos. A VM, o DNS e a
confianca do certificado nos dispositivos do grupo dependem da TI.

O cache PWA da previa exibiu o build anterior no primeiro reload e o novo apos
ativacao do service worker e novo reload. Isso precisa de tratamento/homologacao
em LUM-10; nao foi declarado resolvido automaticamente.

## Publicacao futura

Atualizar API, frontend e Nginx de forma coordenada: a API candidata passa a
ler a porta interna 8080, e a tela deixa de acessar diretamente arquivo bruto e
webhook. Nao publicar somente uma dessas partes. Revalidar restauracao e backup
final antes do corte para Linux; manter a origem sem agendamentos duplicados.
Nenhum certificado, chave ou credencial real acompanha esse candidato no Git.
