# LUM-02 / LUM-03 — proteção temporal da sincronização

Data: 03/11/2026. Estado: implementação validada localmente; não publicada nem homologada no GLPI.

## Comportamento implementado

- A importação exige `metadados.ultimaAtualizacao` em formato ISO com fuso horário. Data ausente, inválida, futura ou antiga rejeita o snapshot antes de alterar equipamentos.
- `CATALOG_MAX_AGE_HOURS` define a idade máxima. O padrão técnico inicial é 48 horas, considerando o agendamento diário descrito no plano. A configuração está exposta nos dois arquivos Compose, aceita somente inteiro positivo e precisa ser conferida com a cadência operacional.
- A tabela `catalog_sync_state` persiste data da origem, hash do conteúdo e hora da importação. Snapshots anteriores ao último aceito são rejeitados mesmo depois de reiniciar o processo. Conteúdo diferente com a mesma data também é rejeitado. `force=True` não contorna essas validações.
- Reservas e cancelamentos gravam `inventory_confirmed_at` nos equipamentos somente após confirmação da integração, na mesma transação da alteração local. Falha remota não deixa esse marcador gravado.
- Snapshot com data menor ou igual à confirmação não modifica aquele equipamento, inclusive quando ele não aparece no arquivo ou aparece fora do escopo. No cancelamento confirmado, o registro volta a ficar ativo; o bloqueio de reserva é removido pelo fluxo existente.
- Snapshot posterior à confirmação volta a governar a presença do equipamento no catálogo. A sincronização nunca apaga o vínculo de reserva local. Só DISPONIVEL NOVO e DISPONIVEL USADO entram no estoque; estados externos continuam excluídos.
- A leitura dos equipamentos sob bloqueio atualiza também os objetos da sessão, evitando decisões com valores anteriores ao bloqueio.

## Validação

Suíte completa de backend: **89 testes aprovados e 2 ignorados**, executada com SQLite em memória, integração simulada, APP_ENV=test e Sentry desativado. Os dois testes ignorados exigem PostgreSQL para concorrência real.

Cenários novos incluem datas inválidas/sem fuso/antigas/futuras, reinício com snapshot anterior, reescrita de conteúdo sem avançar a data, recuperação dos metadados de snapshot idêntico, cancelamento confirmado seguido de snapshot antigo (reservado, fora do escopo, disponível ou ausente) e aceitação de snapshot posterior à operação.

A primeira execução completa detectou igualdade ocasional de timestamps no relógio do Windows em um teste que precisava de um instante estritamente posterior. O teste passou a controlar explicitamente o relógio; a execução completa posterior foi aprovada.

A migração foi executada e revertida em SQLite isolado com um registro preexistente preservado. O SQL PostgreSQL foi gerado com Alembic em modo offline, sem conexão a banco. Isso verifica a geração do SQL, mas não substitui a aplicação em PostgreSQL de homologação. `git diff --check` dos arquivos rastreados desta entrega não apresentou erros. Não houve mudança de frontend nesta etapa.

## Migração e publicação

Migração: `d1103_inventory_watermark`, após `c10230_password_recovery`.

Adiciona a coluna nullable `equipments.inventory_confirmed_at` e a tabela `catalog_sync_state`. Equipamentos existentes começam sem marcador; operações anteriores à migração não recebem confirmação inventada. A primeira importação válida estabelece o marco persistente.

Antes de publicar: backup do banco, identificação da imagem anterior, aplicação/reversão em PostgreSQL isolado, conferência da origem e teste de concorrência. A API nova exige a migração aplicada. Nenhuma alteração foi aplicada ao banco operacional nesta entrega.

Reversão: interromper a API candidata, preservar backup dos dados de sincronização e reverter aplicação/esquema de forma coordenada. O downgrade remove apenas a tabela e a coluna adicionadas, mas perde as proteções temporais armazenadas. Não executar downgrade com a API nova em funcionamento.

## Limites e próximos passos

1. Confirmar no n8n que `ultimaAtualizacao` representa o snapshot dos dados, não apenas a hora em que um arquivo antigo foi regravado. Relógios devem estar sincronizados. Exportações que atravessam uma operação exigem contrato mais forte de ordenação/reconciliação; timestamp sozinho não prova a ordem de todos os itens.
2. Conferir o limite de 48 horas com a operação. Um arquivo rejeitado preserva o catálogo anterior; esta etapa ainda não bloqueia novas reservas apenas pela idade do último catálogo. Definir e implementar esse bloqueio de forma explícita antes de considerar LUM-02 concluído.
3. Metadados da resposta do catálogo ainda são mantidos em memória para apresentação. São recuperados quando um snapshot válido é processado; se o processo reiniciar com a origem inacessível/inválida, a exposição imediata dos metadados persistidos ainda precisa ser concluída.
4. O sistema continua limitado ao worker único previsto no plano. A criação inicial do registro de sincronização e eventos entre processos não foram homologados para múltiplos workers.
5. LUM-04 permanece necessário: resultado por patrimônio, identificação de operação, repetição segura e reconciliação. A confirmação global atual do webhook não prova conclusão individual nem reversão remota em caso de timeout.
6. LUM-01 segue com acesso operacional pendente conforme diagnóstico anterior. LUM-02 e LUM-03 permanecem em execução até fechar os limites acima e homologar a integração.
