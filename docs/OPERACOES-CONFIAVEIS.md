# Operações confiáveis — versão 1.2.0

Esta entrega integra o candidato de inventário/rotas e os workflows sem Telegram.
O histórico começa nas operações realizadas a partir desta versão. As propostas
anteriores são preservadas; não se inventa histórico para ações antigas.

## Histórico persistente

Antes de chamar o GLPI, a API registra operação, autor, proposta e equipamentos,
e confirma a transação no PostgreSQL. Cada item guarda o ID GLPI e o serial
daquela operação. Tentativas, resultados e conferências produzem eventos.
O histórico fica disponível dentro da proposta, com autor e horário.

O dono da proposta pode consultar e operar seu histórico. Administradores podem
consultar o histórico técnico de outras propostas, sem ganhar permissão de
escrita sobre elas. Propostas com histórico não são apagadas pelo endpoint de
exclusão. O histórico não guarda tokens, senhas, headers, corpos remotos ou
comentários brutos do GLPI.

## Falha parcial, timeout e reinício

Os equipamentos recebem um bloqueio persistente antes de qualquer efeito
externo. A importação do catálogo não sobrescreve nem desativa itens pendentes.
Duas propostas, inclusive em sessões independentes, não podem obter o mesmo
ID GLPI enquanto ele estiver reservado ou aguardando conferência.

Uma confirmação só é aceita quando identifica a operação e todos os itens
esperados, sem duplicação. Resposta global de sucesso, item ausente, ID errado
ou resposta perdida deixam a operação pendente. Itens confirmados e pendentes
aparecem separadamente; a proposta só passa a reservada/cancelada quando todos
os itens correspondentes estão confirmados.

- **Conferir no GLPI:** consulta estados e vínculo com a proposta, sem escrever.
- **Tentar concluir:** primeiro confere; depois retoma a mesma operação, quando
  necessário e permitido, sem gerar outra solicitação independente.
- **Desfazer reserva parcial:** confere e cancela somente os itens que ainda
  pertencem à proposta. Mantém uma operação de liberação ligada à reserva
  original e devolve a proposta a rascunho quando a liberação é confirmada.
- **Conferência automática:** a cada 30 segundos procura operações pendentes
  cujo prazo já passou. Faz somente leitura e continua após reinício da API.

Os workflows de escrita têm limite de 45 segundos, e uma tentativa incerta
mantém prazo de proteção de 90 segundos. Estados desconhecidos mantêm o bloqueio.
Uma geração persistida impede que resultado atrasado substitua uma conferência
mais recente. O prazo é uma proteção operacional; não equivale a transação
atômica entre GLPI e PostgreSQL ou a controle sobre alterações feitas fora da
aplicação. Divergências desconhecidas continuam exigindo investigação.

## Interface e atualização

A proposta mostra o estado pendente, o resultado por serial, as ações de
recuperação e o histórico. Edição e exclusão ficam bloqueadas enquanto houver
pendência. HTTP 202 significa pendência, nunca sucesso comercial.

As ações usam o header de capacidade `X-Lummium-Operations: 1`.
Telas antigas em cache recebem HTTP 428 antes de iniciar uma operação e devem
ser recarregadas. Publicar API, frontend e Nginx coordenadamente.

## Integração e configuração privada

São quatro templates em `integrations/n8n/`: inventário, reserva,
cancelamento e conferência. O preparador offline conserva os IDs existentes
e cria um ID próprio para a nova conferência. Ele combina configurações
existentes com o limite de execução do template, conserva o mapa privado de
identidades e nunca publica nem sobrescreve arquivos de saída.

Preparar a partir de exportação CLI e mapa privados; nunca versionar o arquivo
preenchido. O workflow de conferência usa somente GET no GLPI, e o resultado
não inclui comentários ou credenciais. Todos os fluxos ativos desta entrega
ficam sem Telegram.

## Migração, backup e reversão

A revisão `e1119_operation_ledger` adiciona três tabelas de operações e um
campo de bloqueio ao equipamento. Não reescreve usuários, propostas ou
equipamentos existentes. A migração foi ensaiada com restauração do dump
atual e comparação das impressões digitais dos registros.

Antes da publicação: backup consistente PostgreSQL e n8n, configuração n8n
(incluindo sua chave de criptografia), catálogo, arquivos de execução e imagem
anterior. Preservar todos os volumes e fazer nova cópia após a publicação.

Downgrade que apagaria histórico é recusado. Não retornar a uma API antiga
enquanto houver pendências: ela desconhece os bloqueios novos. Em falha de
publicação, suspender escritas e ensaiar recuperação isolada, preservando
gravações posteriores ao backup. Preferir correção progressiva com o histórico
intacto.

## Evidência funcional

Os testes de backend cobrem persistência antes do efeito externo, timeout,
resultado inválido, recuperação por outra sessão, geração atrasada, bloqueio
por ID GLPI, importação durante pendência, autorização, cancelamento parcial e
desfazimento. A concorrência usa PostgreSQL com sessões independentes.

A interface foi exercitada com usuário/banco fictícios e um proxy que só
encaminhava operações nos dois equipamentos fictícios autorizados no GLPI real.
Foram conferidos reserva/cancelamento, conflito de outro usuário, conclusão de
reserva parcial, desfazimento apenas da parte confirmada e resposta perdida
após escrita, com reinício da API e recuperação sem nova reserva. Os prazos dos
cenários parciais foram avançados somente no banco de homologação; a perda de
resposta foi recuperada após o prazo e o reinício. Os equipamentos terminaram
disponíveis com os comentários originais.

Houve checagem visual em desktop e viewport móvel medido de 325 × 703 CSS,
sem overflow horizontal. Isso não substitui aceite em celulares físicos,
confiança TLS nos dispositivos ou ensaio na VM existente.

A VM Linux permanece com instalação anterior congelada e não foi acessada
nesta etapa. Sua retomada exige diagnóstico de versões/dados, restauração
ensaiada e controle dos agendamentos para não executar duas origens.
