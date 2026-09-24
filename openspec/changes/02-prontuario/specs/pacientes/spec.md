# Delta for Pacientes

## MODIFIED Requirements

### Requirement: Perfil individual

O sistema SHALL apresentar um perfil por paciente reunindo dados cadastrais,
histórico de atendimentos, acesso ao prontuário e, para paciente arquivado, a
data de elegibilidade para descarte.

#### Scenario: Histórico no perfil

- GIVEN um paciente com atendimentos realizados, cancelados, remarcados e faltas
- WHEN seu perfil é aberto
- THEN os atendimentos aparecem em ordem cronológica decrescente com data,
      duração, status e valor
- AND os encerrados por cancelamento, remarcação ou falta exibem o motivo
- AND o acesso é registrado na trilha de auditoria

#### Scenario: Remarcações encadeadas no histórico

- GIVEN um paciente com atendimentos remarcados
- WHEN seu histórico é exibido
- THEN cada `REMARCADO` aparece ligado ao que o substituiu, em cadeia legível
- AND nenhum elo da cadeia é omitido

#### Scenario: Acesso ao prontuário

- GIVEN um paciente com evoluções registradas
- WHEN seu perfil é aberto
- THEN o prontuário é acessível a partir dali
- AND o número de evoluções e a data da mais recente são exibidos sem abrir o texto

#### Scenario: Elegibilidade para descarte

- GIVEN um paciente arquivado
- WHEN seu perfil é aberto
- THEN a data de elegibilidade para descarte é exibida
- AND vem acompanhada do prazo configurado que a originou