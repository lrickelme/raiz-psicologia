# Design: Financeiro

## Modelo de dados

`Atendimento` ganha três campos. Nenhuma tabela nova.

```
Atendimento  ...campos existentes...
             cobravel            Boolean?    -- null enquanto AGENDADO
             cobrancaDispensada  Boolean     @default(false)
             motivoDispensa      String?     (criptografado)
```

`cobravel` é anulável de propósito: `null` significa "atendimento ainda aberto",
distinto de `false`, que significa "encerrado e não cobrável". Um booleano não
anulável com `false` como padrão colapsaria os dois estados e faria atendimento
agendado parecer decidido.

`motivoDispensa` passa pela coluna criptografada da 01. O motivo de uma dispensa
frequentemente é clínico ou pessoal — "paciente em luto" — e não tem por que
receber proteção menor que o motivo de cancelamento.

Índice para as agregações:

```sql
CREATE INDEX atendimento_receita_idx
  ON atendimento (inicio)
  WHERE cobravel = true AND cobranca_dispensada = false;
```

Índice parcial porque a consulta de receita sempre filtra por esses dois
predicados. O índice fica pequeno e serve exatamente ao caminho quente.

## Decisões

### Cobrabilidade decidida no serviço, gravada no encerramento

A regra vive em função pura em `comum/cobranca/`, que recebe o início do
atendimento, o instante do encerramento e o status resultante, e devolve
`boolean`. O serviço de atendimento a chama em cada transição de encerramento e
persiste o resultado.

Alternativa descartada: coluna gerada ou `VIEW` calculando a cobrabilidade a
partir das datas. Funcionaria hoje e quebraria no dia em que a regra mudasse —
todos os meses anteriores seriam reapurados com a regra nova. Receita de mês
fechado que muda sozinha é o pior defeito possível neste módulo.

### Dia de calendário, não horas de antecedência

A regra é: cobrável se `data(encerramento) == data(inicio)` em
`America/Sao_Paulo`. Comparação de datas locais, não de diferença em horas.

Isso importa para a implementação: converter os dois instantes para data local
com `date-fns-tz` e comparar as datas, nunca subtrair timestamps e olhar se a
diferença é menor que 24h. As duas coisas divergem, e a spec descreve a primeira.

O fuso passa a ser load-bearing para uma regra de negócio, não só para exibição.
O projeto fixa `America/Sao_Paulo`; a profissional está em Recife. Hoje isso é
inócuo — o Brasil não adota horário de verão desde 2019 e os dois são UTC−03:00
o ano inteiro — mas se o horário de verão voltar, São Paulo passa a divergir de
Recife e a virada do dia sai errada. Registrado aqui para que, se isso acontecer,
o lugar a corrigir seja óbvio.

### Dispensa não apaga a cobrabilidade

`cobravel` continua `true` e `cobrancaDispensada` marca a exclusão do total. Dois
campos em vez de um porque a pergunta "por que o mês fechou abaixo do esperado?"
precisa de resposta, e um único booleano rebaixado a `false` apagaria a distinção
entre "não era cobrável" e "era, mas eu dispensei".

### Agregação em SQL

Os totais saem de `groupBy` do Prisma ou de `$queryRaw` com `SUM`, conforme a
forma do resultado. Nunca de `findMany` seguido de `reduce`.

Com dois anos e umas mil linhas, `reduce` em memória ainda passaria no RNF03 —
e é justamente por isso que a regra entra agora, enquanto a diferença é
invisível. Reescrever agregação depois que a interface já consome o formato é
mais caro.

`Prisma.Decimal` na soma, como em toda a aplicação. `SUM` sobre `numeric` no
Postgres devolve `numeric`; a conversão para `number` em qualquer ponto do
caminho reintroduz o erro de ponto flutuante que o projeto evita desde a 01.

### Um endpoint por pergunta

Não existe um `/financeiro/resumo` devolvendo tudo. O dashboard tem quatro
painéis com granularidades diferentes, e um endpoint único obrigaria a recalcular
os quatro a cada mudança de filtro que afeta um só. Quatro endpoints, quatro
chaves de cache no TanStack Query.

## Arquitetura

```
apps/api/src/
├── financeiro/     controller, service, repository (agregações)
└── comum/
    └── cobranca/   função pura de cobrabilidade
```

`financeiro` lê de `atendimento` por repositório próprio, com suas próprias
consultas agregadas. Não importa o serviço de `atendimento`: as duas capacidades
têm perguntas diferentes sobre a mesma tabela, e acoplar as duas faria o
financeiro carregar regras de ciclo de vida que não usa.

A decisão de cobrabilidade é o inverso: vive em `comum/cobranca/` e é chamada por
`atendimento`, porque quem encerra é quem grava.

## Endpoints

```
GET /api/v1/financeiro/receita            ?de=&ate=     -> realizada e prevista
GET /api/v1/financeiro/mensal             ?meses=12     -> série mensal
GET /api/v1/financeiro/por-paciente       ?de=&ate=
POST /api/v1/atendimentos/:id/dispensar-cobranca        { motivo }
POST /api/v1/atendimentos/:id/reverter-dispensa
```

Intervalo obrigatório em `receita` e `por-paciente`, como em `atendimentos`.

## Frontend

```
apps/web/src/
├── app/(app)/financeiro/page.tsx
└── features/financeiro/
```

Client Component com TanStack Query: o filtro de período é interativo e refaz as
quatro consultas.

Gráficos com Recharts, cores vindas das CSS custom properties do `@theme` lidas
em runtime, não hex repetidos no JSX. Barras para a série mensal, barras
horizontais para receita por paciente. Cada gráfico acompanha rótulo ou tabela
com os valores — cor sozinha não carrega significado, e a série mensal tem
leitura de texto disponível para quem precisar do número exato.

Formatação monetária por `Intl.NumberFormat('pt-BR', { style: 'currency',
currency: 'BRL' })`, a partir da string que a API devolve.

## Testes

Obrigatórios, porque concentram o risco:

- Cancelamento no dia anterior, no dia e após o horário.
- Composição da receita com os cinco status na mesma apuração.
- Receita de mês fechado inalterada após reajuste do valor do paciente.
- Receita de mês fechado inalterada após mudança da regra de cobrança.
- Dispensa e reversão refletidas no total.
- Virada do dia com `TZ` do processo diferente de São Paulo.
- Dois anos de atendimentos, apuração abaixo de dois segundos.