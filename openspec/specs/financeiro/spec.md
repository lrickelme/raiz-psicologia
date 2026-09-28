# financeiro Specification

## Purpose
Apuração da receita a partir dos atendimentos — realizada, prevista e pendente
de encerramento —, por período e por paciente, e o dashboard que a apresenta.

## Requirements

### Requirement: Receita realizada

O sistema SHALL calcular a receita realizada de um período como a soma do valor
congelado dos atendimentos cobráveis cujo início ocorreu no período e cuja
cobrança não foi dispensada.

O cálculo MUST usar o valor congelado em cada atendimento, nunca o valor padrão
atual do paciente. O cálculo MUST usar a cobrabilidade congelada, nunca a regra
vigente aplicada retroativamente.

#### Scenario: Composição da receita

- GIVEN em um mês: dois `REALIZADO` a R$ 150, um `FALTA` a R$ 150, um `CANCELADO`
      cobrável a R$ 150, um `CANCELADO` não cobrável e um `REMARCADO`
- WHEN a receita realizada do mês é calculada
- THEN o total é R$ 600,00
- AND os dois últimos não entram

#### Scenario: Reajuste não altera o passado

- GIVEN um mês fechado com receita apurada de R$ 600,00
- WHEN o valor padrão de um dos pacientes é reajustado
- THEN a receita daquele mês continua R$ 600,00

#### Scenario: Cobrança dispensada

- GIVEN um atendimento cobrável a R$ 150 com cobrança dispensada
- WHEN a receita do mês é calculada
- THEN ele não entra no total

#### Scenario: Mês sem atendimento

- GIVEN um mês sem nenhum atendimento encerrado
- WHEN a receita é calculada
- THEN o total é R$ 0,00
- AND a interface exibe estado vazio, não um gráfico sem dados

### Requirement: Receita prevista do mês

O sistema SHALL exibir, para o mês corrente, a receita prevista a partir do valor
congelado dos atendimentos `AGENDADO` cujo horário ainda não terminou.
Atendimentos `AGENDADO` com horário já terminado MUST NOT entrar na previsão:
são pendências de encerramento (requisito "Atendimentos pendentes de
encerramento").

A previsão MUST ser apresentada separada da receita realizada, nunca somada a ela
em um único número.

#### Scenario: Previsão do mês corrente

- GIVEN três atendimentos `AGENDADO` a R$ 150 ainda por ocorrer neste mês
- WHEN o dashboard é aberto
- THEN a receita prevista exibida é R$ 450,00
- AND aparece como valor distinto da receita realizada

#### Scenario: Atendimento encerrado sai da previsão

- GIVEN um atendimento `AGENDADO` contando na previsão
- WHEN ele é marcado como realizado
- THEN sai da previsão
- AND entra na receita realizada

#### Scenario: Horário terminado sai da previsão

- GIVEN um atendimento `AGENDADO` deste mês cujo horário de término já passou
- WHEN o dashboard é aberto
- THEN ele não conta na receita prevista
- AND aparece entre os pendentes de encerramento

#### Scenario: Previsão não é projeção

- GIVEN o dashboard aberto
- WHEN a receita prevista é exibida
- THEN ela cobre apenas o mês corrente
- AND o sistema não apresenta estimativa para meses futuros

### Requirement: Atendimentos pendentes de encerramento

O sistema SHALL exibir, para o período selecionado, a quantidade e a soma do
valor congelado dos atendimentos `AGENDADO` cujo horário já terminou, em
qualquer mês do período.

Esses atendimentos continuam compondo a expectativa de recebimento, mas MUST
ser apresentados em indicador próprio, distinto da receita prevista e da
realizada, nunca somados a elas em um único número: atendimento não encerrado é
erro operacional, e a previsão o esconderia.

#### Scenario: Pendência visível

- GIVEN dois atendimentos `AGENDADO` a R$ 150 cujo horário terminou ontem, sem
      encerramento
- WHEN o dashboard é aberto
- THEN o indicador de pendentes exibe 2 atendimentos somando R$ 300,00
- AND a receita prevista não os inclui
- AND a receita realizada não os inclui

#### Scenario: Pendência de mês anterior

- GIVEN um atendimento `AGENDADO` do mês passado, nunca encerrado
- WHEN a profissional filtra o período do mês passado
- THEN ele aparece entre os pendentes de encerramento
- AND não há receita prevista para o período

#### Scenario: Encerramento resolve a pendência

- GIVEN um atendimento pendente de encerramento
- WHEN a profissional o marca como realizado ou falta
- THEN ele sai dos pendentes
- AND entra na receita realizada

### Requirement: Comparativo entre meses

O sistema SHALL exibir a receita realizada dos últimos doze meses, permitindo
comparação entre eles. A série MUST NOT depender do filtro de período do
dashboard: é o contexto contra o qual o período filtrado é lido. O painel MUST
declarar que cobre os últimos doze meses e, com filtro ativo, que não segue o
filtro.

#### Scenario: Série mensal

- GIVEN histórico com dezoito meses de atendimentos
- WHEN o comparativo é aberto
- THEN os doze meses mais recentes são exibidos em ordem cronológica
- AND meses sem receita aparecem com zero, não são omitidos da série

#### Scenario: Filtro ativo

- GIVEN o dashboard filtrado por um trimestre
- WHEN o comparativo é exibido
- THEN ele continua mostrando os doze meses até o corrente, sob o título
      "Últimos 12 meses"
- AND informa que mostra a série completa, sem seguir o filtro
- AND os meses alcançados pelo período aparecem marcados por texto, não só por cor

#### Scenario: Histórico curto

- GIVEN um sistema com três meses de uso
- WHEN o comparativo é aberto
- THEN apenas os três meses existentes são exibidos
- AND não há meses vazios preenchidos antes do primeiro atendimento

### Requirement: Receita por paciente

O sistema SHALL exibir, para um período selecionado, a receita por paciente, com
a contagem de atendimentos por status que a compõe.

A visão MUST incluir a contagem de remarcações por paciente, ainda que remarcação
não gere receita: é o dado que permite perceber um padrão de remarcações
sucessivas.

A visão identifica pacientes pelo nome e MUST ser registrada na trilha de
auditoria, como todo acesso a dado de paciente (spec auth, "Trilha de
auditoria").

#### Scenario: Composição por paciente

- GIVEN um paciente com três `REALIZADO`, um `FALTA` e duas remarcações no período
- WHEN a receita por paciente é exibida
- THEN aparecem o total cobrado e a contagem de cada status
- AND as duas remarcações aparecem na contagem sem somar ao total

#### Scenario: Paciente arquivado no período

- GIVEN um paciente arquivado que teve atendimentos no período
- WHEN a receita por paciente é exibida
- THEN ele consta da lista
- AND é identificado como arquivado

#### Scenario: Consulta registrada na trilha

- GIVEN a receita por paciente de um período com atendimentos de dois pacientes
- WHEN a profissional a consulta
- THEN a trilha de auditoria registra a leitura com o identificador de cada
      paciente listado
- AND as consultas de receita do período e da série mensal, por não
      identificarem paciente, não geram registro

### Requirement: Dashboard financeiro

O sistema SHALL apresentar os números em dashboard com gráficos, usando
exclusivamente os tokens de cor do guia Raíz. Hex fora dos tokens MUST NOT ser
introduzido para colorir gráfico.

O dashboard SHALL permitir filtrar por período. Cor MUST NOT ser o único
portador de significado em nenhum gráfico.

Valores que a profissional lê como quantia — cartões, tabelas, tooltip, rótulos
do ranking — MUST aparecer em real brasileiro, com duas casas decimais e
separador de milhar. Rótulos de escala de eixo não são quantia, são referência
de magnitude para as linhas de grade, e MAY usar forma abreviada ("R$ 20 mil").

#### Scenario: Filtro por período

- GIVEN o dashboard com histórico de dois anos
- WHEN a profissional filtra por um trimestre
- THEN todos os números e gráficos refletem apenas o período, exceto o
      comparativo entre meses, que continua mostrando os doze meses até o corrente
- AND a resposta ocorre em menos de dois segundos

#### Scenario: Valores monetários

- GIVEN um valor que a profissional lê como quantia no dashboard — cartão,
      tabela, tooltip ou rótulo do ranking
- WHEN ele é renderizado
- THEN aparece em real brasileiro, com duas casas decimais e separador de milhar

#### Scenario: Escala do gráfico mensal

- GIVEN o gráfico mensal
- WHEN o eixo é renderizado
- THEN os rótulos de escala podem ser abreviados
- AND o tooltip e a tabela de valores por mês exibem o valor exato com duas casas

#### Scenario: Estado vazio

- GIVEN um período filtrado sem nenhum atendimento
- WHEN o dashboard é exibido
- THEN cada painel que depende do período indica ausência de dados
- AND nenhum gráfico é renderizado vazio

### Requirement: Cálculo agregado no banco

Os totais MUST ser calculados por agregação no banco de dados. O sistema MUST NOT
carregar atendimentos para somar em memória na camada de aplicação.

#### Scenario: Volume de dois anos

- GIVEN dois anos de atendimentos no banco
- WHEN o dashboard é aberto sem filtro
- THEN a apuração ocorre em menos de dois segundos
- AND a quantidade de registros trafegados entre banco e aplicação não cresce com
      o volume do histórico
