# Verificação dos cenários (task 5.1)

Feita em 27/09/2026 por um agente que não participou da implementação, como
caixa-preta: recebeu só as duas delta specs e o sistema rodando num ambiente
descartável (Postgres em container, API compilada, Next em build de produção).
Não leu código, design, tasks nem histórico. Relógio dos testes: 27/09/2026,
21h32–21h52 em São Paulo — já 28/09 em UTC, o que exercitou a regra de fuso nos
cenários de cancelamento.

**Resultado:** 34 cenários — 28 correspondem, 2 correspondem parcialmente, 4 não
verificáveis como caixa-preta. Nenhum falhou na lógica de negócio.

## Spec agenda

| Requisito | Cenário | Veredito | Evidência |
|---|---|---|---|
| Cobrabilidade congelada | Cancelamento em dia anterior | Corresponde | Segunda 28/09 09h cancelada domingo 27/09 21h33 SP (28/09 em UTC): `cobravel:false`. |
| Cobrabilidade congelada | Cancelamento no dia da consulta | Corresponde | 27/09 23h cancelado às 21h33 do mesmo dia: `cobravel:true`. |
| Cobrabilidade congelada | Cancelamento após o horário | Corresponde | 27/09 10h cancelado às 21h33: `cobravel:true`. |
| Cobrabilidade congelada | Remarcação no dia | Corresponde | Original `REMARCADO`, `cobravel:false`; novo `AGENDADO`, `cobravel:null`. |
| Cobrabilidade congelada | Falta | Corresponde | `FALTA`, `cobravel:true`. |
| Cobrabilidade congelada | Regra alterada depois | Não verificável | Exige nova versão do sistema. Mais próximo: a receita lê o valor gravado (alterar `cobravel` no banco mudou a receita), não recalcula pela regra. Coberto pelo teste de API que troca a regra. |
| Cobrabilidade congelada | Encerrado sem cobrabilidade definida | Corresponde | REALIZADO com `cobravel=NULL` montado no banco: receita do mês caiu de 400 para 0. |
| Cobrabilidade congelada | Atendimento ainda aberto | Corresponde | `AGENDADO` com `cobravel:null`, fora da realizada. |
| Dispensa de cobrança | Dispensar | Corresponde | Realizada 600 → 450; histórico com "Cobrável, com cobrança dispensada: paciente em luto". |
| Dispensa de cobrança | Dispensa sem motivo | Corresponde | 422 apontando `motivo`; nada mudou no banco. |
| Dispensa de cobrança | Ação alcançável do histórico e da agenda | Corresponde | Ação nos dois lugares, com valor congelado e razão da cobrabilidade; dispensado mostra motivo e "Reverter dispensa"; ausente em não cobráveis. Fluxo real pela tela. |
| Dispensa de cobrança | Dispensar o que não é cobrável | Corresponde | 409 para não cobrável e para `AGENDADO`. |
| Dispensa de cobrança | Reverter a dispensa | Corresponde | Realizada 450 → 600; trilha com as duas escritas. |
| Dispensa de cobrança | Reverter preserva o motivo | Corresponde | Motivo preservado e cifrado; nenhum registro da trilha contém o texto. |
| Ciclo de vida | Conclusão | Corresponde | `REALIZADO`, `cobravel:true`, entra na realizada. |
| Ciclo de vida | Conclusão antecipada | Corresponde | 422. |
| Ciclo de vida | Cancelamento | Corresponde | Motivo cifrado e no histórico; horário liberado (201 no mesmo slot, 409 no controle). |
| Ciclo de vida | Falta | Corresponde | Motivo gravado; realizada +150. |
| Ciclo de vida | Encerramento sem motivo | Corresponde | 422 em `motivo` nas três ações; status intacto. |

## Spec financeiro

| Requisito | Cenário | Veredito | Evidência |
|---|---|---|---|
| Receita realizada | Composição da receita | Corresponde | Cinco status em março/2026: `600.00`. |
| Receita realizada | Reajuste não altera o passado | Corresponde | Reajuste 150 → 200: março segue 600,00. |
| Receita realizada | Cobrança dispensada | Corresponde | 600 → 450. |
| Receita realizada | Mês sem atendimento | Corresponde | `0.00`; painéis com estado vazio, sem gráfico vazio. |
| Receita prevista | Previsão do mês corrente | Corresponde | R$ 450,00 em cartão separado da realizada. |
| Receita prevista | Encerrado sai da previsão | Corresponde | Prevista 600 → 450; realizada +150. |
| Receita prevista | Horário terminado sai da previsão | Corresponde | Ao terminar, prevista −150 e pendentes +1. |
| Receita prevista | Previsão não é projeção | Corresponde | Outubro: prevista "—" apesar de `AGENDADO`; série termina no mês corrente. |
| Pendentes de encerramento | Pendência visível | Corresponde | "R$ 300,00 · 2 atendimentos…", fora de prevista e realizada. |
| Pendentes de encerramento | Pendência de mês anterior | Corresponde | Agosto: pendentes 1, prevista `null`. |
| Pendentes de encerramento | Encerramento resolve a pendência | Corresponde | Pendentes −1 e realizada +150 a cada encerramento. |
| Comparativo entre meses | Série mensal | Corresponde | 12 meses em ordem, zeros preservados. |
| Comparativo entre meses | Filtro ativo | Corresponde | Título, aviso, faixa rotulada e marcação na tabela. |
| Comparativo entre meses | Histórico curto | Corresponde | Só a partir do primeiro mês com atendimento. |
| Receita por paciente | Composição por paciente | Corresponde | 600,00 com 3 realizadas, 1 falta, 2 remarcadas sem somar. |
| Receita por paciente | Paciente arquivado no período | Corresponde | Na lista, com selo "Arquivado". |
| Receita por paciente | Consulta registrada na trilha | Corresponde | LEITURA/PACIENTE com os ids; nada para `receita` e `mensal`. |
| Dashboard financeiro | Filtro por período | Corresponde | Troca de filtro em 60–93 ms, também com ~14 mil atendimentos. |
| Dashboard financeiro | Valores monetários | Parcial | Cartões, tabelas e ranking corretos; rótulos do eixo Y abreviados ("R$ 20 mil"). |
| Dashboard financeiro | Estado vazio | Corresponde | Cada painel do período indica ausência de dados. |
| Cálculo agregado no banco | Volume de dois anos | Parcial | ~14 mil atendimentos: dashboard em ~0,8 s; tráfego do Postgres estável (~6,2 KB por rodada, contra ~100 KB listando um mês). Medida indireta: não vê contagem de linhas. |

Não verificáveis também: o backfill (migração já aplicada, sem atendimentos
antigos no ambiente) e a ausência de soma em memória, além da medida indireta.

## Fora dos cenários

1. Três `<text>` dos gráficos com `fill="#808080"`, sobreposto por estilo — a cor
   renderizada era token, mas o atributo não.
2. Aviso de "não segue o filtro" ausente na visão padrão (mês corrente) —
   ambíguo quanto ao que conta como filtro ativo.
3. Anotado pelo agente como efeito da própria carga: listagens de atendimento
   respondendo 500 em períodos com motivos gravados fora do formato cifrado.

## Decisões sobre os achados

- **Valores monetários:** a spec estava mal escrita. Rótulo de eixo é escala,
  não quantia. O requisito passou a valer para o que se lê como quantia (cartões,
  tabelas, tooltip, ranking), e rótulos de escala MAY abreviar. Novo cenário
  "Escala do gráfico mensal"; a interface não mudou.
- **Volume de dois anos:** aceito. A contagem de linhas é coberta pelo teste de
  carga da API (task 3.12).
- **`#808080`:** era o padrão do `Text` do Recharts nos rótulos do ranking, que
  recebiam a cor só por `style`. Passou a ir por prop; o e2e afirma que nenhum
  `fill="#808080"` sobra nos gráficos.
- **Aviso na visão padrão:** mantido só com filtro ativo. O mês corrente é o
  estado padrão, e o título "Últimos 12 meses" já distingue o painel.
- **Os 500:** investigados, não descartados. Confirmado: `decifrar` lança diante
  de valor fora do formato, e uma linha ilegível derruba a listagem inteira —
  inclusive a grade da agenda, que nem exibe `motivo` — sem registrar nada em
  log. É o modo de falha de um restore parcial ou de rotação de chave.
  Registrado no ROADMAP como candidato a change própria, ao lado da 06.
- **Imagem do Postgres** (notado ao investigar): os testes rodavam em
  `postgres:16-alpine` e o `docker-compose.yml` usa `postgres:16`. As duas
  declaram `en_US.utf8`, mas a alpine (musl) ordena por byte — maiúsculas antes,
  acentuadas no fim. Os testes passaram a usar a imagem do compose.
