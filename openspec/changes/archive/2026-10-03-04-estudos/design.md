# Design: Estudos

## Modelo de dados

Duas tabelas novas. Nenhuma tabela existente é alterada.

```
enum StatusTopico   A_ESTUDAR | EM_ESTUDO | CONCLUIDO
enum CorLabel       VINHO | AMBAR | MUSGO | MUSGO_SUAVE | MARROM | BEGE

LabelPrioridade  id          uuid v7
                 nome        String
                 cor         CorLabel
                 ordem       Int
                 criadoEm    timestamptz
                 atualizadoEm timestamptz

TopicoEstudo     id          uuid v7
                 titulo      String
                 descricao   String?
                 labelId     uuid?   -> LabelPrioridade  onDelete: Restrict
                 status      StatusTopico  @default(A_ESTUDAR)
                 concluidoEm timestamptz?
                 criadoEm    timestamptz
                 atualizadoEm timestamptz
```

Constraints que o Prisma não modela ficam na migration, como nas changes
anteriores:

```sql
ALTER TABLE topico_estudo ADD CONSTRAINT topico_conclusao_coerente
  CHECK ((status = 'CONCLUIDO') = (concluido_em IS NOT NULL));

CREATE UNIQUE INDEX label_prioridade_nome_unico
  ON label_prioridade (raiz_normalizar(nome));

CREATE INDEX topico_estudo_status_idx ON topico_estudo (status);
CREATE INDEX topico_estudo_concluidos_idx
  ON topico_estudo (concluido_em DESC) WHERE status = 'CONCLUIDO';
```

`raiz_normalizar` é a função imutável (`lower` + `unaccent`) criada pela
migration de `paciente`. Ela é reaproveitada aqui, sem criar outra.

A mesma migration insere as três labels iniciais: Alta/VINHO/1, Média/AMBAR/2 e
Baixa/MUSGO/3. Isso fica na migration, e não no `seed.ts`, porque o seed só
provisiona credencial e não roda em produção a cada deploy. Label inicial é
dado de referência, e o sistema precisa dela instalado de qualquer jeito.

## Decisões

### Sem auditoria e sem criptografia

A trilha de auditoria cobre autenticação e dado de paciente (spec auth). Tópico
de estudo não é nenhum dos dois, então os controllers novos não recebem
`@Auditado`, e nenhuma coluna passa pela extensão de criptografia.

O risco de a profissional escrever nome de paciente num tópico é tratado na
interface, com um aviso fixo no formulário igual ao de observações
administrativas. Cifrar o módulo inteiro por precaução traria custo, a leitura
auditada de cada cartão do quadro, para proteger algo que a regra de uso já
proíbe.

### Prioridade é a ordem da label

`ordem` é um inteiro de 1 a n, sem buracos, e sem `UNIQUE` no banco. A
reordenação vem inteira: `PUT /labels/ordem` recebe a lista completa de ids na
nova ordem e reescreve de 1 a n numa transação. A lista precisa ser exatamente o
conjunto atual de labels, ou a resposta é `409`. Uma lista desatualizada (label
criada ou excluída em outra aba) não pode produzir ordem parcial.

Alternativa descartada: `UNIQUE (ordem)` com `DEFERRABLE`. Funciona, mas o
contrato de lista completa já impede duplicata, e o Prisma não expressa
constraint diferível. Sairia SQL cru no repositório para proteger um caso que o
contrato não deixa acontecer.

Criar label põe `ordem = max + 1`. Excluir renumera as seguintes na mesma
transação, para manter a sequência sem buracos.

### Exclusão bloqueada pelo banco, explicada pelo serviço

A FK `topico_estudo.label_id` é `ON DELETE RESTRICT`. O serviço conta os
tópicos antes, para montar a resposta `409` com a quantidade. A garantia contra
corrida (o cenário "Corrida com associação") vem da FK: se a contagem deu zero e
um tópico foi associado nesse meio-tempo, o `DELETE` falha com `P2003`, e o
serviço traduz isso para o mesmo `409`.

### Transição de estado

`POST /topicos/:id/mover` com `{ status }`. A regra vive no serviço:

- destino `CONCLUIDO` vindo de outro estado: `concluidoEm = now()` do servidor;
- destino diferente de `CONCLUIDO`: `concluidoEm = null`;
- destino igual ao atual: nada muda, e a resposta é `200` com o tópico.

O schema Zod da transição aceita só `status`. Um `concluidoEm` enviado no
corpo é descartado pelo `strip` padrão do Zod, e é isso que o cenário "Instante
definido pelo servidor" verifica. O `CHECK` do banco é a rede de segurança caso
algum caminho futuro grave estado sem passar pelo serviço.

A edição (`PATCH /topicos/:id`) muda só título, descrição e label. Status não
entra no PATCH, para que exista um único caminho de transição.

### Contagem do mês no fuso local

"Concluídos este mês" usa `inicioDoMes` e `fimDoMes` de `@raiz/shared/calendario`,
que já resolvem `America/Sao_Paulo`, e não `date_trunc` no fuso da sessão do
Postgres.

### Paleta: enum no contrato, par de tokens no CSS

`CorLabel` é um `z.enum` em `packages/shared/src/estudos.ts` e um enum do
Prisma. O mapeamento para cor fica só no front, num objeto
`papel → { fundo, texto }` que aponta para classes do `@theme`:

| Papel | Fundo | Texto | Contraste |
|---|---|---|---|
| `VINHO` | `raiz-vinho` | branco | 9,24 |
| `AMBAR` | `raiz-ambar-suave` | `raiz-ambar-escuro` | 6,26 |
| `MUSGO` | `raiz-musgo` | branco | 5,50 |
| `MUSGO_SUAVE` | `raiz-musgo-suave` | `raiz-musgo-escuro` | 7,79 |
| `MARROM` | `raiz-marrom` | branco | 11,76 |
| `BEGE` | `raiz-bege` | `raiz-marrom` | 8,25 |

"Branco" é o `#fff` que o design-ref usa nos pills. Se não houver token para
ele, entra no `@theme` como `--color-raiz-sobre-pill` e não como hex no JSX.

**Divergência deliberada do design-ref:** lá o pill "Média" é âmbar sólido com
texto branco (3,25:1, reprovado no AA para 10,5px). Aqui ele usa o par suave. Os
candidatos `FOLHA` (4,25:1 com branco) e `texto-terciário` (4,12:1) ficaram fora
da paleta pelo mesmo motivo.

Um teste unitário calcula o contraste de cada par lendo os valores do
`globals.css`. Assim, mudar um token que derrube um par abaixo de 4,5:1 quebra o
build, e não a acessibilidade em produção.

## API

Todas sob `/api/v1`. Os erros seguem o `ProblemDetailsFilter` existente.

| Método | Rota | Resposta |
|---|---|---|
| `GET` | `/estudos/quadro` | colunas pendentes completas, 5 concluídos recentes, contagens |
| `GET` | `/topicos/concluidos?pagina=` | página de concluídos (máx. 50) |
| `POST` | `/topicos` | `201` tópico |
| `PATCH` | `/topicos/:id` | tópico |
| `POST` | `/topicos/:id/mover` | tópico |
| `GET` | `/labels` | labels em ordem, com `emUso: number` |
| `POST` | `/labels` | `201` label |
| `PATCH` | `/labels/:id` | label |
| `PUT` | `/labels/ordem` | labels em ordem |
| `DELETE` | `/labels/:id` | `204`, ou `409` com `topicos: n` |

O quadro vem num só endpoint porque as três colunas e os contadores são sempre
exibidos juntos. As colunas pendentes não são paginadas: o volume esperado é de
dezenas de tópicos. Isso está registrado como premissa, e não como limite do
sistema.

A ordenação das colunas pendentes é feita no SQL: `ORDER BY label.ordem ASC
NULLS LAST, topico.criado_em ASC`.

`labelId` inexistente na criação ou edição de tópico responde `422` apontando o
campo. O serviço verifica antes, e a violação de FK (`P2003`) é traduzida da
mesma forma, para cobrir corrida com exclusão.

## Frontend

- `(app)/estudos/page.tsx` troca o placeholder pelo quadro, que é um Client
  Component com TanStack Query, como a agenda.
- `features/estudos/`: `quadro.tsx`, `coluna.tsx`, `cartao-topico.tsx`,
  `modal-topico.tsx`, `historico-concluidos.tsx`, `gestao-labels.tsx`,
  `pill-label.tsx`, `cores-label.ts` e `consultas.ts`.
- O cartão tem a caixa de conclusão, como no design, e um botão de ações
  ("Mover para…", "Editar"). Não há ação só em `hover`. As colunas são uma lista
  de cartões gerada por um componente só: na change 06 viram abas ou pilha sem
  reescrever o cartão.
- Arrastar entre colunas usa o drag and drop nativo do HTML, sem biblioteca. O
  cartão é `draggable`, e cada coluna é um alvo que aceita só o tipo de dado do
  tópico. Soltar chama a mesma mutação do menu, então as regras de status, a
  atualização otimista e o rollback são os mesmos. Soltar na própria coluna ou
  fora de uma coluna não faz requisição. O drag and drop nativo não funciona por
  toque, e é por isso que o menu continua obrigatório: é o caminho da change 06.
- Mudar de coluna desmonta o cartão e monta outro na coluna nova, e o foco do
  teclado iria para o `body`. Antes de mover pelo cartão, o quadro guarda a
  coluna de origem, a posição e o controle usado (caixa ou menu). Depois da
  renderização, foca o mesmo controle do cartão que ficou naquela posição (ou no
  último da coluna). Se a coluna esvaziou, foca a própria coluna, que tem
  `tabIndex=-1`. O foco fica na coluna de origem, e não segue o cartão, porque o
  uso típico é concluir vários itens da mesma coluna em sequência. Uma região
  `aria-live` anuncia para onde o cartão foi.
- Mudar estado é otimista no cache do TanStack Query, com rollback em erro. É o
  gesto mais frequente da tela e não pode esperar a ida e volta.
- O histórico reaproveita `features/pacientes/paginacao.tsx`.
- A gestão de labels abre em modal a partir do botão "Gerenciar labels". A
  reordenação usa botões subir/descer, acessíveis por teclado e por toque.
- Na tentativa de exclusão, a interface já usa `emUso` para avisar antes. O
  `409` do servidor continua sendo tratado, porque o aviso pode estar
  desatualizado.

## Riscos e premissas

- **Coluna pendente sem paginação.** Se passar de algumas centenas de itens, o
  quadro fica pesado. A premissa é aceitável para uso individual. O sinal para
  revisar é o tempo do `GET /estudos/quadro` nos testes de integração.
- **Texto clínico por descuido.** Mitigado só pelo aviso na interface (ver
  proposal).
