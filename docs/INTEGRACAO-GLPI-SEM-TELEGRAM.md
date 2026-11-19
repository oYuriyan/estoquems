# GLPI sem Telegram — 18/11/2026

Yuri esclareceu que o downgrade mencionado era a retirada do Telegram do
escopo, sem rebaixamento de versao de componentes. A VM Linux ja existe, com
uma versao anterior da aplicacao congelada. Ainda e necessario inspecionar esse
destino e decidir a origem dos dados antes de retomar seu deploy. Nao houve
acesso nem alteracao na VM nesta entrega.

## Entrega operacional local

Os tres workflows locais foram atualizados com backup consistente previo:
inventario, reserva e cancelamento. Os fluxos ativos nao contêm Telegram; os
workflows inativos e o historico anterior foram preservados. Apenas o n8n foi
reiniciado. A API e o frontend continuam na base estavel 1.1.0, independente
do candidato de interface e protecao de rotas do PR #1.

- Sessao obtida no login GLPI e usada nas chamadas seguintes, sem token de
  sessao fixo. Credenciais de acesso existentes foram preservadas.
- Operacoes usam ID GLPI, permitindo equipamentos sem patrimonio preenchido.
- Reserva/cancelamento retornam resultado por equipamento e conferem o
  estado por leitura apos a escrita. Conflito nao altera o equipamento.
- Marcador da proposta no comentario identifica a reserva e guarda o estado
  original. O comentario anterior e preservado e restaurado no cancelamento.
- Repeticao da mesma reserva nao escreve novamente; outra proposta recebe
  conflito. Repeticao de cancelamento ja confirmado nao escreve novamente.
- Exportacao pagina e confere o total antes de escrever o catalogo. Os gatilhos
  nao dependem de ler um arquivo antigo para iniciar a atualizacao.
- Serial usa o campo serial GLPI. Um mapa privado conserva identidades locais
  existentes, inclusive quando o identificador exibido na origem mudou.
  A revisao do significado do patrimonio/UUID precisa de migracao propria;
  nao trocar identidades em massa durante a sincronizacao.

Yuri confirmou o acesso HTTP como interno. Os enderecos e as credenciais reais
ficam na configuracao privada. Essa confirmacao nao configura HTTPS na VM.

## Evidencia e limites

Dois equipamentos ficticios criados por Yuri foram usados. Reserva, conflito,
repeticao da reserva, cancelamento e repeticao do cancelamento passaram no
GLPI real, primeiro com banco n8n temporario e depois pelos webhooks publicados.
Os equipamentos terminaram disponiveis e com seus comentarios originais.
Nao houve Telegram, e-mail ou criacao de propostas de teste na base operacional.

O inventario completo importou 99 equipamentos ativos. Os 118 registros
anteriores de equipamentos foram preservados; a base passou a 174 registros,
incluindo historico inativo. Usuarios, propostas e itens mantiveram suas
impressoes digitais. Evidencias, dumps, configuracoes preenchidas e mapa de
identidades permanecem privados em work/, fora do Git.

Isso comprova o caminho webhook-n8n-GLPI testado, sem substituir o aceite
completo pela interface. Permanecem a integracao do resultado individual com
a API, persistencia de operacoes/reconciliacao, historico minimo e testes de
timeout/falha parcial e concorrencia entre processos independentes. O GLPI
nao fornece aqui uma transacao unica com o PostgreSQL. Nao declarar o piloto
inteiro homologado ou idempotencia distribuida completa por esses testes.

## Templates sem segredos

Os tres arquivos em `integrations/n8n/` sao modelos para n8n 2.26.4, sem
endereco real, tokens ou mapa real de identidades. Nao sao arquivos prontos
para importar: os placeholders deixam a configuracao incompleta ate a preparacao.

`scripts/prepare_glpi_workflows.py` le uma exportacao privada do CLI n8n e um
JSON privado das identidades locais. Associa cada template ao workflow existente
pelo caminho do webhook, conserva seus IDs e configuracoes, preenche os campos
privados e gera um novo arquivo com os workflows inativos. Nao acessa a rede,
nao importa, nao publica, nao altera credenciais e nao sobrescreve a saida.

Exemplo de preparacao, usando somente arquivos privados:

```text
python scripts/prepare_glpi_workflows.py --export /PRIVADO/workflows.json --identities /PRIVADO/identities.json --output /PRIVADO/workflows-preparados.json
```

O mapa e uma lista JSON de objetos com `id_glpi` e `identity`, extraidos da base
local de referencia. Deve acompanhar a migracao privada para preservar os dados.
O arquivo gerado contem segredos e nunca deve ser adicionado ao Git.

Antes de aplicar em outro ambiente: diagnosticar e fazer backup desse destino,
conferir conflitos e acessos, ensaiar restauracao e validar a preparacao. Usar
o CLI suportado `import:workflow`, publicar cada ID e reiniciar n8n para carregar
as versoes. A importacao padrao deixa os workflows inativos; nao esquecer essa
etapa. Nao ativar agendamentos duplicados entre o computador atual e a VM.

Complemento de 19/11: a versão 1.2 adiciona a conferência somente leitura, totalizando quatro templates e um preparador atualizado. Histórico e recuperação estão em [OPERACOES-CONFIAVEIS.md](OPERACOES-CONFIAVEIS.md). Os resultados de 18/11 acima permanecem como registro histórico.
