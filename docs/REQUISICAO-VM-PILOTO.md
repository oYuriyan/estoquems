# VM Linux para o piloto Lummium

Atualizado em 19/11/2026. Piloto previsto para aproximadamente cinco pessoas,
incluindo Yuri. Yuri esclareceu que a VM ja existe, com instalacao anterior
congelada. O destino ainda nao foi inspecionado nem alterado nesta etapa;
confirmar sua configuracao e seus dados antes de retomar o deploy.

## Pedido para a TI

Disponibilizar uma VM Linux amd64, ligada continuamente, com IP reservado,
nome DNS interno e acesso administrativo por SSH conforme a politica da empresa.
Instalar Docker Engine e o plugin Docker Compose pelo procedimento oficial da
distribuicao. Python 3 e OpenSSL sao necessarios para a conferencia automatizada.

Como ponto de partida de engenharia para a homologacao, propor 2 vCPU, 4 GiB de
RAM e 40 GiB de disco, com possibilidade de expansao. Esses valores ainda nao
sao resultado de teste de carga: o conjunto atual consumiu aproximadamente
600 MiB de RAM em repouso, sem contar sistema operacional, compilacoes,
retencao de execucoes n8n e crescimento dos backups. Confirmar capacidade e
monitoramento com a TI antes de fixar o tamanho de producao.

| Item | Definicao solicitada |
| --- | --- |
| Linux e arquitetura | Distribuicao suportada pela TI; amd64 para reutilizar as imagens validadas |
| Endereco | IP reservado e DNS interno escolhido para o Lummium |
| TLS | Certificado para esse DNS e cadeia confiavel nos desktops e celulares do piloto |
| Acesso web | HTTPS 443 somente das redes autorizadas; HTTP 80 somente para redirecionamento |
| SSH | Restrito a administracao autorizada; chave configurada fora do Git e do chat |
| PostgreSQL e API | Nao publicar 5432 ou 8000 na rede |
| Administracao n8n | 5678 somente no loopback; acesso por tunel SSH autorizado |
| Saida GLPI | Endpoint HTTPS oficial, rota de rede/VPN e permissoes necessarias; nao enviar tokens por HTTP publico |
| Saida SMTP | Acesso ao provedor aprovado para recuperacao de senha; credenciais fora do Git |
| Relogio | NTP funcionando e fuso documentado; datas incorretas bloqueiam o inventario |
| Backup | Diretorio privado fora do repositorio e replica em armazenamento independente |
| Operacao | Responsaveis por acesso, backup, restauracao, atualizacoes e alertas definidos |

Nao confiar apenas em regras UFW para portas publicadas pelo Docker: conferir
as regras efetivas do host e da rede. O comportamento e documentado pelo
[Docker sobre firewalls](https://docs.docker.com/engine/network/packet-filtering-firewalls/).
Instalacao: [Docker Engine](https://docs.docker.com/engine/install/) e
[Compose para Linux](https://docs.docker.com/compose/install/linux/).
O procedimento de referencia do [n8n com Compose](https://docs.n8n.io/hosting/installation/server-setups/docker-compose/)
tambem exige preparar servidor, DNS e configuracoes privadas.

## Informacoes a devolver antes da migracao

- Distribuicao/versao, CPU, RAM, disco disponivel e arquitetura da VM.
- IP, DNS e URL HTTPS definitiva do piloto.
- Usuario SSH e confirmacao de acesso por chave ja configurada; nao enviar
  senha, chave privada ou tokens pelo chat.
- Caminho e permissao do destino de backups, retencao e replica independente.
- Endpoint HTTPS do GLPI e responsavel pela integracao.
- Patrimonio(s) separado(s) para homologar reserva, cancelamento e falhas parciais.
- Cinco usuarios indicados e responsavel por consolidar o feedback.

## Preparacao e corte

1. Manter o ambiente Windows atual e todos os backups como referencia. Nao
   ativar simultaneamente duas copias dos mesmos workflows n8n na origem real.
2. Preparar o clone na VM sem reutilizar arquivos privados de outra aplicacao.
   Transferir configuracoes e backups por canal privado aprovado, nunca pelo Git.
   A chave TLS antiga foi rastreada no historico; usar certificado/chave novos
   emitidos pela TI para o novo DNS. Coordenar qualquer rotacao de outras
   credenciais sem alterar silenciosamente os servicos existentes.
3. Usar o projeto Compose `estoque`. Restaurar PostgreSQL, catalogo e n8n em
   volumes de destino separados. Preservar o arquivo config do n8n que permite
   abrir suas credenciais; conferir restauracao e acesso antes da ativacao.
4. Configurar FRONTEND_ORIGIN e PASSWORD_RESET_URL para a URL HTTPS da VM.
   Instalar frontend/dist, certificado e chave. As imagens de infraestrutura do
   Compose de producao estao fixadas nos digests ja usados pelo ambiente local;
   isso nao substitui a validacao na arquitetura e rede da VM.
5. Executar `python3 scripts/preflight_linux.py --backup-dir /CAMINHO/PRIVADO`.
   Essa conferencia somente le: nao cria volumes, nao inicia servicos e nao
   aplica migracoes. Aprovacao nela nao comprova confianca do certificado nos
   dispositivos, regras reais de firewall ou integracoes GLPI.
6. Ensaiar restauracao e migracao com integracoes externas isoladas. Fechar os
   bloqueadores P0 do acompanhamento antes de permitir reservas reais.
7. Na janela combinada, suspender gravacoes, fazer backup final consistente e
   conferir os dados restaurados. Desativar agendamentos da origem antes de
   ativar o n8n do destino; registrar o ponto de corte e como retornar.
8. Validar desktops e celulares reais, recuperacao de senha, reserva exclusiva,
   cancelamento e divergencias. Abrir o piloto somente apos esse aceite.

O roteiro operacional e os criterios de coleta de feedback estao em
[PILOTO-COMERCIAL.md](PILOTO-COMERCIAL.md). As pendencias tecnicas permanecem em
[TRACK-LUMMIUM.md](TRACK-LUMMIUM.md); nao considerar o sistema pronto para
reservas reais somente porque a infraestrutura iniciou.
