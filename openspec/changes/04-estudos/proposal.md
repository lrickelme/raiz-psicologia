# Proposal: Estudos

## Why

A profissional mantém uma rotina de formação contínua: cursos, artigos,
supervisões e atualizações do CRP. Hoje isso vive em papel ou na memória, e o
módulo de estudos é a única das cinco telas do design que continua como
placeholder (`(app)/estudos/page.tsx`).

Esta change entrega o quadro de estudos com três estados e as labels de
prioridade editáveis. Cobre os RF07 a RF10.

## What Changes

Incluído:

- Tópico de estudo com título, descrição opcional e no máximo uma label de
  prioridade.
- Três estados: `A_ESTUDAR`, `EM_ESTUDO` e `CONCLUIDO`. O tópico pode ir de
  qualquer estado para qualquer outro. Concluir grava a data, e reabrir a limpa.
- A conclusão marca o tópico e não o apaga. Os concluídos ficam riscados na
  coluna e acessíveis num histórico paginado.
- Label de prioridade como entidade própria, com nome, cor e ordem editáveis.
  Alta, Média e Baixa já vêm criadas.
- Cor da label escolhida numa paleta fechada de tokens do Raíz. O banco guarda o
  nome do papel de cor, nunca um hex.
- Exclusão de label em uso é bloqueada. A profissional troca a prioridade dos
  tópicos antes de excluir.
- Quadro em três colunas, conforme o `design-ref`, com as ações sem depender de
  arrastar nem de `hover`.

Excluído:

- Exclusão de tópico. A conclusão é o fim do ciclo, e um erro de digitação se
  corrige editando o tópico. Se o uso mostrar que falta excluir, a exclusão entra
  depois sem mexer no modelo.
- Várias labels por tópico. A label representa prioridade e não é uma etiqueta
  livre.
- Arrastar entre colunas. A mudança de estado é feita por ação explícita, que
  também funciona por toque na change 06. Arrastar pode vir como atalho depois.
- Prazo, lembrete ou recorrência em tópico de estudo. Lembrete é a change 05.
- Anexos e links estruturados.
- Adaptação para celular, que fica para a change 06.

## Abordagem

É a change de menor risco do roadmap: não toca dado de paciente, auditoria nem
criptografia, e depende só do shell visual da 01. O módulo segue o mesmo corte
das anteriores: schema Zod em `packages/shared`, módulo Nest com repositório e
serviço, rota `(app)/estudos` com TanStack Query.

A prioridade de um tópico vem da **ordem** da label, não do nome. Assim,
renomear "Alta" para "Urgente" não muda a ordenação, e criar uma label nova
exige dizer onde ela fica em relação às outras.

A paleta é um enum no contrato, e cada valor aponta para um par de tokens
(fundo e texto) no `@theme`. Trocar a identidade visual depois é mudar o
mapeamento no CSS, sem migrar dados.

## Riscos

- **Dado de paciente fora do prontuário.** O próprio `design-ref` traz o tópico
  "Supervisão clínica — caso Beatriz". Estudos não é criptografado nem auditado,
  então um nome de paciente escrito ali fica em texto claro fora da proteção da
  LGPD que o prontuário tem. Tratamento: o formulário avisa isso de forma
  explícita, como já faz o campo de observações administrativas do paciente. O
  sistema não tenta detectar nomes. O aviso é a medida proporcional para um
  sistema de usuária única.
- **Contraste da label Média.** O `design-ref` põe texto branco sobre âmbar
  sólido, o que dá 3,25:1, abaixo do AA para texto de 10,5px. A paleta usa, para
  o âmbar, o par fundo suave com texto escuro (6,26:1). É a única divergência
  visual deliberada em relação ao design, e o design.md a registra.
- **RF sem texto no repositório.** O SDD com a redação literal dos RF07 a RF10
  não está versionado aqui. O escopo acima vem do ROADMAP e da tela do
  `design-ref`. Antes do apply, vale conferir se algum RF pede algo que ficou de
  fora, como prazo por tópico.
