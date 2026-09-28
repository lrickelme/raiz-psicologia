# agenda Specification

## Purpose
TBD - created by archiving change 01-fundacao. Update Purpose after archive.

## Requirements

### Requirement: Visualizações de calendário

O sistema SHALL oferecer visualização diária, semanal e mensal da agenda, com a
semanal como padrão ao abrir o módulo. A visualização escolhida MUST persistir
entre acessos.

#### Scenario: Alternância de visão

- GIVEN a agenda aberta na visão semanal
- WHEN a profissional seleciona a visão mensal
- THEN o calendário reflete o mesmo período de referência na nova granularidade
- AND a preferência é restaurada no próximo acesso

#### Scenario: Densidade da visão mensal

- GIVEN um dia com mais atendimentos do que cabem na célula do mês
- WHEN a visão mensal é renderizada
- THEN a célula mostra os primeiros atendimentos e um indicador de quantidade restante
- AND acionar o indicador abre o dia na visão diária

#### Scenario: Carregamento por período

- GIVEN dois anos de atendimentos no banco
- WHEN uma visão de calendário é aberta
- THEN a API retorna apenas os atendimentos do intervalo visível mais uma margem
- AND a renderização ocorre em menos de dois segundos

### Requirement: Agendamento de atendimento

O sistema SHALL permitir agendar um atendimento associado a um paciente ativo,
definindo início e fim explícitos. A duração MUST ser de no mínimo 15 minutos. O
sistema SHALL sugerir 50 minutos por padrão e herdar o valor da consulta do
paciente, ambos editáveis no ato.

#### Scenario: Agendamento simples

- GIVEN a agenda na visão semanal
- WHEN a profissional seleciona um intervalo livre e escolhe um paciente ativo
- THEN o atendimento é criado com status `AGENDADO`
- AND aparece no calendário sem recarregar a página

#### Scenario: Fim anterior ao início

- GIVEN o formulário de novo atendimento
- WHEN o horário de término é igual ou anterior ao de início
- THEN a API responde `422`
- AND o atendimento não é criado

#### Scenario: Paciente arquivado

- GIVEN um paciente arquivado
- WHEN a profissional busca pacientes no formulário de agendamento
- THEN ele não aparece entre as opções

### Requirement: Bloqueio de sobreposição

O sistema MUST recusar atendimento que se sobreponha no tempo a outro atendimento
que não esteja `CANCELADO` nem `REMARCADO`. A validação SHALL ser garantida por
restrição no banco, e não apenas por verificação na camada de aplicação ou na
interface.

#### Scenario: Conflito de horário

- GIVEN um atendimento das 14h00 às 14h50
- WHEN a profissional tenta agendar outro das 14h30 às 15h20
- THEN a API responde `409` identificando o atendimento conflitante
- AND a interface oferece o próximo horário livre

#### Scenario: Encaixe adjacente

- GIVEN um atendimento das 14h00 às 14h50
- WHEN a profissional agenda outro começando exatamente às 14h50
- THEN o atendimento é criado normalmente

#### Scenario: Horário liberado por cancelamento ou remarcação

- GIVEN um atendimento `CANCELADO` ou `REMARCADO` das 14h00 às 14h50
- WHEN a profissional agenda outro no mesmo intervalo
- THEN o atendimento é criado normalmente

#### Scenario: Requisições concorrentes

- GIVEN duas requisições simultâneas agendando o mesmo intervalo livre
- WHEN ambas são processadas
- THEN exatamente uma é persistida
- AND a outra recebe `409`

### Requirement: Ciclo de vida do atendimento

O sistema SHALL manter os status `AGENDADO`, `REALIZADO`, `CANCELADO`,
`REMARCADO` e `FALTA`. Um atendimento MUST NOT ser marcado como `REALIZADO` antes
de seu horário de término.

Cancelar, remarcar e faltar são três eventos clinicamente distintos e MUST ser
registrados como tal: os três encerramentos (`CANCELADO`, `REMARCADO`, `FALTA`)
SHALL exigir motivo em texto livre, no mesmo campo `motivo`. A profissional usa
esses registros no estudo do caso — a distinção não é administrativa.

Todo encerramento MUST definir a cobrabilidade do atendimento conforme o
requisito "Cobrabilidade congelada no encerramento".

#### Scenario: Conclusão

- GIVEN um atendimento `AGENDADO` cujo horário de término já passou
- WHEN a profissional o marca como realizado
- THEN o status muda para `REALIZADO`
- AND é registrado como cobrável
- AND o valor congelado passa a contar na receita realizada

#### Scenario: Conclusão antecipada

- GIVEN um atendimento `AGENDADO` que ainda não terminou
- WHEN a profissional tenta marcá-lo como realizado
- THEN a API responde `422`

#### Scenario: Cancelamento

- GIVEN um atendimento `AGENDADO`
- WHEN a profissional cancela informando o motivo
- THEN o status muda para `CANCELADO`, o motivo é persistido e o horário fica livre
- AND a cobrabilidade é definida pela data de calendário do cancelamento
- AND o atendimento permanece visível no histórico do paciente

#### Scenario: Falta

- GIVEN um atendimento cujo horário passou sem comparecimento
- WHEN a profissional o marca como falta informando o motivo
- THEN o status muda para `FALTA` e o motivo é persistido
- AND o valor congelado passa a contar na receita realizada

#### Scenario: Encerramento sem motivo

- GIVEN um atendimento `AGENDADO`
- WHEN a profissional tenta cancelar, remarcar ou marcar falta sem informar motivo
- THEN a API responde `422` apontando o campo `motivo`
- AND o status não muda

### Requirement: Remarcação encadeada

Remarcar MUST NOT ser uma edição de horário. O sistema SHALL encerrar o
atendimento original com status `REMARCADO` e motivo registrado, e criar um novo
atendimento `AGENDADO` no novo horário, preservando paciente, duração e valor
congelado do original, com referência ao atendimento que substitui. O histórico
do paciente MUST apresentar os dois, encadeados. Só um atendimento `AGENDADO`
pode ser remarcado.

#### Scenario: Remarcar

- GIVEN um atendimento `AGENDADO` das 14h00 às 14h50 a R$ 150,00
- WHEN a profissional o remarca para quinta às 10h00 informando o motivo
- THEN o original passa a `REMARCADO` com o motivo persistido
- AND um novo atendimento `AGENDADO` das 10h00 às 10h50 a R$ 150,00 é criado
      apontando para o original
- AND o horário original fica livre

#### Scenario: Arrastar no calendário

- GIVEN um atendimento `AGENDADO` na visão semanal
- WHEN a profissional o arrasta para outro horário livre
- THEN a interface pede o motivo antes de confirmar
- AND a validação de sobreposição do novo horário é aplicada antes de confirmar
- AND ao confirmar, aplica-se o mesmo encadeamento do cenário "Remarcar"

#### Scenario: Remarcar mais de uma vez

- GIVEN um atendimento criado por remarcação
- WHEN a profissional o remarca de novo
- THEN a cadeia cresce (original → primeira remarcação → segunda)
- AND o histórico do paciente exibe a cadeia completa em ordem

#### Scenario: Mover atendimento encerrado

- GIVEN um atendimento `REALIZADO`, `CANCELADO`, `REMARCADO` ou `FALTA`
- WHEN a profissional tenta remarcá-lo
- THEN a operação é recusada

### Requirement: Motivo como dado clínico

O campo `motivo` é dado clínico, não administrativo. O sistema MUST armazená-lo
criptografado em repouso e MUST registrar na trilha de auditoria toda leitura e
escrita dele, sob as mesmas regras da evolução de prontuário (`project.md`,
restrições regulatórias).

#### Scenario: Motivo não legível no banco

- GIVEN um atendimento encerrado com motivo
- WHEN a coluna é lida diretamente no Postgres
- THEN o texto do motivo não aparece em claro

#### Scenario: Leitura auditada

- GIVEN um atendimento com motivo
- WHEN o histórico do paciente é aberto e o motivo é exibido
- THEN a leitura gera registro na trilha de auditoria com o identificador do
      atendimento

### Requirement: Correção de horário local

O sistema MUST resolver "hoje", "esta semana" e "este mês" no fuso
`America/Sao_Paulo`, independentemente do fuso configurado no processo servidor.

#### Scenario: Servidor em outro fuso

- GIVEN o processo da API rodando com `TZ=UTC`
- WHEN a profissional abre a agenda do dia às 22h de São Paulo
- THEN os atendimentos exibidos são os do dia corrente em São Paulo
- AND nenhum atendimento do dia seguinte aparece

### Requirement: Agenda do dia no dashboard

O sistema SHALL exibir na tela inicial os atendimentos do dia corrente em ordem
cronológica, com paciente, horário e status.

#### Scenario: Dia vazio

- GIVEN nenhum atendimento agendado para hoje
- WHEN o dashboard é aberto
- THEN o painel exibe estado vazio com atalho para agendar
- AND não renderiza uma grade de horários em branco

### Requirement: Cobrabilidade congelada no encerramento

O sistema MUST registrar em campo próprio do atendimento, no momento do
encerramento, se aquele atendimento é cobrável. A cobrabilidade MUST NOT ser
recalculada em consulta posterior a partir da regra vigente.

A regra, conforme definida pela profissional:

- `REALIZADO` — sempre cobrável.
- `FALTA` — sempre cobrável.
- `CANCELADO` — cobrável apenas quando a data de calendário do cancelamento for a
  mesma data de calendário do início do atendimento, avaliada em
  `America/Sao_Paulo`.
- `REMARCADO` — nunca cobrável.

O congelamento existe pela mesma razão que o valor da consulta é congelado no
agendamento: alterar a regra depois MUST NOT reescrever a receita de meses já
apurados.

O instante do encerramento MUST ser registrado no próprio atendimento, na mesma
operação que muda o status, para que a cobrabilidade possa ser conferida sem
depender de outra fonte. Atendimento `AGENDADO` MUST NOT ter instante de
encerramento nem cobrabilidade definidos.

Atendimentos encerrados antes deste requisito SHALL ter o instante do
encerramento derivado da trilha de auditoria. Quando a trilha não tiver o
registro e a regra depender da data, a cobrabilidade MUST permanecer indefinida,
sem valor presumido.

Atendimento encerrado sem cobrabilidade definida MUST NOT entrar na receita
realizada. É estado que só ocorreria por defeito; nesse caso, apuração
incompleta é preferível a apuração errada.

#### Scenario: Cancelamento em dia anterior

- GIVEN um atendimento marcado para segunda às 09h00
- WHEN é cancelado no domingo às 23h00
- THEN é registrado como não cobrável

#### Scenario: Cancelamento no dia da consulta

- GIVEN um atendimento marcado para segunda às 18h00
- WHEN é cancelado na segunda às 08h00
- THEN é registrado como cobrável
- AND isso vale apesar das dez horas de antecedência

#### Scenario: Cancelamento após o horário

- GIVEN um atendimento marcado para segunda às 09h00
- WHEN é cancelado na segunda às 11h00, já passado o horário
- THEN é registrado como cobrável

#### Scenario: Remarcação no dia

- GIVEN um atendimento marcado para hoje
- WHEN é remarcado hoje mesmo
- THEN o atendimento remarcado é registrado como não cobrável
- AND o novo atendimento nasce `AGENDADO`, com sua própria cobrabilidade a definir
      no encerramento

#### Scenario: Falta

- GIVEN um atendimento cujo horário passou sem comparecimento
- WHEN a profissional o marca como `FALTA`
- THEN é registrado como cobrável

#### Scenario: Regra alterada depois

- GIVEN um cancelamento registrado como não cobrável
- WHEN a regra de cobrança é alterada em versão futura do sistema
- THEN aquele atendimento continua não cobrável
- AND a receita do mês em que ele ocorreu não muda

#### Scenario: Encerrado sem cobrabilidade definida

- GIVEN um atendimento encerrado cuja cobrabilidade não foi definida
- WHEN a receita é calculada
- THEN ele não entra no total

#### Scenario: Atendimento ainda aberto

- GIVEN um atendimento `AGENDADO`
- WHEN a receita é calculada
- THEN ele não tem cobrabilidade definida
- AND não entra na receita realizada

### Requirement: Dispensa de cobrança

O sistema SHALL permitir que a profissional dispense a cobrança de um atendimento
cobrável, registrando o motivo em texto livre. A dispensa MUST ser visível no
histórico do paciente e MUST ser registrada na trilha de auditoria.

A dispensa MUST NOT apagar a cobrabilidade original: o sistema registra que o
atendimento era cobrável e que a cobrança foi dispensada, para que o total de um
mês sempre tenha explicação.

Reverter a dispensa MUST NOT apagar o motivo registrado: ele permanece, cifrado,
como motivo da última dispensa. O texto do motivo MUST NOT ser gravado na trilha
de auditoria, que não é cifrada.

#### Scenario: Dispensar

- GIVEN um cancelamento no dia da consulta, portanto cobrável
- WHEN a profissional dispensa a cobrança informando o motivo
- THEN o atendimento deixa de entrar na receita realizada
- AND o histórico exibe que era cobrável e que a cobrança foi dispensada, com o motivo

#### Scenario: Dispensa sem motivo

- GIVEN um atendimento cobrável
- WHEN a profissional tenta dispensar a cobrança sem informar motivo
- THEN a API responde `422` apontando o campo
- AND a cobrabilidade não muda

#### Scenario: Ação alcançável do histórico e da agenda

- GIVEN um atendimento cobrável
- WHEN a profissional o abre no histórico do paciente ou no detalhe do
      atendimento na agenda
- THEN a ação de dispensar a cobrança está disponível nos dois lugares
- AND antes de confirmar ela vê o valor congelado e por que o atendimento é
      cobrável
- AND num atendimento com cobrança dispensada, os dois lugares mostram o motivo
      registrado e a opção de reverter
- AND num atendimento não cobrável, a ação não é oferecida

#### Scenario: Dispensar o que não é cobrável

- GIVEN um atendimento já não cobrável
- WHEN a profissional tenta dispensar sua cobrança
- THEN a operação é recusada

#### Scenario: Reverter a dispensa

- GIVEN uma cobrança dispensada
- WHEN a profissional reverte a dispensa
- THEN o atendimento volta a entrar na receita realizada
- AND tanto a dispensa quanto sua reversão constam da trilha de auditoria

#### Scenario: Reverter preserva o motivo registrado

- GIVEN uma cobrança dispensada com o motivo "paciente em luto"
- WHEN a profissional reverte a dispensa
- THEN o atendimento deixa de constar como dispensado
- AND o motivo "paciente em luto" permanece registrado no atendimento
- AND o texto do motivo não aparece na trilha de auditoria
