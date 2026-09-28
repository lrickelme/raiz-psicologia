# Tasks

## 1. Cobrabilidade

- [x] 1.1 Migration: `encerradoEm DateTime?`, `cobravel Boolean?`, `cobrancaDispensada Boolean @default(false)`, `motivoDispensa String?`
- [x] 1.2 `motivoDispensa` pela coluna criptografada da 01 — reutilizar, não duplicar
- [x] 1.3 Índice parcial `atendimento_receita_idx` em `(inicio)` filtrando cobrável e não dispensada
- [x] 1.4 `comum/cobranca/`: função pura recebendo início, instante de encerramento e status
- [x] 1.5 Comparação por data de calendário em `America/Sao_Paulo`, não por diferença de horas
- [x] 1.6 Gravar `encerradoEm` e `cobravel` em cada transição de encerramento em `atendimento`
- [x] 1.7 Backfill dos atendimentos já encerrados, com o instante do encerramento tirado da trilha de auditoria; `CANCELADO` sem registro fica com `cobravel` nulo e é listado
- [x] 1.8 Teste da função pura: dia anterior, mesmo dia, após o horário, remarcado, falta, realizado
- [x] 1.9 Teste: atendimento `AGENDADO` tem `cobravel` nulo
- [x] 1.10 Teste de fuso: cancelamento à meia-noite com `TZ` do processo diferente de São Paulo

## 2. Dispensa

- [x] 2.1 `POST /atendimentos/:id/dispensar-cobranca` exigindo motivo
- [x] 2.2 `POST /atendimentos/:id/reverter-dispensa`
- [x] 2.3 Recusa de dispensa em atendimento não cobrável
- [x] 2.4 Dispensa e reversão na trilha de auditoria
- [x] 2.5 Dispensa preserva `cobravel = true`, sem sobrescrever
- [x] 2.6 Teste: dispensa sem motivo responde `422`
- [x] 2.7 Teste: dispensa e reversão refletidas no total

## 3. Apuração

- [x] 3.1 Schemas Zod de resposta financeira em `packages/shared`, valores como string
- [x] 3.2 Repositório com agregação em SQL — nunca `findMany` seguido de `reduce`
- [x] 3.3 `GET /financeiro/receita` com realizada e prevista separadas
- [x] 3.4 `GET /financeiro/mensal` com doze meses, zeros preservados, sem meses antes do primeiro atendimento
- [x] 3.5 `GET /financeiro/por-paciente` com contagem por status, incluindo remarcações
- [x] 3.6 Paciente arquivado identificado como tal na lista
- [x] 3.7 Intervalo obrigatório em `receita` e `por-paciente`
- [x] 3.8 `Prisma.Decimal` em todo o caminho, sem conversão para `number`
- [x] 3.9 Teste: composição da receita com os cinco status na mesma apuração
- [x] 3.10 Teste: receita de mês fechado inalterada após reajuste do paciente
- [x] 3.11 Teste: receita de mês fechado inalterada após mudança da regra de cobrança
- [x] 3.12 Teste de carga: dois anos de atendimentos, apuração abaixo de dois segundos

## 4. Dashboard

- [x] 4.1 Rota `(app)/financeiro` dentro do shell existente
- [x] 4.2 Painéis de receita realizada e prevista, visualmente distintos
- [x] 4.3 Filtro de período, refazendo as consultas de receita e por paciente; a série mensal não depende do filtro
- [x] 4.4 Gráfico de barras da série mensal, com título "Últimos 12 meses" e, com filtro de período ativo, linha discreta informando que o painel mostra a série completa
- [x] 4.5 Tabela de receita por paciente como visão primária: ordenada por valor, paginada, com total, contagem de cada status (remarcações inclusive) e arquivado identificado
- [x] 4.6 Cores lidas das custom properties do `@theme`, zero hex novo no JSX
- [x] 4.7 Rótulo ou tabela de valores acompanhando cada gráfico — cor não carrega significado sozinha
- [x] 4.8 Formatação em real com `Intl.NumberFormat('pt-BR')`
- [x] 4.9 Estado vazio por painel, sem gráfico renderizado vazio
- [x] 4.10 Indicação de dispensa no histórico do paciente, com o motivo
- [x] 4.11 Rodar o script de comparação visual contra o `design-ref`
- [x] 4.12 Teste: filtro de trimestre responde abaixo de dois segundos
- [x] 4.13 Painel de pendentes de encerramento (quantidade e soma), distinto da prevista e da realizada
- [x] 4.14 Gráfico das dez maiores receitas por paciente com barra "outros" agregando o resto, subordinado à tabela
- [x] 4.15 Faixa no gráfico mensal sobre os meses que o período filtrado alcança, com rótulo de texto; sem faixa quando o período não alcança os doze meses
- [x] 4.16 Ação "Dispensar cobrança" com modal de motivo, valor congelado e razão da cobrabilidade, e "Reverter dispensa" mostrando o motivo registrado; componente único, alcançável do histórico do paciente e do detalhe do atendimento na agenda; não oferecida a atendimento não cobrável

## 5. Fechamento

- [x] 5.1 Conferir cada cenário das duas delta specs contra o comportamento real — relatório e decisões em `verificacao.md`
- [x] 5.2 Confirmar que a rota de financeiro não é cacheada
- [x] 5.3 `pnpm -r test` e `pnpm -r build`
- [x] 5.4 `openspec validate 03-financeiro`