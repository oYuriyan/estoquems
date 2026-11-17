# LUM-02 — disponibilidade explícita: primeira entrega

Data: 03/11/2026. Estado: validado localmente; não publicado. LUM-02 permanece em execução.

## Problema e resultado

A regra anterior considerava disponível qualquer estado que não estivesse na lista de bloqueio. Um equipamento com estado desconhecido podia ser reservado. A importação também convertia status ausente em `USADO`.

A API agora exige um estado explícito de disponibilidade. A seleção no frontend sempre aplica a mesma lista e respeita os bloqueios da API e de equipamento reservado/inativo, inclusive se uma resposta inconsistente informar `is_available=true` para estado indisponível. A importação cadastra apenas os dois estados disponíveis. Estados ausentes ou fora do escopo não geram novos registros; equipamentos já existentes são inativados sem importar o estado externo nem apagar o histórico. O cadastro manual também exige um estado disponível explícito.

Estados confirmados por Yuri em 03/11/2026:

| Estado GLPI | Significado | Entra no catálogo ativo |
|---|---|---|
| DISPONIVEL NOVO | Equipamento novo disponível | Sim, se ativo e sem reserva |
| DISPONIVEL USADO | Equipamento usado disponível | Sim, se ativo e sem reserva |
| LOCADO | Fora do escopo: em locação | Não importar |
| VENDIDO | Fora do escopo: vendido | Não importar |
| RMA | Fora do escopo: manutenção | Não importar |

Somente os dois estados explícitos de disponibilidade são aceitos. Acentos, caixa e espaços são normalizados. `DISPONIVEL` isolado, condição física isolada, estado ausente e qualquer estado não reconhecido são bloqueados. SEMINOVO foi removido do mapeamento; sua única presença nos testes é como entrada inválida para prevenir regressão. A confirmação do usuário define a regra funcional; a conferência do inventário servido e das execuções n8n continua pendente.

## Diagnóstico LUM-01

- A API lê `http://nginx/catalogo.json`; a configuração Nginx aponta para `/var/catalog_data/catalogo.json`, montado pelo volume `catalog_data`, compartilhado com `/data` no n8n.
- A consulta somente de leitura a `http://172.16.20.92:3030/catalogo.json` foi recusada pelo destino. Não houve acesso às execuções do n8n nem confirmação do arquivo servido.
- O Docker local não respondeu: pipe `dockerDesktopLinuxEngine` ausente.
- `backend/catalogo.json` é uma cópia local com 109 itens, data `2026-05-07T13:12:32.61Z`, 53 `DISPONIVEL NOVO` e 56 `DISPONIVEL USADO`. Não confundir essa cópia com os 62 itens observados anteriormente no servidor.
- Impedimento: recuperar acesso ao ambiente operacional para verificar execuções, exportação e estados reais. Nenhum fluxo remoto foi executado ou alterado.

## Validação executada após ajuste ao mapa confirmado

| Verificação | Resultado |
|---|---|
| API: disponibilidade, importação, reservas, propostas e cenários de concorrência | 47 testes aprovados; 2 ignorados por exigirem PostgreSQL; SQLite em memória; GLPI/n8n simulados |
| Frontend: `npm test -- --reporter=dot` | 22 testes aprovados em 3 arquivos |
| Frontend: `npm run lint` | Aprovado |
| Frontend: `npx tsc -b` | Aprovado |
| Frontend: `npx vite build --outDir ../work/preview/lum02-frontend` | Aprovado; build separado dos arquivos servidos |
| Whitespace dos arquivos rastreados alterados nesta entrega | Aprovado |

Regressões cobertas: reserva de estado desconhecido retorna conflito sem chamar a integração; importação de status vazio não cria disponibilidade; estados explicitamente disponíveis continuam aceitos; equipamento reservado/inativo permanece bloqueado; estados contraditórios não são aceitos por conterem a palavra disponível.

O ambiente Python existente não iniciou sob as restrições da sessão. Foi criado `work/test-venv`, usando Python 3.12.10 e as dependências de `backend/requirements.txt`, com `bcrypt==4.0.1` para compatibilidade com passlib. Os testes receberam `DATABASE_URL` e `TEST_DATABASE_URL` apontando para SQLite em memória, chave JWT exclusiva de teste e Sentry desabilitado. O frontend precisou de TEMP/TMP em `work/test-temp` após erro de permissão no cache temporário da primeira tentativa.

Avisos não impeditivos: depreciação de `utcnow` em python-jose, bundle maior que 500 kB e base Browserslist desatualizada. Não houve teste de concorrência PostgreSQL, inspeção visual ou homologação real nesta entrega.

## Pendências e sequência

1. Restabelecer acesso ao servidor e concluir LUM-01, conferindo o inventário servido contra o mapa de estados confirmado por Yuri.
2. Completar LUM-02: validação temporal do inventário e política segura para arquivo antigo, inclusive após reinício da API. A alteração atual não resolve esse item.
3. Implementar precedência entre operações confirmadas e snapshots (LUM-03), com reprodução do cancelamento seguido de inventário antigo.
4. Validar os cenários pertinentes em PostgreSQL isolado e conferir seleção/contagens visualmente antes de publicar.
5. Publicar somente com backup, identificação da imagem/build anteriores e reversão preparada. Não há migração de banco nesta primeira entrega.

Regra de compatibilidade: estados fora do mapa confirmado ficam indisponíveis. Qualquer inclusão futura exige definição explícita; a homologação deve conferir o resultado com a origem.

## Publicação e reversão

Nenhum container, banco ou build operacional foi substituído. O candidato do frontend está em `work/preview/lum02-frontend`. Alterações anteriores do usuário foram preservadas; esta entrega não criou commit. Para eventual publicação, registrar a versão completa candidata e os artefatos anteriores; em caso de regressão, restaurar a imagem da API e o build anteriores identificados, sem redefinir indiscriminadamente o checkout que já contém outras mudanças.

## Ajuste de escopo solicitado por Yuri

LOCADO, VENDIDO e RMA são referências externas para exclusão, não categorias do sistema de estoque. Novos registros nesses estados são ignorados. Registros anteriores deixam o catálogo ativo, preservando identidade, estado anterior e vínculos de propostas/reservas. Um retorno explícito a DISPONIVEL NOVO ou DISPONIVEL USADO reativa o registro. Um snapshot não vazio contendo somente itens fora do escopo pode resultar em catálogo ativo vazio; um arquivo de origem vazio continua rejeitado pela proteção existente. Este ajuste não publica nem limpa dados de produção; os registros existentes serão tratados pela sincronização após publicação validada.

Validação deste ajuste: 58 testes de API aprovados (disponibilidade, importação, exclusão do catálogo, reativação, cadastro manual e propostas), com SQLite em memória e integração simulada. Nenhuma alteração de frontend neste ajuste; os 22 testes e o build registrados acima correspondem à revisão anterior. Concorrência PostgreSQL e ambiente real continuam pendentes.
