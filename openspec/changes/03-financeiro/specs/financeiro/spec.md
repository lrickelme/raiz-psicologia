# Delta for Financeiro

## ADDED Requirements

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
congelado dos atendimentos `AGENDADO` restantes.

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

#### Scenario: Previsão não é projeção

- GIVEN o dashboard aberto
- WHEN a receita prevista é exibida
- THEN ela cobre apenas o mês corrente
- AND o sistema não apresenta estimativa para meses futuros

### Requirement: Comparativo entre meses

O sistema SHALL exibir a receita realizada dos últimos doze meses, permitindo
comparação entre eles.

#### Scenario: Série mensal

- GIVEN histórico com dezoito meses de atendimentos
- WHEN o comparativo é aberto
- THEN os doze meses mais recentes são exibidos em ordem cronológica
- AND meses sem receita aparecem com zero, não são omitidos da série

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

### Requirement: Dashboard financeiro

O sistema SHALL apresentar os números em dashboard com gráficos, usando
exclusivamente os tokens de cor do guia Raíz. Hex fora dos tokens MUST NOT ser
introduzido para colorir gráfico.

O dashboard SHALL permitir filtrar por período. Cor MUST NOT ser o único
portador de significado em nenhum gráfico.

#### Scenario: Filtro por período

- GIVEN o dashboard com histórico de dois anos
- WHEN a profissional filtra por um trimestre
- THEN todos os números e gráficos refletem apenas o período
- AND a resposta ocorre em menos de dois segundos

#### Scenario: Valores monetários

- GIVEN qualquer número monetário exibido no dashboard
- WHEN ele é renderizado
- THEN aparece em real brasileiro, com duas casas decimais e separador de milhar

#### Scenario: Estado vazio

- GIVEN um período filtrado sem nenhum atendimento
- WHEN o dashboard é exibido
- THEN cada painel indica ausência de dados
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