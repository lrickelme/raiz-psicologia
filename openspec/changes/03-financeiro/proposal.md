# Proposal: Financeiro

## Why

A agenda já congela o valor de cada atendimento e distingue cinco status. O que
falta é transformar isso em números que a profissional use para decidir: quanto
entrou no mês, quanto ainda entra, como está em relação aos meses anteriores.

Esta change fecha a regra de cobrança — que até agora existia como pergunta em
aberto no ROADMAP — e entrega o dashboard financeiro.

A regra veio da cliente: cancelamento é cobrado apenas quando comunicado no dia
da consulta; remarcação nunca é cobrada; falta é cobrada.

## What Changes

Incluído:

- Campo de cobrabilidade no atendimento, congelado no momento do encerramento.
- Dispensa manual da cobrança, com motivo, visível no histórico.
- Receita realizada: `REALIZADO`, `FALTA` e `CANCELADO` cobrável.
- Receita prevista do mês, a partir dos `AGENDADO` restantes.
- Comparativo mês a mês e receita por paciente.
- Dashboard com gráficos usando os tokens do Raíz.
- Filtro do dashboard abaixo de dois segundos (RNF03).

Excluído:

- Emissão de nota fiscal e integração com meios de pagamento.
- Registro de pagamento recebido. Esta change calcula o que é devido, não o que
  foi pago. Controle de inadimplência é outra capacidade, e misturar as duas
  agora produziria um modelo que não serve bem a nenhuma.
- Projeção além do mês corrente. "Projeções" apareceu no SDD original, mas
  projetar receita a partir de uma agenda que muda toda semana produz número que
  ninguém confia. Receita prevista do mês corrente é o que tem base real.
- Adaptação para celular. A change 06 adapta.

## Abordagem

A regra de cobrança é de dia de calendário, não de horas de antecedência. Isso é
mais simples de explicar para a paciente — "avisou no dia, é cobrado" — e mais
simples de testar, mas produz uma assimetria que vale conhecer: uma consulta de
segunda às 9h cancelada no domingo às 23h não é cobrada, enquanto uma de segunda
às 18h cancelada na segunda às 8h é, apesar das dez horas de aviso. É a regra que
a cliente quer, e está implementada literalmente.

O resultado da regra é congelado em campo próprio no encerramento, pela mesma
razão que o valor da consulta é congelado no agendamento: mudar a regra depois não
pode reescrever a receita de meses já fechados.

Os totais são calculados em SQL agregado, não carregando atendimentos para somar
em memória. Com dois anos de histórico, a diferença decide se o RNF03 é atendido.

## Riscos

- **Receita que muda sozinha.** O defeito mais grave possível aqui é o total de um
  mês fechado mudar depois. Congelar a cobrabilidade e usar o valor congelado do
  atendimento é o que previne isso, e os testes cobrem explicitamente.
- **Brecha da remarcação.** Como remarcação não é cobrada, remarcar no dia e
  depois cancelar o novo horário com antecedência resulta em zero cobrança com o
  horário original perdido. A brecha existe, exige intenção, e o sistema não a
  fecha por decisão da cliente — remarcar e cancelar são eventos clinicamente
  distintos. O dashboard expõe a contagem de remarcações por paciente, que é o
  suficiente para ela perceber o padrão se acontecer.
- **Dispensa como buraco na trilha.** Dispensar cobrança altera receita. A dispensa
  exige motivo e fica registrada, para que o número de um mês sempre tenha
  explicação.