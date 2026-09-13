# Roadmap de changes — Raíz

Uma change por vez. Cada uma passa por `/opsx:propose` → revisão sua →
`/opsx:apply` → `/opsx:archive`. A ordem abaixo respeita dependências reais;
inverter cria retrabalho.

---

## 01-fundacao — escrita

Auth, pacientes, agenda. Ver `changes/01-fundacao/`.

---

## 02-prontuario

**Depende de:** 01 (paciente e atendimento existirem; auditoria de pé).

Cobre RF05 e RF06 do SDD. É a change de maior risco regulatório e a razão pela
qual a auditoria foi construída antes.

Pontos a fixar no proposal:

- Evolução vinculada ao paciente e, quando houver, ao atendimento que a originou.
- Texto criptografado em repouso com AES-256-GCM, aplicado via Prisma Client
  Extension no `$allOperations` do modelo. Chave fora do banco e fora do
  repositório — variável de ambiente ou cofre.
- Rota de prontuário marcada como dinâmica e sem cache no Next, explicitamente.
- Data e hora automáticas, não editáveis.
- Sem exclusão. Correção gera nova versão com o registro anterior preservado e
  marcado como retificado.
- Exportação do prontuário completo do paciente em PDF.
- Decidir a rotina de backup nesta change, não depois.
- Confirmar na resolução vigente do CFP o prazo mínimo de guarda antes de
  escrever qualquer regra de retenção.

---

## 03-financeiro

**Depende de:** 01 (atendimentos com status e valor congelado).

Cobre RF12 e RF13.

Pontos a fixar:

- Receita realizada é a soma do valor congelado dos atendimentos `REALIZADO` no
  período. Nada de recalcular pelo valor atual do paciente.
- Definir explicitamente se `FALTA` é cobrado. Isso é política da profissional,
  não detalhe técnico — perguntar antes de implementar.
- Receita prevista do mês a partir dos atendimentos `AGENDADO` restantes.
- Comparativo mês a mês e por paciente.
- Gráficos com os tokens do Raíz, não com a paleta default da biblioteca.
- Filtro do dashboard abaixo de dois segundos (RNF03).

---

## 04-estudos

**Depende de:** 01 (apenas do shell visual).

Cobre RF07 a RF10.

Pontos a fixar:

- Conclusão marca, não apaga. Item concluído vai para histórico ou fica riscado.
- Labels de prioridade com nome e cor editáveis, como entidade própria.
- Definir o que acontece ao excluir uma label em uso: bloquear ou desassociar.
- Cores de label restritas a uma paleta compatível com o tema, para não quebrar a
  identidade visual com um roxo néon.

---

## 05-lembretes

**Depende de:** 01 (shell visual).

Cobre RF11. A menor das changes.

Pontos a fixar:

- Criação rápida, sem formulário modal. Painel estilo post-it.
- Aqui a exclusão é permitida: lembrete não é dado clínico.
- Sem notificação por e-mail ou push na v1.

---

## 06-plataforma

**Depende de:** 03 e 04 estarem prontas (todas as telas existirem).

Cobre RNF02 e a instalação como aplicativo. Adiada por decisão consciente, para
que o app inteiro exista antes de ser adaptado a duas larguras.

Rascunho de requisitos já escrito em `openspec/rascunhos/06-plataforma.spec.md`.
Ao abrir a change, usar aquele arquivo como ponto de partida em vez de começar do
zero.

**O que essa decisão custa.** A profissional usará o sistema como aplicativo
instalado na tela de início do iPhone, então o celular não é uso secundário.
Adaptar depois significa retrabalho em três frentes já construídas: shell de
navegação, listagens em formato de tabela e o calendário semanal. O risco é
conhecido e aceito.

**Restrições a respeitar nas changes 01 a 05** para limitar esse custo:

- Sem largura fixa em pixel no shell ou nos containers.
- Nenhuma ação essencial revelada apenas por `hover`.
- Listagem sai de um componente só, para que trocar tabela por card seja mudança
  local e não reescrita de cada tela.

**Pontos a fixar quando a change abrir:**

- Manifest, ícones maskable, `display: standalone`, `theme-color`.
- `viewport-fit=cover` e áreas seguras do iPhone.
- Colapso da visão semanal para diária abaixo de 768px.
- Reagendamento por toque, sem depender de arrastar.
- Alvos tocáveis de no mínimo 44px.
- **Revisar o modelo de sessão.** A expiração de 30 minutos por inatividade
  definida em `auth` torna o app instalado inutilizável: reabrir cinco vezes ao
  dia exigiria digitar a senha cinco vezes, e o resultado previsível é uma senha
  curta. A correção é separar inatividade em primeiro plano, que continua em 30
  minutos e protege a tela esquecida aberta no consultório, de validade absoluta
  do cookie, em torno de 7 dias. Esse é o item de maior retrabalho da change 06 —
  se em algum momento você quiser antecipar só uma coisa daqui, antecipe essa.