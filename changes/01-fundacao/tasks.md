# Tasks

## 1. Esqueleto do projeto

- [ ] 1.1 Monorepo pnpm com `apps/web` (Next.js 16, App Router, TS), `apps/api` (NestJS 11 + Fastify) e `packages/shared`
- [ ] 1.2 `docker-compose.yml` com Postgres 16 e volume nomeado
- [ ] 1.3 Prisma inicializado e migration vazia validada contra o container
- [ ] 1.4 Migration habilitando `btree_gist`
- [ ] 1.5 Filtro global de exceção em RFC 7807 e `ZodValidationPipe` em `comum/`
- [ ] 1.6 Route handler `app/api/[...path]/route.ts` repassando para o Nest com o cookie
- [ ] 1.7 Script único que sobe banco, api e web
- [ ] 1.8 Fixar `@nestjs/*` em 11.x no `package.json` e registrar o motivo no README

## 2. Tema e shell visual

- [ ] 2.1 Extrair tokens de cor, tipografia e espaçamento de `design-ref/` para `tailwind.config`
- [ ] 2.2 Primitivos em `components/ui/`: botão, campo, card, badge de status, modal
- [ ] 2.3 Layout `(app)/layout.tsx` com sidebar, cabeçalho e área de conteúdo, fiel ao guia Raíz
- [ ] 2.4 Rotas com placeholders para Dashboard, Agenda, Pacientes, Estudos, Lembretes, Financeiro
- [ ] 2.5 Comparar shell renderizado contra `design-ref/` e corrigir desvios de espaçamento

## 3. Autenticação

- [ ] 3.1 Modelos `Usuario` e `Sessao` no Prisma e provisionamento da credencial única via seed
- [ ] 3.2 Hash Argon2id com `@node-rs/argon2` e verificação de resposta indistinguível
- [ ] 3.3 Sessão em tabela e cookie `HttpOnly` + `Secure` + `SameSite=Strict`
- [ ] 3.4 `AuthGuard` global com decorator `@Publico()` para login e health
- [ ] 3.5 Expiração por inatividade de 30 minutos com renovação a cada requisição
- [ ] 3.6 Rate limit de cinco tentativas por IP em cinco minutos no endpoint de login
- [ ] 3.7 Middleware do Next redirecionando rota `(app)` sem sessão para o login
- [ ] 3.8 Tela de login com o tema Raíz
- [ ] 3.9 Aviso de expiração próxima com opção de continuar conectada
- [ ] 3.10 Teste de integração: login válido, senha errada, sessão expirada, `429`

## 4. Auditoria

- [ ] 4.1 Modelo `Auditoria` com campo `Json` para detalhe
- [ ] 4.2 Revogar `UPDATE` e `DELETE` na tabela para o usuário de aplicação do Postgres
- [ ] 4.3 `AuditoriaInterceptor` global gravando acessos a paciente e atendimento
- [ ] 4.4 Eventos `LOGIN_SUCESSO` e `LOGIN_FALHA`
- [ ] 4.5 Teste confirmando que alteração de registro de auditoria falha

## 5. Pacientes

- [ ] 5.1 Modelo `Paciente` com índice para busca sem acento (`unaccent` + `pg_trgm`)
- [ ] 5.2 Schemas Zod de paciente em `packages/shared`
- [ ] 5.3 CRUD, arquivamento e reativação conforme a spec
- [ ] 5.4 Listagem paginada com busca e filtro de status, teto de 50 por página
- [ ] 5.5 Cancelamento de atendimentos futuros ao arquivar, com confirmação
- [ ] 5.6 Serialização de `Decimal` como string na fronteira da API
- [ ] 5.7 Tela de listagem com busca
- [ ] 5.8 Formulário de criação e edição com `react-hook-form` + resolver Zod compartilhado
- [ ] 5.9 Perfil do paciente com dados cadastrais e área de histórico
- [ ] 5.10 Aviso de homônimo antes de confirmar cadastro
- [ ] 5.11 Teste de integração: cadastro mínimo, valor inválido, arquivar com agenda futura

## 6. Agenda

- [ ] 6.1 Modelo `Atendimento` e migration SQL manual com a constraint `EXCLUDE`
- [ ] 6.2 Repositório com consulta por intervalo, intervalo obrigatório sem `pacienteId`
- [ ] 6.3 Criação com duração mínima, valor congelado e tradução do erro `23P01` para `409`
- [ ] 6.4 Transições de status com as recusas especificadas
- [ ] 6.5 Reagendamento preservando duração e valor
- [ ] 6.6 Componente de calendário com visão diária, semanal e mensal
- [ ] 6.7 Persistir visão preferida
- [ ] 6.8 Criar atendimento por seleção de intervalo no calendário
- [ ] 6.9 Reagendar por arrastar, com validação antes de confirmar
- [ ] 6.10 Indicador de excedente na visão mensal com atalho para a visão diária
- [ ] 6.11 Painel de atendimentos do dia no dashboard, com estado vazio
- [ ] 6.12 Teste de integração: sobreposição, encaixe adjacente, horário liberado por cancelamento
- [ ] 6.13 Teste de fuso: atendimento na virada do dia e na virada da semana, com `TZ` do processo diferente de São Paulo
- [ ] 6.14 Teste de carga: dois anos de atendimentos, abertura de visão abaixo de dois segundos

## 7. Fechamento

- [ ] 7.1 Seed de desenvolvimento com dados fictícios
- [ ] 7.2 Conferir cada cenário das três delta specs contra o comportamento real
- [ ] 7.3 Confirmar que nenhuma rota autenticada está sendo cacheada estaticamente
- [ ] 7.4 README com instruções de execução local
- [ ] 7.5 `openspec validate 01-fundacao`