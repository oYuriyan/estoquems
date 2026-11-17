# Lummium: catálogo de locação, propostas e reservas

Atualizado em 21/10/2026. Escopo: consulta do catálogo, propostas e reservas. Preços, margens e tabelas de valores não fazem parte desta entrega.

## Primeira entrega preparada

- Catálogo inicia com notebooks e permite filtrar outros tipos.
- Disponíveis, reservados e indisponíveis são calculados separadamente.
- Agrupamento distingue marca, tipo, modelo, processador, memória, armazenamento, sistema e tela.
- Equipamentos reservados não podem ser selecionados como livres.
- Gravações da proposta são serializadas e falhas aparecem para o usuário.
- Reserva exige rascunho, equipamentos existentes e disponibilidade confirmada sob bloqueio no banco.
- Data da reserva é gravada pelo servidor e permanece após recarregar a aplicação.
- Cancelamento exige proposta reservada e não libera equipamentos vinculados a outra reserva.
- Falha ou resposta negativa do n8n não é tratada como sucesso local.
- O inventário JSON do n8n é importado automaticamente a cada 60 segundos. Mudanças geram evento para as telas abertas.
- Inventário vazio, malformado ou com patrimônios duplicados é rejeitado antes de alterar o catálogo.
- A interface distingue última consulta e data do inventário GLPI. Inventário antigo fica sinalizado.
- Reconexão do WebSocket consulta novamente o catálogo.
- Propostas canceladas ficam em consulta, sem permitir reservar novamente a mesma proposta.

## Integração existente verificada por leitura

API, PostgreSQL, Nginx e n8n estão em execução. Os fluxos `GLPI auto inventory`, `Workflow reserva e telegram` e `GLPI - Cancelar Reserva` estão ativos.

O arquivo servido em `http://localhost:3030/catalogo.json` tinha 62 equipamentos, todos com ID GLPI, sem patrimônios ausentes ou duplicados, e data de inventário de 17/06/2026. Esse arquivo não comprova o estoque atual de outubro. O agendamento encontrado no fluxo de inventário é diário, às 06:00, no fuso configurado no n8n. Investigar por que as execuções não renovam esse arquivo.

O ramo de conflito da reserva pode responder HTTP 200 com `erro`; o backend passa a verificar o conteúdo. A expressão desse ramo referencia um nó `Loop`, embora o fluxo tenha `Loop Over Items`. Corrigir e validar esse ramo faz parte da homologação do n8n.

O fluxo de reserva possui envio pelo Telegram. Os testes usam integração simulada e não executam esse envio.

## Próximas entregas, em ordem

1. **Homologar o n8n e atualizar o inventário.** Investigar execuções do inventário, corrigir o ramo de conflito e confirmar reserva/cancelamento com equipamento de homologação. Conferir o mesmo patrimônio nos dois sistemas após cada operação.
2. **Publicar a versão preparada.** Gerar imagem da API e substituir o build do frontend após revisão. Não exige mudança no esquema do banco. Preservar build e imagem anteriores para reversão.
3. **Definir vencimento das reservas.** Esta entrega registra a data e sinaliza o prazo, mas não libera automaticamente máquinas ao vencer. Definir prazo, extensão e responsável, depois implementar liberação confirmada no GLPI.
4. **Concluir propostas de locação.** Definir como reserva passa a locação efetiva e quais estados GLPI representam retirada, devolução e manutenção. Implementar encerramento com histórico.
5. **Adicionar histórico operacional.** Registrar autor, patrimônio, proposta, estado anterior, novo estado, motivo e resultado da integração. Logs HTTP não substituem esse histórico.
6. **Executar piloto com o comercial.** Medir tempo de consulta, tempo para organizar proposta, divergências de disponibilidade e uso efetivo. Apresentar resultados medidos à gerência.

## Validação da primeira entrega

- 37 testes de backend aprovados em PostgreSQL temporário, com banco, API e containers de teste isolados do ambiente operacional.
- Concorrência: cinco propostas para a mesma máquina resultaram em uma reserva e quatro conflitos. O webhook simulado recebeu apenas uma chamada.
- 5 testes de frontend aprovados, cobrindo contagem, bloqueio de seleção, falha de gravação e ordem das alterações.
- TypeScript, ESLint e verificação de whitespace aprovados.
- Build de produção gerado em `work/preview/frontend`, separado do build servido pelo Nginx.
- Imagem `lummium-api:candidate-20261021` construída com sucesso, iniciada em rede isolada e validada pelo endpoint `/api/health` após as migrations.
- O `.env` foi excluído da imagem Docker; as credenciais passam a ser fornecidas somente pelo ambiente do container. A configuração do Compose foi validada após corrigir o escape literal de `$` em `JWT_SECRET_KEY`.
- A chave JWT resolvida pelo Compose corrigido difere da que está no container atual. Após a recriação da API, as sessões existentes exigirão novo login.
- Containers de testes removidos após a execução. Os containers operacionais e o build servido pelo Nginx não foram substituídos.

## Critérios de homologação

- Dois vendedores tentam reservar o mesmo patrimônio: um consegue e o outro recebe conflito.
- Cancelar rascunho não altera reserva de outro vendedor.
- Falha do GLPI mantém reserva local e não mostra sucesso.
- Atualização válida chega ao banco e às telas abertas.
- Arquivo vazio ou duplicado preserva catálogo anterior.
- Filtrar ou mudar de página não classifica item como indisponível apenas por ausência na página.
- Data da reserva permanece correta após sair e entrar novamente.
- Conferir visualmente desktop e celular, incluindo proposta vazia, reservada e cancelada.

## Limites desta entrega

Não existe transação única entre PostgreSQL e GLPI. Timeout após alteração remota pode exigir reconciliação. A homologação deve incluir falhas parciais e múltiplos equipamentos; confirmação HTTP sozinha não prova atualização de todos os itens. A evolução deve incluir identificação idempotente da operação, resultado por patrimônio e reconciliação.

A atualização automática importa o arquivo que o n8n disponibiliza; sua atualidade depende de o fluxo GLPI concluir corretamente. O processo continua com um único worker da API. Múltiplos processos exigirão coordenação compartilhada da sincronização e dos eventos.
