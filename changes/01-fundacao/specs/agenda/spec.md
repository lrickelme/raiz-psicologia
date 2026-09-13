# Delta for Agenda

> Nota de vocabulário: a consulta clínica chama-se **atendimento**. O termo
> "sessão" fica reservado para a sessão de login, especificada em `auth`.

## ADDED Requirements

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
não cancelado. A validação SHALL ser garantida por restrição no banco, e não
apenas por verificação na camada de aplicação ou na interface.

#### Scenario: Conflito de horário

- GIVEN um atendimento das 14h00 às 14h50
- WHEN a profissional tenta agendar outro das 14h30 às 15h20
- THEN a API responde `409` identificando o atendimento conflitante
- AND a interface oferece o próximo horário livre

#### Scenario: Encaixe adjacente

- GIVEN um atendimento das 14h00 às 14h50
- WHEN a profissional agenda outro começando exatamente às 14h50
- THEN o atendimento é criado normalmente

#### Scenario: Horário liberado por cancelamento

- GIVEN um atendimento cancelado das 14h00 às 14h50
- WHEN a profissional agenda outro no mesmo intervalo
- THEN o atendimento é criado normalmente

#### Scenario: Requisições concorrentes

- GIVEN duas requisições simultâneas agendando o mesmo intervalo livre
- WHEN ambas são processadas
- THEN exatamente uma é persistida
- AND a outra recebe `409`

### Requirement: Ciclo de vida do atendimento

O sistema SHALL manter os status `AGENDADO`, `REALIZADO`, `CANCELADO` e `FALTA`.
Um atendimento MUST NOT ser marcado como `REALIZADO` antes de seu horário de
término. Cancelamento SHALL exigir motivo em texto livre.

#### Scenario: Conclusão

- GIVEN um atendimento `AGENDADO` cujo horário de término já passou
- WHEN a profissional o marca como realizado
- THEN o status muda para `REALIZADO`
- AND o valor congelado passa a contar no módulo financeiro

#### Scenario: Conclusão antecipada

- GIVEN um atendimento `AGENDADO` que ainda não terminou
- WHEN a profissional tenta marcá-lo como realizado
- THEN a API responde `422`

#### Scenario: Cancelamento

- GIVEN um atendimento `AGENDADO`
- WHEN a profissional cancela informando o motivo
- THEN o status muda para `CANCELADO`, o motivo é persistido e o horário fica livre
- AND o atendimento permanece visível no histórico do paciente

#### Scenario: Falta

- GIVEN um atendimento cujo horário passou sem comparecimento
- WHEN a profissional o marca como falta
- THEN o status muda para `FALTA`
- AND a política de cobrança de falta é resolvida no módulo financeiro, não aqui

### Requirement: Reagendamento

O sistema SHALL permitir mover um atendimento `AGENDADO` para outro horário,
preservando paciente, duração e valor congelado.

#### Scenario: Arrastar no calendário

- GIVEN um atendimento `AGENDADO` na visão semanal
- WHEN a profissional o arrasta para outro horário livre
- THEN o novo horário é persistido mantendo a duração original
- AND a validação de sobreposição é aplicada antes de confirmar

#### Scenario: Mover atendimento encerrado

- GIVEN um atendimento `REALIZADO`, `CANCELADO` ou `FALTA`
- WHEN a profissional tenta reagendá-lo
- THEN a operação é recusada

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