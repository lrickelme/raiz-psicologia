# Tasks

## 1. Cobrabilidade

- [ ] 1.1 Migration: `cobravel Boolean?`, `cobrancaDispensada Boolean @default(false)`, `motivoDispensa String?`
- [ ] 1.2 `motivoDispensa` pela coluna criptografada da 01 — reutilizar, não duplicar
- [ ] 1.3 Índice parcial `atendimento_receita_idx` em `(inicio)` filtrando cobrável e não dispensada
- [ ] 1.4 `comum/cobranca/`: função pura recebendo início, instante de encerramento e status
- [ ] 1.5 Comparação por data de calendário em `America/Sao_Paulo`, não por diferença de horas
- [ ] 1.6 Gravar `cobravel` em cada transição de encerramento em `atendimento`
- [ ] 1.7 Backfill dos atendimentos já encerrados, aplicando a regra à data de encerramento registrada
- [ ] 1.8 Teste da função pura: dia anterior, mesmo dia, após o horário, remarcado, falta, realizado
- [ ] 1.9 Teste: atendimento `AGENDADO` tem `cobravel` nulo
- [ ] 1.10 Teste de fuso: cancelamento à meia-noite com `TZ` do processo diferente de São Paulo

## 2. Dispensa

- [ ] 2.1 `POST /atendimentos/:id/dispensar-cobranca` exigindo motivo
- [ ] 2.2 `POST /atendimentos/:id/reverter-dispensa`
- [ ] 2.3 Recusa de dispensa em atendimento não cobrável
- [ ] 2.4 Dispensa e reversão na trilha de auditoria
- [ ] 2.5 Dispensa preserva `cobravel = true`, sem sobrescrever
- [ ] 2.6 Teste: dispensa sem motivo responde `422`
- [ ] 2.7 Teste: dispensa e reversão refletidas no total

## 3. Apuração

- [ ] 3.1 Schemas Zod de resposta financeira em `packages/shared`, valores como string
- [ ] 3.2 Repositório com agregação em SQL — nunca `findMany` seguido de `reduce`
- [ ] 3.3 `GET /financeiro/receita` com realizada e prevista separadas
- [ ] 3.4 `GET /financeiro/mensal` com doze meses, zeros preservados, sem meses antes do primeiro atendimento
- [ ] 3.5 `GET /financeiro/por-paciente` com contagem por status, incluindo remarcações
- [ ] 3.6 Paciente arquivado identificado como tal na lista
- [ ] 3.7 Intervalo obrigatório em `receita` e `por-paciente`
- [ ] 3.8 `Prisma.Decimal` em todo o caminho, sem conversão para `number`
- [ ] 3.9 Teste: composição da receita com os cinco status na mesma apuração
- [ ] 3.10 Teste: receita de mês fechado inalterada após reajuste do paciente
- [ ] 3.11 Teste: receita de mês fechado inalterada após mudança da regra de cobrança
- [ ] 3.12 Teste de carga: dois anos de atendimentos, apuração abaixo de dois segundos

## 4. Dashboard

- [ ] 4.1 Rota `(app)/financeiro` dentro do shell existente
- [ ] 4.2 Painéis de receita realizada e prevista, visualmente distintos
- [ ] 4.3 Filtro de período, refazendo as quatro consultas
- [ ] 4.4 Gráfico de barras da série mensal
- [ ] 4.5 Gráfico de receita por paciente
- [ ] 4.6 Cores lidas das custom properties do `@theme`, zero hex novo no JSX
- [ ] 4.7 Rótulo ou tabela de valores acompanhando cada gráfico — cor não carrega significado sozinha
- [ ] 4.8 Formatação em real com `Intl.NumberFormat('pt-BR')`
- [ ] 4.9 Estado vazio por painel, sem gráfico renderizado vazio
- [ ] 4.10 Indicação de dispensa no histórico do paciente, com o motivo
- [ ] 4.11 Rodar o script de comparação visual contra o `design-ref`
- [ ] 4.12 Teste: filtro de trimestre responde abaixo de dois segundos

## 5. Fechamento

- [ ] 5.1 Conferir cada cenário das duas delta specs contra o comportamento real
- [ ] 5.2 Confirmar que a rota de financeiro não é cacheada
- [ ] 5.3 `pnpm -r test` e `pnpm -r build`
- [ ] 5.4 `openspec validate 03-financeiro`