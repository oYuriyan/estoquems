# Atualizacao com preservacao dos dados

O ambiente local existente usa o projeto Compose `estoque` e `docker-compose.yml`.
Os dados persistem em `estoque_postgres_data`, `estoque_n8n_data` e
`estoque_catalog_data`. O frontend servido pelo Nginx e `frontend/dist`.

Antes de atualizar, preserve o codigo implantado, imagens identificadas por ID,
frontend compilado, configuracoes, certificados/chaves e arquivos de ambiente.
Faca um `pg_dump` consistente do PostgreSQL e um backup online do SQLite do n8n,
preservando tambem o arquivo `config` com a chave de criptografia do n8n.
Confira a restauracao em ambiente isolado e mantenha as copias fora do Git.
Uma copia em disco independente tambem e necessaria para recuperacao de falha
do computador. Os backups locais ficam em `work/`, ignorado pelo Git.

A cadeia de migracoes inclui `c10230_password_recovery` e
`d1103_inventory_watermark`. Esta ultima acrescenta
`equipments.inventory_confirmed_at` e a tabela `catalog_sync_state`, sem apagar
equipamentos, usuarios ou propostas. O comando de inicio da API executa
`alembic upgrade head`; portanto, nao inicie uma imagem nova no banco original
antes de validar sua migracao em uma copia restaurada.

O importador rejeita inventario vazio, invalido, anterior ao ultimo snapshot ou
mais antigo que `CATALOG_MAX_AGE_HOURS` (48 horas por padrao). Nesses casos o
catalogo existente e preservado. Nao aumente esse limite apenas para importar
um arquivo antigo: confira primeiro a exportacao na origem.

Na janela de atualizacao, interrompa as gravacoes da API e obtenha um backup
final. Atualize apenas os servicos necessarios, conservando o projeto Compose,
as configuracoes locais e os volumes. Nao use `down -v`, `prune` ou exclusoes de
volumes. Revalide a revisao Alembic, saude da API, conteudo servido pelo Nginx,
autenticacao, leitura do catalogo e contagens/dados preservados.

Homologacao deve ter rede e bancos separados. E-mails, webhooks e automacoes
externas devem ficar desabilitados ou simulados. Testes de concorrencia usam
PostgreSQL isolado; nunca a URL operacional. O teste legado de corrida permanece
ignorado, pois seu substituto e `test_reservation_concurrency.py`.

Para retorno, preserve a imagem anterior, seu frontend e o backup do ponto de
corte. Se houver gravacoes ou alteracao de esquema, nao presuma que voltar
somente a imagem recupera o estado anterior. Ensaie a restauracao em outro
volume e reconcilie quaisquer operacoes posteriores antes de trocar os dados.
Nao execute uma restauracao destrutiva automaticamente.

Credenciais e chaves existentes ficam no disco, fora do indice do Git. Consulte
`SECURITY.md` sobre exposicoes em historico e tratamento separado de rotacao.
