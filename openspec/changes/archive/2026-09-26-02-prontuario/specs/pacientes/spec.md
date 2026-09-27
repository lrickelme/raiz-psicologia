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
## ADDED Requirements

### Requirement: Telefone normalizado

O sistema MUST persistir telefone apenas como dígitos, sem máscara, separadores
ou prefixo internacional. A formatação é responsabilidade da exibição, nunca do
armazenamento.

Telefone MUST ter 10 dígitos (fixo) ou 11 dígitos (celular). A interface SHALL
aplicar máscara durante a digitação, alternando de (99) 9999-9999 para
(99) 99999-9999 ao surgir o 11º dígito.

A busca por telefone MUST normalizar tanto o termo digitado quanto o dado
armazenado, de modo que encontrar um paciente independa do formato usado.

#### Scenario: Máscara progressiva

- GIVEN o campo de telefone vazio
- WHEN a profissional digita 83993229097
- THEN o campo exibe (83) 99322-9097 conforme ela digita
- AND o valor enviado à API é 83993229097

#### Scenario: Telefone fixo

- GIVEN o campo de telefone
- WHEN são digitados 10 dígitos
- THEN a máscara exibida é (83) 3221-4567

#### Scenario: Colagem

- GIVEN um número copiado como +55 (83) 99322-9097
- WHEN ele é colado no campo
- THEN a máscara o normaliza para (83) 99322-9097
- AND o 55 inicial é descartado como prefixo de país

#### Scenario: Apagar

- GIVEN o campo com (83) 99322-9097
- WHEN a profissional pressiona backspace repetidamente
- THEN cada toque remove um dígito, nunca apenas um caractere da máscara
- AND o cursor não salta para o fim do campo

#### Scenario: Quantidade inválida

- GIVEN o campo com 8 dígitos
- WHEN o formulário é enviado
- THEN a API responde 422 apontando o campo
- AND a interface sinaliza antes do envio

#### Scenario: Busca independente de formato

- GIVEN um paciente gravado com 83993229097
- WHEN a busca recebe (83) 99322 ou 83993
- THEN o paciente é encontrado nos dois casos

#### Scenario: Dados legados

- GIVEN registros gravados antes desta mudança, com formatos mistos
- WHEN a migração é aplicada
- THEN todos passam a conter apenas dígitos
- AND nenhum registro é perdido por formato inesperado
