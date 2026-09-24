# Delta for Prontuario

## ADDED Requirements

### Requirement: Registro de evolução

O sistema SHALL permitir registrar evolução clínica em texto livre, vinculada a
um paciente. Quando a evolução for iniciada a partir de um atendimento
`REALIZADO`, o vínculo com esse atendimento MUST ser persistido.

A data e hora do registro MUST ser atribuídas pelo servidor e MUST NOT ser
editáveis pela interface.

#### Scenario: Evolução a partir do atendimento

- GIVEN um atendimento `REALIZADO` sem evolução
- WHEN a profissional registra a evolução a partir dele
- THEN a evolução é criada vinculada ao paciente e ao atendimento
- AND a data e hora do registro são as do servidor no momento da gravação

#### Scenario: Evolução avulsa

- GIVEN um paciente ativo
- WHEN a profissional registra evolução pelo perfil, sem partir de um atendimento
- THEN a evolução é criada vinculada apenas ao paciente

#### Scenario: Texto vazio

- GIVEN o editor de evolução aberto
- WHEN a profissional tenta gravar com o texto em branco
- THEN a API responde `422`
- AND nada é persistido

#### Scenario: Paciente arquivado

- GIVEN um paciente arquivado
- WHEN a profissional abre seu prontuário
- THEN as evoluções existentes são legíveis
- AND o registro de nova evolução não é oferecido

### Requirement: Evolução criptografada e auditada

O sistema MUST armazenar o texto da evolução criptografado em repouso, usando o
mesmo mecanismo de coluna já empregado no motivo de atendimento.

A auditoria MUST ser por evolução individual, não por chamada de rota, e SHALL
distinguir dois eventos:

- `EVOLUCAO_LISTADA` — a lista do prontuário foi aberta. Registra paciente e
  quantidade de evoluções, sem decifrar nenhum texto.
- `EVOLUCAO_LIDA` — o texto de uma evolução específica foi decifrado e devolvido.
  Registra paciente e identificador da evolução.

O ponto de registro de `EVOLUCAO_LIDA` MUST ser o serviço de criptografia, no
momento de decifrar, e não o controller. Amarrada ao controller, a trilha depende
de alguém lembrar de chamá-la em cada rota nova; amarrada ao ponto de decifragem,
qualquer caminho que leia evolução aparece na trilha por construção.

#### Scenario: Texto não legível no banco

- GIVEN uma evolução gravada
- WHEN a coluna de texto é lida diretamente no Postgres
- THEN o conteúdo não aparece em claro

#### Scenario: Abrir a lista do prontuário

- GIVEN um paciente com cinco evoluções
- WHEN a lista do prontuário é aberta
- THEN a auditoria registra um `EVOLUCAO_LISTADA` com a quantidade
- AND nenhum `EVOLUCAO_LIDA` é gerado

#### Scenario: Abrir o texto de uma evolução

- GIVEN a lista do prontuário aberta
- WHEN a profissional abre o texto de uma evolução específica
- THEN a auditoria registra exatamente um `EVOLUCAO_LIDA` para aquele identificador

#### Scenario: Exportação audita cada evolução

- GIVEN um paciente com cinco evoluções
- WHEN o prontuário é exportado em PDF
- THEN a auditoria registra `EVOLUCAO_LIDA` para cada evolução incluída
- AND também registra o evento de exportação

#### Scenario: Caminho novo de leitura

- GIVEN qualquer rota que devolva texto de evolução decifrado
- WHEN ela é exercitada
- THEN a trilha contém `EVOLUCAO_LIDA` para cada evolução decifrada
- AND isso vale sem que a rota precise chamar a auditoria explicitamente

### Requirement: Retificação versionada

O sistema MUST NOT oferecer exclusão nem edição destrutiva de evolução. Corrigir
uma evolução SHALL criar nova versão, preservando a anterior, que passa a
constar como retificada e permanece legível.

A restrição espelha a remarcação de atendimento: registro clínico não se edita,
encerra-se e encadeia-se.

#### Scenario: Retificar

- GIVEN uma evolução registrada há dois dias
- WHEN a profissional a retifica com novo texto
- THEN uma nova versão é criada com data e hora próprias
- AND a versão anterior permanece armazenada e marcada como retificada
- AND o prontuário exibe a versão vigente com indicação de que houve retificação

#### Scenario: Consultar versão anterior

- GIVEN uma evolução com duas retificações
- WHEN a profissional abre o histórico daquela evolução
- THEN as três versões aparecem em ordem cronológica
- AND nenhum elo da cadeia é omitido

#### Scenario: Tentativa de exclusão

- GIVEN uma evolução existente
- WHEN qualquer rota da API recebe pedido de exclusão dessa evolução
- THEN a operação é recusada
- AND a interface não oferece esse comando

### Requirement: Rascunho sem perda

O sistema SHALL persistir automaticamente o texto em edição como rascunho, no
servidor e criptografado, de modo que sessão expirada, aba fechada ou falha de
rede não destruam o trabalho.

O rascunho MUST NOT ser gravado em `localStorage`, `sessionStorage` ou IndexedDB:
texto clínico em claro no navegador contraria a criptografia de coluna que o
resto do sistema mantém.

#### Scenario: Recuperação após queda

- GIVEN uma evolução em edição há dez minutos, ainda não gravada
- WHEN a aba é fechada e o prontuário é reaberto
- THEN o texto do rascunho é oferecido para continuar
- AND a profissional escolhe retomar ou descartar

#### Scenario: Sessão expirada durante a escrita

- GIVEN uma evolução em edição e a sessão expirando por inatividade
- WHEN a profissional reautentica
- THEN o rascunho continua disponível
- AND nenhum texto é perdido

#### Scenario: Rascunho consumido

- GIVEN um rascunho pendente para um paciente
- WHEN a evolução correspondente é gravada
- THEN o rascunho é removido
- AND não reaparece em acessos seguintes

### Requirement: Exportação do prontuário

O sistema SHALL exportar o prontuário completo de um paciente em PDF, contendo
dados cadastrais, histórico de atendimentos e todas as evoluções com suas
versões. A exportação MUST ser registrada na auditoria.

#### Scenario: Exportar

- GIVEN um paciente com evoluções e retificações
- WHEN a profissional exporta o prontuário
- THEN o PDF contém todas as versões, identificadas como vigente ou retificada
- AND traz data de emissão e identificação da profissional
- AND a auditoria registra a exportação

#### Scenario: Paciente sem evolução

- GIVEN um paciente sem nenhuma evolução registrada
- WHEN a profissional exporta o prontuário
- THEN o PDF é gerado com dados cadastrais e histórico de atendimentos
- AND indica explicitamente a ausência de evoluções

### Requirement: Prazo de guarda configurável

O sistema SHALL calcular e exibir a data a partir da qual o prontuário de um
paciente se torna elegível para descarte. O prazo MUST vir de configuração, com
padrão de 20 anos e mínimo aceito de 5 anos.

A contagem SHALL partir da data do último registro do paciente, não da data de
arquivamento. Para paciente que era menor de idade durante o atendimento, a
contagem SHALL partir da data em que completa 18 anos.

O sistema MUST NOT executar descarte automático. O enquadramento entre 5 e 20
anos é decisão da profissional, fundamentada na Resolução CFP nº 001/2009 e na
Lei nº 13.787/2018, e o sistema apenas informa.

#### Scenario: Data de elegibilidade

- GIVEN um paciente arquivado, com último registro em 10/03/2024
- WHEN seu perfil é aberto com o prazo configurado em 20 anos
- THEN a data de elegibilidade exibida é 10/03/2044

#### Scenario: Novo registro adia a contagem

- GIVEN um paciente arquivado com data de elegibilidade calculada
- WHEN ele é reativado e recebe nova evolução
- THEN a data de elegibilidade é recalculada a partir do novo registro

#### Scenario: Paciente que era menor de idade

- GIVEN um paciente que tinha 15 anos no último atendimento
- WHEN a data de elegibilidade é calculada com prazo de 20 anos
- THEN a contagem parte da data em que ele completa 18 anos

#### Scenario: Configuração abaixo do mínimo

- GIVEN o prazo configurado com valor inferior a 5 anos
- WHEN a aplicação inicia
- THEN a inicialização falha com erro explícito

#### Scenario: Nada expira sozinho

- GIVEN um paciente cuja data de elegibilidade já passou
- WHEN qualquer rotina do sistema é executada
- THEN nenhum dado é apagado
- AND o perfil apenas sinaliza a elegibilidade

### Requirement: Backup verificado

O sistema SHALL contar com rotina automática de backup do banco, com o arquivo
resultante criptografado. A restauração MUST ter sido exercitada e documentada
antes do encerramento desta change.

#### Scenario: Backup gerado

- GIVEN a rotina de backup configurada
- WHEN ela é executada
- THEN um arquivo criptografado é produzido com data no nome
- AND a execução é registrada em log

#### Scenario: Restauração exercitada

- GIVEN um arquivo de backup
- WHEN ele é restaurado em banco limpo
- THEN as evoluções voltam legíveis pela aplicação
- AND o procedimento está documentado no README