# Delta for Agenda

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Ciclo de vida do atendimento

O sistema SHALL manter os status `AGENDADO`, `REALIZADO`, `CANCELADO`,
`REMARCADO` e `FALTA`. Um atendimento MUST NOT ser marcado como `REALIZADO` antes
de seu horário de término.

Cancelar, remarcar e faltar são três eventos clinicamente distintos e MUST ser
registrados como tal: os três encerramentos SHALL exigir motivo em texto livre.

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