# Proposal: Fundação — autenticação, pacientes e agenda

## Intent

Nada no Raíz funciona sem três coisas de pé: uma sessão autenticada, um cadastro
de pacientes e uma agenda que associa atendimentos a esses pacientes. O módulo
financeiro deriva da agenda (valor da consulta × atendimentos realizados) e o
prontuário pendura no paciente. Construir essas três capacidades primeiro elimina
o retrabalho de modelar o resto em cima de um alicerce provisório.

Esta change entrega o esqueleto do monorepo, o schema inicial, o shell visual do
app (sidebar + tema Raíz) e os fluxos de CRUD de paciente e de agendamento.

## Scope

Incluído:

- Monorepo `apps/web` + `apps/api`, com Docker Compose para o Postgres local.
- Tokens do guia Raíz extraídos para `tailwind.config` e shell de navegação.
- Login de usuário único com sessão em cookie e expiração por inatividade.
- CRUD de paciente, incluindo valor padrão da consulta e arquivamento.
- Agenda com visualização diária, semanal e mensal; agendar, reagendar, cancelar
  e marcar atendimento como realizado.
- Trilha de auditoria como tabela e ponto de extensão, já gravando eventos de
  autenticação e de acesso a paciente.

Excluído (vira change própria):

- Prontuário e evoluções (`02-prontuario`) — depende da criptografia em coluna.
- Financeiro e dashboard (`03-financeiro`) — depende de atendimentos realizados.
- Estudos e labels de prioridade (`04-estudos`).
- Lembretes (`05-lembretes`).

## Approach

Backend em fatias verticais: migration Flyway, entidade, repositório, serviço,
controller, teste de integração com Testcontainers. Uma capacidade por vez,
começando por auth, porque todo endpoint subsequente assume sessão válida.

Frontend consome a API real desde o primeiro commit. Nenhum dado mockado entra em
`apps/web` — o mockado esconde o custo da integração e sempre cobra juros depois.
O shell visual (sidebar, cabeçalho, tema) é construído a partir de `design-ref/`
antes das telas, para que Pacientes e Agenda já nasçam dentro do layout definitivo.

A agenda usa `Atendimento` como entidade única com um campo `status`, em vez de
separar "agendamento" e "atendimento realizado" em tabelas distintas. Um
atendimento tem um ciclo de vida, não duas identidades.

## Riscos

- **Fuso horário.** Regras de calendário em `America/Sao_Paulo` com armazenamento
  em `timestamptz` é a combinação certa, mas erra fácil no limite do horário. Os
  testes precisam cobrir virada de dia e de semana explicitamente.
- **Fidelidade ao design.** O export do Claude Design é HTML estático; traduzir
  para componentes React sem perder espaçamento e hierarquia exige comparação
  visual, não só leitura de CSS.
- **Auditoria criada tarde.** Ela entra aqui de propósito: retrofitar trilha de
  auditoria depois que o prontuário existe é caro e deixa buraco no histórico.