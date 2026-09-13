# Design: Fundação

## Modelo de dados

Nomes de modelo em PascalCase no Prisma, tabelas em snake_case via `@@map`.

```
Usuario      id, email, senhaHash, nome, criadoEm
Sessao       id, usuarioId, expiraEm, criadoEm        -- sessão de login
Paciente     id, nome, telefone, email, nascimento,
             valorConsultaPadrao Decimal @db.Decimal(10,2),
             observacoes, status(ATIVO|ARQUIVADO), criadoEm, atualizadoEm
Atendimento  id, pacienteId, inicio, fim,
             status(AGENDADO|REALIZADO|CANCELADO|FALTA),
             valor Decimal @db.Decimal(10,2),   -- congelado no agendamento
             motivoCancelamento, criadoEm, atualizadoEm
Auditoria    id, ocorridoEm, tipoEvento, recursoTipo, recursoId, ip, detalhe Json
```

A consulta clínica chama-se `Atendimento`, não `Sessao`, porque `Sessao` já é a
sessão de login. Colidir esses dois nomes em um código TypeScript onde ambos são
importáveis produz bugs silenciosos de import.

Modelos de `02` em diante (`Evolucao`, `Estudo`, `LabelPrioridade`, `Lembrete`)
ficam fora desta change.

## Decisões

### Next.js como BFF, NestJS fechado

O navegador conversa apenas com o Next. Route handlers em `app/api/[...path]`
repassam para o NestJS em rede interna, encaminhando o cookie de sessão.

Alternativa descartada: expor o Nest direto e chamar de `fetch` no cliente. Isso
cria duas origens, obriga CORS com credenciais e força `SameSite=Lax` no cookie,
que é exatamente a proteção que queríamos manter em `Strict`. Com o BFF, cookie e
página vivem na mesma origem e a API nem precisa de porta pública.

Custo: um salto de rede a mais por requisição. Irrelevante para um consultório.

### Sobreposição validada no banco

A regra de não-sobreposição é garantida por constraint de exclusão do Postgres,
não só por consulta no serviço. O Prisma não modela `EXCLUDE` no schema, então
vai em migration SQL manual:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE atendimento ADD CONSTRAINT atendimento_sem_sobreposicao
  EXCLUDE USING gist (
    tstzrange(inicio, fim) WITH &&
  ) WHERE (status <> 'CANCELADO');
```

Validação só em serviço tem janela de corrida entre a consulta e o insert. Com a
constraint, o serviço captura o erro `23P01` do Postgres e o converte em `409` —
a corretude não depende do timing.

### Zod compartilhado em vez de class-validator

`class-validator` com DTOs decorados é o padrão do Nest, mas os schemas ficariam
presos no backend e o formulário do Next reimplementaria as mesmas regras. Com
Zod em `packages/shared`, a regra de "valor não negativo, duas casas decimais"
existe uma vez só.

O Nest usa um `ZodValidationPipe` próprio, de umas quinze linhas. O Next usa o
mesmo schema no `react-hook-form` via resolver. Divergência entre validação de
cliente e servidor deixa de ser possível por construção.

### Sessão em tabela, não JWT

Usuário único, requisito de expiração por inatividade e de logout imediato. JWT
stateless não revoga sem lista de bloqueio, o que reintroduz o estado que ele
prometia eliminar. Sessão em tabela com cookie `HttpOnly` resolve os dois
requisitos direto e mantém o token fora do alcance de JavaScript.

Bibliotecas de auth completas (NextAuth e afins) resolvem OAuth e multiusuário,
problemas que este projeto não tem, e cobram em configuração e indireção.

### Decimal na fronteira

`Prisma.Decimal` não sobrevive a `JSON.stringify` sem perda. Valores monetários
são serializados como string na resposta e reconstruídos como `Decimal` na
entrada, com o schema Zod fazendo a coerção. Nunca `number` — ponto flutuante
com dinheiro é erro que aparece meses depois, em um total que não bate por
centavos.

### Fuso: armazenamento absoluto, regra local

O banco guarda instante absoluto em `timestamptz`. "Que atendimentos são de hoje"
é pergunta de calendário local, resolvida no serviço com `America/Sao_Paulo`
explícito via `date-fns-tz` — nunca com o fuso default do processo, que varia por
ambiente e transforma bug de produção em algo irreprodutível na máquina local.

## Arquitetura da API

Módulo por capacidade, não por camada técnica:

```
apps/api/src/
├── auth/          controller, service, guard, sessao.store
├── paciente/      controller, service, repository
├── atendimento/   controller, service, repository
├── auditoria/     interceptor, service
├── prisma/        PrismaModule global
└── comum/         filtro de exceção RFC 7807, ZodValidationPipe, config
```

`paciente` não importa de `atendimento`. O histórico do perfil é servido por
`GET /api/v1/atendimentos?pacienteId=...`, evitando dependência circular.

Auditoria entra como `NestInterceptor` global. Chamada manual espalhada pelos
serviços garante que alguém vai esquecer em um método novo.

## Endpoints

```
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
GET    /api/v1/auth/sessao              -> dados da sessão corrente

GET    /api/v1/pacientes                ?busca=&status=&page=&size=
POST   /api/v1/pacientes
GET    /api/v1/pacientes/:id
PATCH  /api/v1/pacientes/:id
POST   /api/v1/pacientes/:id/arquivar
POST   /api/v1/pacientes/:id/reativar

GET    /api/v1/atendimentos             ?de=&ate=&pacienteId=
POST   /api/v1/atendimentos
PATCH  /api/v1/atendimentos/:id         -> reagendar
POST   /api/v1/atendimentos/:id/realizar
POST   /api/v1/atendimentos/:id/cancelar
POST   /api/v1/atendimentos/:id/falta
```

O intervalo em `GET /api/v1/atendimentos` é obrigatório quando não há
`pacienteId`, o que impede a interface de puxar a agenda inteira sem querer.

## Frontend

Estrutura do App Router espelhando os módulos da API:

```
apps/web/src/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (app)/layout.tsx              # shell: sidebar + cabeçalho
│   ├── (app)/page.tsx                # dashboard
│   ├── (app)/agenda/page.tsx
│   ├── (app)/pacientes/page.tsx
│   ├── (app)/pacientes/[id]/page.tsx
│   └── api/[...path]/route.ts        # proxy BFF para o NestJS
├── features/{auth,pacientes,agenda}/
└── components/ui/                    # primitivos do guia Raíz
```

- Shell e listagens iniciais em Server Components. Agenda e formulários em
  Client Components com TanStack Query. RSC em tela que o usuário manipula o
  tempo todo só adiciona ida ao servidor sem ganho.
- Toda rota autenticada é dinâmica. Nenhuma página que toca dado de paciente
  entra em cache estático.
- Calendário próprio sobre `date-fns`. Bibliotecas prontas trazem CSS opinativo
  que briga com os tokens do Raíz, e a agenda aqui tem poucos modos. Reavaliar se
  a complexidade crescer.

## Testes

Cada capacidade fecha com teste de integração em Vitest + Testcontainers
(Postgres real, não mock do Prisma — o mock não valida a constraint de exclusão,
que é onde mora o risco). Três cenários são obrigatórios: violação da constraint
de sobreposição, expiração de sessão por inatividade e conclusão antecipada de
atendimento.