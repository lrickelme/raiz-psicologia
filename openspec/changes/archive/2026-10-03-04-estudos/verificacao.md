# Verificação dos cenários (task 5.1)

Feita em 03/10/2026 contra o sistema rodando num ambiente descartável, o mesmo
do e2e (Postgres `postgres:16` em container, API compilada, Next em build de
produção), sem tocar o banco de desenvolvimento. Requisições pela BFF com a
sessão da profissional; interface no Chromium pelo Playwright; preparo de massa
(datas antigas, volume) direto no banco.

Diferente da 03, não foi um agente isolado: a verificação foi feita na mesma
sessão que fechou a change, guiada pela delta spec. Do código, só foram lidos o
contrato em `packages/shared` (rotas e formato das respostas) e os nomes
acessíveis usados no e2e.

**Resultado:** 29 cenários, e todos correspondem. Um deles, "Virada de mês no
fuso local", foi verificado pelo caso simétrico, porque o relógio do ambiente
estava em outubro.

Depois da verificação, a spec ganhou o requisito "Arrastar entre colunas" e dois
cenários de foco em "Estados do tópico" (ver "Decisões sobre os achados"). Esses
sete cenários são cobertos pelo e2e (`estudos.spec.ts`), e não por esta
verificação.

## Cadastro de tópico de estudo

| Cenário | Veredito | Evidência |
|---|---|---|
| Criação mínima | Corresponde | API `201`, `A_ESTUDAR`, `label: null`. Pela tela, o cartão aparece em "A estudar" sem pill e o contador sobe. Um `status: "CONCLUIDO"` no corpo é ignorado. |
| Título vazio | Corresponde | `""` e `"   "` respondem `422` com `campos[0].caminho = "titulo"`. Na tela, `aria-invalid=true` no título, e a descrição e a prioridade escolhidas continuam preenchidas. Limites: título com 201 e descrição com 2001 caracteres respondem `422`. |
| Troca e remoção da label | Corresponde | Alta → Baixa → sem label, pela API e pelo modal "Editar tópico" ("Sem prioridade"). `PATCH` com `status` não move o tópico. |
| Label inexistente | Corresponde | `422` em `labelId` ("Label não encontrada") na criação e na edição. |
| Aviso sobre dado de paciente | Corresponde | "Estudos não é prontuário. Não registre aqui nome nem outro dado que identifique paciente." aparece no modal de criação e no de edição. |

## Estados do tópico

| Cenário | Veredito | Evidência |
|---|---|---|
| Começar a estudar | Corresponde | Pelo menu "Mover para…", que oferece Em estudo, Concluídos e Editar. O cartão troca de coluna e os dois contadores se ajustam. |
| Concluir | Corresponde | A caixa do cartão leva a "Concluídos", com o título riscado (`line-through`) e "concluído 3 out" em IBM Plex Mono. Depois de recarregar, o tópico continua lá. No banco ficam `CONCLUIDO`, `concluido_em` preenchido, descrição e label intactas. Também funciona com Espaço pelo teclado. |
| Concluir direto de "A estudar" | Corresponde | A caixa marcada em "A estudar" grava `CONCLUIDO`, sem passar por `EM_ESTUDO`. |
| Reabrir | Corresponde | Reaberto para `EM_ESTUDO` com `concluidoEm: null`. Na segunda conclusão, o instante gravado é o novo (18:15:22 contra 18:15:20 da primeira). |
| Instante definido pelo servidor | Corresponde | Com `concluidoEm: 2020-01-01` no corpo, o servidor grava o instante da requisição. |
| Movimento para o mesmo estado | Corresponde | Mover `EM_ESTUDO` para `EM_ESTUDO` responde `200` e não altera `atualizado_em`. Concluir de novo um tópico concluído responde `200`, e `concluido_em` fica idêntico. |

Fora da tabela: `DELETE /topicos/:id` responde `404`, e a interface não
oferece exclusão. A caixa e o menu ficam com `opacity: 1` sem `hover`. A caixa
nativa é transparente sobre uma moldura visível, e o foco por teclado desenha um
contorno de 2px.

## Quadro de estudos

| Cenário | Veredito | Evidência |
|---|---|---|
| Ordenação por prioridade | Corresponde | Na ordem: Alta (hoje), Baixa (hoje), sem label (ontem). Entre duas Alta, a mais antiga vem primeiro. |
| Ordem segue a label, não o nome | Corresponde | Com "Alta" renomeada para "Urgente", o topo continua sendo o tópico "Urgente". |
| Contadores do cabeçalho | Corresponde | Massa da spec (3, 2, 4 neste mês e 8 antes). O cabeçalho mostra "5 pendentes · 4 concluídos este mês". A coluna mostra 12, cinco cartões e "+ 7 no histórico". |
| Virada de mês no fuso local | Corresponde (simétrico) | O relógio do ambiente estava em 03/10, então o quadro não pôde ser aberto em 30/09. No lugar disso, concluídos em 30/09 às 22h e às 23h em São Paulo (01/10 em UTC) ficaram **fora** de outubro, e um concluído em 01/10 às 00h30 entrou. Repetido com uma segunda API em `TZ=UTC` sobre o mesmo banco, com o mesmo resultado (`concluidosNoMes: 1`). O processo do ambiente estava em `America/Recife`, de deslocamento igual ao de São Paulo, e por isso sozinho não provava a regra. |
| Quadro vazio | Corresponde | "Nenhum tópico a estudar. Use “+ Novo tópico” para começar.", "Nada em estudo agora." e "Nenhum tópico concluído ainda.", com o botão "+ Novo tópico" visível. |

## Histórico de concluídos

| Cenário | Veredito | Evidência |
|---|---|---|
| Consulta do histórico | Corresponde | Com 60 concluídos semeados, a página 1 traz 50 (H01…H50, do mais recente para o mais antigo) e a página 2 traz 10 (até H60). |
| Reabrir pelo histórico | Corresponde | Pelo menu do item, "Reabrir em A estudar": o item sai do histórico (total 60 → 59) e o tópico aparece em "A estudar" ao voltar ao quadro. |

## Labels de prioridade

| Cenário | Veredito | Evidência |
|---|---|---|
| Labels iniciais | Corresponde | No banco recém-migrado: Alta/VINHO/1, Média/AMBAR/2, Baixa/MUSGO/3. A gestão lista as três nessa ordem. |
| Renomear | Corresponde | "Média" → "Normal": os três tópicos passam a exibir "Normal". |
| Nome repetido | Corresponde | "alta", "ALTA", "Álta" e " Alta " respondem `409` na criação, e "alta" e "ALTA" respondem `409` ao renomear. Na tela, "Já existe uma label com esse nome" aparece na criação e na edição, sem limpar o campo. |
| Reordenar | Corresponde | "Subir Baixa" duas vezes resulta em Baixa, Alta, Média, e o quadro passa a abrir pelo tópico Baixa. Uma lista desatualizada no `PUT /labels/ordem` responde `409`. |
| Nova label entra no fim | Corresponde | "Leitura leve" é criada com `ordem: 4`. Um nome com 31 caracteres responde `422`. |

## Paleta fechada de cores

| Cenário | Veredito | Evidência |
|---|---|---|
| Cor fora da paleta | Corresponde | `#FF00FF` e `ROXO` respondem `422` em `cor` na criação, e `#FF00FF` responde `422` na edição. O banco só tem nomes de papel. |
| Seletor restrito | Corresponde | Seis rádios com nome (Vinho, Âmbar, Musgo, Musgo suave, Marrom, Bege) e nenhum campo de cor livre. |
| Cor não é o único sinal | Corresponde | O pill do cartão traz o nome escrito ("Média"). O contraste dos pares é coberto pelo teste unitário da task 4.2. |

## Exclusão de label em uso bloqueada

| Cenário | Veredito | Evidência |
|---|---|---|
| Label em uso | Corresponde | Com dois pendentes e um concluído, a API responde `409` com `topicos: 3`. A tela mostra: "“Média” está em uso por 3 tópicos, concluídos inclusive. Troque a prioridade desses tópicos antes de excluí-la." A label e os tópicos ficam iguais. Uma label usada só por um tópico concluído também é bloqueada. |
| Label livre | Corresponde | Excluída e confirmada: some da gestão e do seletor "Prioridade". As demais seguem Alta, Média, Baixa e Leitura leve, com a ordem refeita sem buracos. |
| Corrida com associação | Corresponde | Com o diálogo "Excluir a label “Corrida”?" aberto, um tópico recebeu a label pela API. A confirmação devolveu "em uso por 1 tópico", e a label continuou existindo. |

## Fora dos cenários

1. **`pnpm -r test` depende do `@raiz/shared` compilado.** O teste de
   contraste do web importa `CORES_LABEL` de `@raiz/shared`, que resolve para
   `dist/`. Com um `dist` anterior a esta change, a suíte quebrou com
   `CORES_LABEL` indefinido, e passou depois de `pnpm build`. Num clone novo,
   sem `dist`, a suíte do web quebra. É o primeiro teste unitário do web a
   importar o pacote em tempo de execução.
2. **O cartão é remontado quando troca de coluna.** A caixa marcada pertence a
   um elemento que sai do DOM, e a caixa do cartão novo nasce marcada. Para quem
   usa teclado, o foco provavelmente se perde depois de concluir ou mover. O
   destino do foco não foi medido.

## Cobertura dos RF07 a RF10 (task 5.2)

Texto literal do SDD, fornecido pela profissional em 03/10/2026.

| RF | Texto | Cobertura |
|---|---|---|
| RF07 | O sistema deve possuir um "Quadro de Conteúdos a Estudar". | Coberto: rota `/estudos`, com o título "Conteúdos a estudar" e o requisito "Quadro de estudos". |
| RF08 | A usuária deve poder adicionar novos tópicos e gerenciá-los. | Coberto: criar, editar título, descrição e prioridade, e mover entre estados pela caixa, pelo menu ou arrastando. O tópico não tem exclusão, por decisão do proposal: a conclusão fecha o ciclo e um erro de digitação se corrige editando. Gerenciar não foi lido como exigência de excluir. |
| RF09 | Os itens não devem ser excluídos ao serem finalizados, mas sim marcados através de um botão "Concluído" (movendo-os para um histórico ou riscando o texto). | Coberto, com as duas formas: o tópico concluído fica riscado na coluna e vai para o histórico paginado. O controle "Concluído" é uma caixa de marcação, como no `design-ref`, com o nome acessível "Concluído: <título>", e não um botão com esse texto. |
| RF10 | O sistema deve permitir a criação e atribuição de Labels de Prioridade (ex: Alta, Média, Baixa), com possibilidade de edição de cores e nomes das labels. | Coberto: criar, renomear e trocar a cor (paleta fechada), atribuir uma label por tópico, e Alta, Média e Baixa já vêm na migration. Vai além do texto com reordenação e exclusão bloqueada quando a label está em uso. |

Nenhum RF pede algo que ficou de fora, e o risco "RF sem texto no repositório"
do proposal fica resolvido.

## Decisões sobre os achados

- **`pnpm -r test` dependia do `dist/` do shared:** o `vitest.config.mts` do web
  passou a resolver `@raiz/shared` para `packages/shared/src` (task 4.15). Com o
  `dist/` removido, a suíte do web passa.
- **Foco perdido ao mover:** medido antes da correção. Depois de concluir por
  Espaço e depois de mover pelo menu, `document.activeElement` era o `body`. O
  Chrome ainda lembrava a posição para o próximo Tab, mas um segundo Espaço não
  fazia nada, e um leitor de tela perdia o contexto. Corrigido nesta change, e
  não na 06, porque é acessibilidade e não responsividade: o foco fica no mesmo
  controle do cartão que ocupou a posição na coluna de origem, ou na coluna, se
  ela esvaziou, e uma região `aria-live` anuncia o destino. A spec ganhou os
  cenários "Foco depois de concluir pelo teclado" e "Foco quando a coluna
  esvazia" (tasks 4.16 e 4.18).
- **Arrastar entre colunas:** saiu de "Excluído" no proposal e virou requisito,
  como caminho adicional. A caixa e o menu continuam obrigatórios, porque o drag
  and drop nativo não funciona por toque e porque sem eles o quadro dependeria
  de mouse (tasks 4.17 e 4.19).
- **Coluna "Concluídos":** continua mostrando os 5 mais recentes, com acesso ao
  histórico. Recortar pelo mês corrente foi considerado e descartado: o tópico
  concluído em 30/09 sumiria da coluna em 01/10, e um mês cheio voltaria a
  alongar a coluna, que o limite de 5 já impede de crescer.
- **Seed de labels e quadro por status:** não precisaram de mudança. A migration
  já insere Alta, Média e Baixa, testado pelo cenário "Labels iniciais", e a spec
  já descreve três colunas por status, com a prioridade no cartão e estado vazio
  por coluna. O modelo é o enum `status` com `concluido_em`, amarrados pelo
  `CHECK ((status = 'CONCLUIDO') = (concluido_em IS NOT NULL))`. Nunca houve
  estado derivado de `concluidoEm`.
- **E2E frágil:** o `check()` do teste "criar tópico, mover, concluir…" falhava
  de forma intermitente pela mesma remontagem do cartão. Passou a usar `click()`
  e a conferir a caixa do cartão na coluna nova.
- **Verificação na mesma sessão:** aceita pela profissional, porque são
  cenários de CRUD sem dinheiro nem dado clínico. A exigência de agente isolado
  valia para a 03.
