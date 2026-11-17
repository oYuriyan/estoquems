# Configuracao e dados privados

Arquivos `.env` de execucao, chaves privadas TLS, bancos, volumes e backups nao
devem ser versionados. Use os arquivos `.env.example` como modelos e injete os
valores reais no ambiente de execucao. Variaveis `VITE_` sao publicas no bundle
frontend e nao podem guardar credenciais.

Arquivos de ambiente e uma chave TLS foram rastreados em revisoes anteriores.
Retira-los do indice atual nao apaga o historico. A avaliacao de exposicao,
revogacao/rotacao e eventual limpeza do historico devem ser coordenadas com os
responsaveis pelo ambiente e pelos servicos integrados. Atualizacoes de codigo
nao devem trocar silenciosamente as credenciais em uso.

Preserve os arquivos locais ao retirar segredos do rastreamento: use
`git rm --cached -- caminho`, nunca remova a configuracao operacional.
Mantenha os backups em armazenamento privado e confira seus hashes antes de
restaurar. Nao anexe dumps, arquivos de ambiente ou metadados Docker completos
a issues, commits, logs publicos ou relatorios compartilhados.
