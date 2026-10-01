# Tasks

## 1. Modelo

- [x] 1.1 Prisma: enums `StatusTopico` e `CorLabel`, modelos `LabelPrioridade` e `TopicoEstudo`, com FK `labelId` `onDelete: Restrict`
- [x] 1.2 Migration: `CHECK topico_conclusao_coerente`, índice único `raiz_normalizar(nome)`, índice por status e índice parcial de concluídos por `concluido_em DESC`
- [x] 1.3 Na mesma migration, inserir Alta/VINHO/1, Média/AMBAR/2 e Baixa/MUSGO/3
- [x] 1.4 `packages/shared/src/estudos.ts`: schemas de tópico (criação, edição sem status, transição só com `status`), label (criação, edição, ordem), respostas do quadro e do histórico; exportar no `index.ts`
- [x] 1.5 Teste: `CHECK` recusa `CONCLUIDO` sem `concluido_em` e `A_ESTUDAR` com `concluido_em`
- [x] 1.6 Teste: índice único recusa "alta" e "Álta" diante de "Alta"

## 2. Labels

- [x] 2.1 Módulo `estudos` no Nest, com `LabelController`, serviço e repositório, registrado no `AppModule` e sem `@Auditado`
- [x] 2.2 `GET /labels` em ordem, com `emUso` por label
- [x] 2.3 `POST /labels` com `ordem = max + 1`; nome duplicado vira `409`
- [x] 2.4 `PATCH /labels/:id` para nome e cor; nome duplicado vira `409`
- [x] 2.5 `PUT /labels/ordem` com a lista completa, reescrita de 1 a n em transação; conjunto diferente do atual vira `409`
- [x] 2.6 `DELETE /labels/:id`: `409` com `topicos: n` quando em uso, `P2003` traduzido para o mesmo `409`, renumeração das seguintes em transação
- [x] 2.7 Teste: label usada só por tópico concluído também é bloqueada
- [x] 2.8 Teste: exclusão com tópico associado entre a contagem e o `DELETE` responde `409` (forçar a corrida no repositório)
- [x] 2.9 Teste: cor fora do enum responde `422` em `cor`
- [x] 2.10 Teste: ordem sem buracos depois de excluir a label do meio

## 3. Tópicos

- [x] 3.1 `TopicoController`, serviço e repositório, sem `@Auditado`
- [x] 3.2 `POST /topicos` sempre em `A_ESTUDAR`; `labelId` inexistente vira `422` em `labelId`, inclusive via `P2003`
- [x] 3.3 `PATCH /topicos/:id` para título, descrição e label (`null` remove); status fora do schema
- [x] 3.4 `POST /topicos/:id/mover` com a regra de `concluidoEm` no serviço; mesmo estado não regrava nada
- [x] 3.5 `GET /estudos/quadro`: pendentes ordenados no SQL por `ordem NULLS LAST, criado_em`, 5 concluídos mais recentes, total de concluídos, pendentes e concluídos no mês por `inicioDoMes`/`fimDoMes` de `@raiz/shared`
- [x] 3.6 `GET /topicos/concluidos` paginado com `TAMANHO_MAXIMO_PAGINA`
- [x] 3.7 Teste: concluir, reabrir e concluir de novo grava o instante da segunda conclusão
- [x] 3.8 Teste: `concluidoEm` enviado no corpo é ignorado
- [x] 3.9 Teste: ordenação com label, sem label e mesma label com datas diferentes; reordenar labels muda a ordem do quadro
- [x] 3.10 Teste de fuso: concluído às 22h de 30/09 em São Paulo conta em setembro, com `TZ` do processo diferente de São Paulo
- [x] 3.11 Teste: título vazio ou só com espaços responde `422` em `titulo`
- [x] 3.12 Teste: não existe rota de exclusão de tópico (`DELETE /topicos/:id` responde `404`)

## 4. Interface

- [ ] 4.1 `cores-label.ts`: mapa `CorLabel → { fundo, texto }` em classes do `@theme`; adicionar token para o branco do pill se não existir; zero hex no JSX
- [ ] 4.2 Teste unitário de contraste lendo `globals.css`: todo par ≥ 4,5:1
- [ ] 4.3 `pill-label.tsx` sempre com o nome escrito
- [ ] 4.4 Quadro em `(app)/estudos` substituindo o placeholder: três colunas de um componente só, contadores e cabeçalho "N pendentes · M concluídos este mês", conforme o `design-ref`
- [ ] 4.5 Cartão com caixa de conclusão e menu "Mover para…"/"Editar", operável por teclado e sem ação só em `hover`
- [ ] 4.6 Movimento otimista no TanStack Query, com rollback e mensagem em caso de erro
- [ ] 4.7 Coluna "Concluídos": cartões riscados com data em mono, "+ N no histórico" quando houver mais de 5
- [ ] 4.8 Estado vazio por coluna, com "+ Novo tópico" sempre disponível
- [ ] 4.9 Modal de tópico (criar e editar): título, descrição, seletor de label com opção "Sem prioridade", aviso fixo de que estudos não é prontuário, erros `422` por campo sem limpar o formulário
- [ ] 4.10 Histórico de concluídos paginado, reaproveitando `paginacao.tsx`, com ação de reabrir
- [ ] 4.11 Gestão de labels em modal pelo "Gerenciar labels": criar, renomear, trocar cor em seletor de amostras nomeadas, subir/descer, excluir com aviso por `emUso` e tratamento do `409`
- [ ] 4.12 E2E: criar tópico, mover, concluir, reabrir pelo histórico
- [ ] 4.13 E2E: excluir label em uso mostra a quantidade e não exclui; trocar a label dos tópicos e excluir com sucesso
- [ ] 4.14 Captura de estudos no `comparacao-visual.spec.ts` contra `#estudos` do `design-ref`

## 5. Fechamento

- [ ] 5.1 Conferir cada cenário da delta spec contra o comportamento real, como caixa-preta, com relatório em `verificacao.md`
- [ ] 5.2 Confirmar com a profissional ou no SDD que o escopo cobre os RF07 a RF10 por inteiro (ver risco no proposal)
- [ ] 5.3 `pnpm -r test` e `pnpm -r build`
- [ ] 5.4 `openspec validate 04-estudos`
