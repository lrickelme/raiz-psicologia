# Design: Financeiro

## Modelo de dados

`Atendimento` ganha quatro campos. Nenhuma tabela nova.

```
Atendimento  ...campos existentes...
             encerradoEm         DateTime?   -- instante da transição de encerramento
             cobravel            Boolean?    -- null enquanto AGENDADO
             cobrancaDispensada  Boolean     @default(false)
             motivoDispensa      String?     (criptografado)
```

`encerradoEm` é gravado no mesmo `UPDATE` que muda o status. Uma constraint
garante que atendimento `AGENDADO` não tem `encerradoEm` nem `cobravel`.

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

### Instante do encerramento no próprio atendimento

A regra de `CANCELADO` depende do instante do cancelamento, e até aqui ele não
tinha lugar próprio. `atualizadoEm` não serve: qualquer alteração posterior o
sobrescreve. A trilha de auditoria registra a transição, mas é gravada pelo
interceptor depois de a transação confirmar — se essa escrita falhar, o status
já mudou e o registro não existe. Consultar a trilha também acoplaria a
cobrabilidade a uma tabela que existe para outra finalidade.

`encerradoEm` resolve os dois: é gravado atomicamente com o status e deixa a
cobrabilidade conferível a partir do próprio atendimento — dado o início, o
status e o instante do encerramento, qualquer um refaz a conta.

### Backfill a partir da trilha de auditoria

Os atendimentos encerrados antes desta change recebem `encerradoEm` e
`cobravel` de uma migration de dados que lê o instante da transição na trilha
(`ESCRITA` em `ATENDIMENTO` com rota de encerramento, ou o cancelamento por
arquivamento do paciente). A regra é aplicada à data desse instante.

Sem registro na trilha, nada é inventado. `REALIZADO`, `FALTA` e `REMARCADO`
não dependem da data: `cobravel` vem do status e `encerradoEm` fica nulo.
`CANCELADO` depende: fica com `cobravel` nulo, sem valor presumido, e a
migration o lista num `NOTICE` para diagnóstico.

Aplicado o backfill, nenhum registro ficou indefinido: a contagem de
atendimentos encerrados com `cobravel` nulo foi zero (conferida em 27/09/2026),
porque todo encerramento anterior tinha a transição na trilha. Por isso não há
tela de decisão — ela serviria a um estado inalcançável. O que a spec mantém é
uma propriedade defensiva, não uma pendência: atendimento encerrado sem
cobrabilidade definida fica fora da receita realizada, porque só existiria por
defeito, e aí apuração incompleta é melhor que apuração errada. A consulta de
receita já filtra `cobravel = true`, então o nulo nunca soma.

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

Reverter a dispensa só volta `cobrancaDispensada` a `false`. `motivoDispensa`
fica na coluna cifrada como motivo da última dispensa: limpar seria edição
destrutiva, padrão que o projeto recusa em evolução, remarcação e arquivamento.
A trilha registra a dispensa e a reversão pela rota, sem o texto — `detalhe` é
JSON sem criptografia.

### Previsão e pendência

`AGENDADO` se divide pelo término em relação a agora. Ainda por terminar, no mês
corrente, é receita prevista. Já terminado é pendente de encerramento, em
qualquer mês do período, com contagem e soma próprias. Os dois compõem a
expectativa de recebimento, mas somar o pendente à previsão esconderia uma
pilha de atendimentos não encerrados — erro operacional que precisa aparecer.

### Auditoria do financeiro

Só `por-paciente` entra na trilha: devolve nomes, e a spec de auth exige
registro de todo acesso a dado de paciente. Os ids vêm de `paciente.id` de cada
linha, por um extrator passado a `@Auditado`. `receita` e `mensal` são
agregados sem identidade e não são auditados.

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

Não existe um `/financeiro/resumo` devolvendo tudo. O dashboard responde a três
perguntas com granularidades diferentes — quanto no período (realizada,
prevista e pendentes, na mesma consulta), como os meses se comparam, quanto por
paciente — e um endpoint único obrigaria a recalcular tudo a cada mudança que
afeta uma só. Três endpoints, três chaves de cache no TanStack Query.

A série mensal não segue o filtro de período: é sempre os doze meses até o
corrente. Ela é o contexto contra o qual o período filtrado é lido, não um
recorte dele — filtrar um trimestre e ver só três barras apagaria justamente a
comparação que o painel existe para dar.

Painel que não reage ao filtro lê como defeito, então ele declara isso: título
"Últimos 12 meses" e, com filtro ativo, uma linha discreta dizendo que o painel
mostra a série completa. Para mostrar onde o recorte incide, um `ReferenceArea`
do Recharts sombreia os meses que o período alcança — inclusive os alcançados
em parte — com rótulo de texto, para que a marcação não dependa só de cor. Se o
período não alcança nenhum dos doze meses, não há faixa; o aviso basta.

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
GET /api/v1/financeiro/receita            ?de=&ate=     -> realizada, prevista e pendentes
GET /api/v1/financeiro/mensal             ?meses=12     -> série mensal
GET /api/v1/financeiro/por-paciente       ?de=&ate=
GET  /api/v1/atendimentos/:id                           -> um atendimento, com os motivos
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
consultas de receita e por paciente; a série mensal não depende dele.

O "Dashboard financeiro" da spec é a rota `/financeiro`, e só ela. A tela
inicial não ganha resumo financeiro, por decisão: ela é aberta no consultório
com paciente na sala, e a receita do mês em destaque ali ficaria à vista de
quem estiver presente. Número financeiro aparece quando a profissional o
procura, na rota própria — não é omissão.

Gráficos com Recharts, cores vindas das CSS custom properties do `@theme` lidas
em runtime, não hex repetidos no JSX. Barras para a série mensal: doze pontos é
o caso em que o gráfico ganha da tabela. Cada gráfico acompanha rótulo ou tabela
com os valores — cor sozinha não carrega significado, e a série mensal tem
leitura de texto disponível para quem precisar do número exato.

Receita por paciente é tabela, não gráfico: com quarenta pacientes, a
profissional quer o número de cada um, não a comparação visual entre quarenta
barras. Ordenada por valor — a ordem que a API já devolve —, paginada no
cliente, com uma coluna por status. A paginação é no cliente porque a resposta
tem uma linha por paciente com atendimento no período: é limitada pelo número
de pacientes, não pelo histórico, e paginar no servidor multiplicaria
requisições sem ganho.

A tabela é dado tabular por natureza — contagens e totais comparados por
coluna —, então usa `<table>` com `<th scope>`, como pede a convenção de listas
em project.md. Ela sai de um componente único que recebe as linhas prontas; a
change 06 a adapta renderizando cards a partir dos mesmos dados, sem reescrever
a marcação da visão ampla.

O gráfico que acompanha a tabela mostra só as dez maiores e uma barra "outros".
O `number` que o Recharts exige serve só à geometria das barras; os rótulos saem
das strings da API, e o total de "outros" é somado em centavos inteiros
(`BigInt` a partir da string), nunca em ponto flutuante.

Dispensar e reverter vivem num componente único, `features/cobranca/`: o
histórico do paciente o abre num modal, e o detalhe da agenda o mostra como um
dos modos do modal do atendimento. A grade da agenda não carrega o motivo da
dispensa — só o histórico e as respostas que o gravam trazem motivos —, então o
componente o busca em `GET /atendimentos/:id`, auditado como os demais acessos a
atendimento, em vez de carregar o histórico inteiro do paciente.

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