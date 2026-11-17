# Piloto controlado com cinco participantes

Yuri participa do piloto e coordena o aceite operacional. A meta e validar
consulta do catalogo, proposta sem valores financeiros, reserva exclusiva e
cancelamento confirmado no GLPI. Locacao efetiva, devolucao e liberacao
automatica por vencimento permanecem fora deste primeiro ciclo.

## Condicoes para abrir

- VM Linux com DNS, certificado confiavel, acessos individuais e backup
  restauravel, conforme REQUISICAO-VM-PILOTO.md.
- Inventario GLPI atual, estados conferidos e novas reservas bloqueadas quando
  a origem estiver antiga ou ainda nao validada.
- Reserva/cancelamento por patrimonio, tratamento de timeout/falha parcial,
  repeticao segura e historico minimo persistente homologados.
- Nenhuma rota alternativa permite acionar webhooks de reserva/cancelamento
  sem autorizacao. Conferir a exposicao do n8n e do proxy antes do piloto.
- Patrimonio(s) de homologacao indicado(s) por Yuri, sem disputar equipamentos
  que estejam em operacao. Notificacoes Telegram e e-mails de ensaio controlados.
- Participantes e equipamentos de acesso indicados; primeiro uso acompanhado.

## Roteiro de aceite

| Cenario | Resultado esperado | Evidencia a registrar |
| --- | --- | --- |
| Acesso | Login e recuperacao no desktop e celular, sem contornar aviso TLS | Dispositivo/navegador, horario e resultado |
| Consulta | Patrimonio, serie e modelo localizaveis; datas e indisponibilidade claras | Tempo de consulta e divergencia com GLPI |
| Proposta | Selecionar, salvar, recarregar e reabrir os mesmos itens | Proposta de teste e resultado da recarga |
| Concorrencia | Dois vendedores disputam a unidade: apenas uma reserva confirmada | Patrimonio, propostas, ID de operacao e estado GLPI |
| Cancelamento | Liberacao apenas apos confirmacao da origem | Estados antes/depois nos dois sistemas |
| Falha parcial | Operacao pendente explicita; nunca sucesso global falso | Itens confirmados, pendentes e reconciliacao |
| Repeticao | Clique repetido ou nova tentativa nao duplica o efeito | Mesmo ID de operacao e resultado |
| Origem antiga | Consulta continua; nova reserva bloqueada com explicacao | Data da origem e mensagem apresentada |
| Reconexao/PWA | Retorno da rede e nova versao nao exibem sucesso antigo | Versao, dispositivo e comportamento |

Os testes reais de integracao so podem acontecer com o patrimonio e os efeitos
externos definidos. Simulacoes automatizadas nao substituem essa evidencia.

## Coleta de feedback

Comecar com o grupo pequeno, acompanhando as primeiras operacoes. Durante o
piloto, registrar cada problema em um controle privado aprovado pela empresa:

| Campo | Como preencher |
| --- | --- |
| Data/hora e versao | Permite relacionar o relato ao deploy |
| Participante | Nome interno ou identificador de quem pode esclarecer |
| Etapa | Acesso, consulta, proposta, reserva, cancelamento ou exportacao |
| Passos | O que foi feito, de forma reproduzivel |
| Esperado / observado | Diferenca concreta; incluir a mensagem apresentada |
| Impacto | Bloqueia trabalho, gera divergencia ou dificulta o uso |
| Identificacao | ID de operacao/proposta e patrimonio quando necessario |
| Evidencia | Captura sem dados de clientes desnecessarios; nunca tokens/senhas |
| Tratamento | Responsavel, prioridade, correcao e confirmacao do participante |

Nao gravar relatos reais, dados de clientes, imagens privadas ou dumps no Git
publico. A primeira rodada deve produzir exemplos mensuraveis de tempo para
encontrar uma unidade, salvar uma proposta e resolver uma reserva, sem inventar
metas ou declarar melhoria antes de medir.

Interromper novas reservas se houver duplicidade, confirmacao divergente no
GLPI, exposicao de dados ou falha que torne o estoque incerto. Preservar a
evidencia e reconciliar o estado antes de repetir uma operacao.
