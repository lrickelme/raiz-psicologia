# pacientes Specification

## Purpose
TBD - created by archiving change 01-fundacao. Update Purpose after archive.

## Requirements

### Requirement: Cadastro de paciente

O sistema SHALL permitir cadastrar paciente com nome completo, telefone, e-mail,
data de nascimento, valor padrão da consulta e observações administrativas. Nome
e valor padrão MUST ser obrigatórios; os demais campos são opcionais, porque o
cadastro frequentemente começa com a informação que chegou pelo WhatsApp e é
completado na primeira sessão.

O campo de observações administrativas MUST NOT ser usado como prontuário; a
interface deve deixar isso explícito no rótulo.

#### Scenario: Cadastro mínimo

- GIVEN a profissional na tela de novo paciente
- WHEN informa apenas nome e valor da consulta e salva
- THEN o paciente é criado com status ativo
- AND aparece imediatamente na listagem

#### Scenario: Valor inválido

- GIVEN a tela de novo paciente
- WHEN o valor da consulta é negativo ou tem mais de duas casas decimais
- THEN a API responde `422` apontando o campo
- AND a interface destaca o campo sem limpar os demais

#### Scenario: Homônimos

- GIVEN um paciente já cadastrado com determinado nome
- WHEN a profissional cadastra outro com nome idêntico
- THEN o sistema aceita o cadastro
- AND a interface sinaliza a existência do homônimo antes de confirmar

### Requirement: Listagem com busca e paginação

O sistema SHALL listar pacientes paginados, com busca por nome ou telefone e
filtro por status. A listagem MUST retornar no máximo 50 registros por página.

#### Scenario: Busca parcial

- GIVEN quarenta pacientes cadastrados
- WHEN a profissional digita três caracteres no campo de busca
- THEN a lista mostra apenas os pacientes cujo nome ou telefone contém o trecho
- AND a busca ignora acentos e diferença de maiúsculas

#### Scenario: Padrão da listagem

- GIVEN pacientes ativos e arquivados no sistema
- WHEN a listagem é aberta sem filtro explícito
- THEN apenas pacientes ativos são exibidos

### Requirement: Perfil individual

O sistema SHALL apresentar um perfil por paciente reunindo dados cadastrais,
histórico de atendimentos e ponto de entrada para o prontuário.

#### Scenario: Histórico no perfil

- GIVEN um paciente com atendimentos realizados, cancelados, remarcados e faltas
- WHEN seu perfil é aberto
- THEN os atendimentos aparecem em ordem cronológica decrescente com data, duração,
      status e valor
- AND os encerrados por cancelamento, remarcação ou falta exibem o motivo
- AND o acesso é registrado na trilha de auditoria

#### Scenario: Remarcações encadeadas no histórico

- GIVEN um atendimento remarcado duas vezes
- WHEN seu perfil é aberto
- THEN cada atendimento `REMARCADO` aparece ligado ao que o substituiu, de forma
      que a cadeia original → remarcações → atendimento vigente seja legível
- AND nenhum elo da cadeia é omitido

### Requirement: Arquivamento em vez de exclusão

O sistema MUST NOT oferecer exclusão de paciente. Encerrado o acompanhamento, o
paciente SHALL ser arquivado, permanecendo consultável e preservando o vínculo
com atendimentos e registros clínicos. A restrição existe porque apagar o cadastro
destruiria o histórico clínico e o histórico financeiro atrelado a ele.

#### Scenario: Arquivar

- GIVEN um paciente ativo com atendimentos passados
- WHEN a profissional o arquiva
- THEN ele sai da listagem padrão e some das opções de novo agendamento
- AND seu perfil e histórico continuam acessíveis pelo filtro de arquivados

#### Scenario: Arquivar com agenda futura

- GIVEN um paciente com atendimento agendado para data futura
- WHEN a profissional tenta arquivá-lo
- THEN o sistema exibe os atendimentos pendentes e pede confirmação
- AND ao confirmar, os atendimentos futuros são cancelados com motivo registrado

#### Scenario: Reativar

- GIVEN um paciente arquivado
- WHEN a profissional o reativa
- THEN ele volta à listagem padrão com o valor de consulta anterior preservado

### Requirement: Alteração de valor sem efeito retroativo

O sistema MUST congelar o valor da consulta em cada atendimento no momento do
agendamento. Alterar o valor padrão do paciente SHALL afetar apenas atendimentos
criados depois da alteração.

#### Scenario: Reajuste

- GIVEN um paciente com atendimentos realizados a R$ 150,00
- WHEN o valor padrão é alterado para R$ 180,00
- THEN os atendimentos anteriores continuam valendo R$ 150,00
- AND o próximo agendamento nasce com R$ 180,00
