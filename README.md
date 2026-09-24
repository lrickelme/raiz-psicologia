# Raíz

Sistema de gestão de consultório para uma psicóloga autônoma. Ver
`openspec/project.md` para propósito, stack completa e convenções.

## Versão do NestJS

O `apps/api` fixa `@nestjs/*` em `^11.2.3` (linha 11.x), não `^12`.

O NestJS 12 traz migração completa de CommonJS para ESM e troca do toolchain
padrão (Vitest no lugar do Jest, oxlint no lugar do ESLint, Rspack no lugar do
Webpack) — mudanças boas, mas recentes demais para um projeto que depende de
integrações de terceiros estáveis (Prisma, Testcontainers, `@node-rs/argon2`).

Antes de subir para a 12.x, confirmar que essas dependências já publicaram
versões compatíveis com ESM. Se sim, a migração vira uma change própria — não
um bump incidental de patch.

## Rodando localmente

### Pré-requisitos

- **Node 22** (`engines` no `package.json`). Com nvm: `nvm use 22`. Em Node 18
  o Next 16 e o NestJS 11 quebram.
- **pnpm 12**, pela versão fixada em `packageManager`: `corepack enable`.
- **Docker** com Compose, para o Postgres 16 local e para os testes
  (Testcontainers sobe um Postgres descartável por arquivo de teste).

### Primeira execução

```bash
pnpm install
cp .env.example apps/api/.env
echo 'API_INTERNAL_URL="http://localhost:3333"' > apps/web/.env.local
```

Em `apps/api/.env`, preencha:

- `RAIZ_CHAVE_CRIPTOGRAFIA` com `openssl rand -base64 32`. Sem ela a API não
  sobe. Perdê-la torna ilegível todo motivo de atendimento já gravado, então
  guarde uma cópia fora do repositório.
- `RAIZ_EMAIL`, `RAIZ_SENHA` e `RAIZ_NOME`, a credencial da profissional (ver
  abaixo).
- `DATABASE_URL`, só se a porta `5433` já estiver em uso (troque também em
  `docker-compose.yml`).

```bash
pnpm db:up          # sobe o Postgres (docker) e espera ficar saudável
pnpm migrate        # aplica as migrations
pnpm seed           # provisiona a credencial única
pnpm seed:dev       # opcional: pacientes e agenda fictícios
pnpm dev            # Postgres, api (:3333) e web (:3000) juntos
```

Abra <http://localhost:3000> e entre com `RAIZ_EMAIL` e `RAIZ_SENHA`. O
navegador fala só com o Next. A API em `:3333` é interna e não precisa ficar
acessível de fora da máquina.

### Dados fictícios

`pnpm seed:dev` roda o seed da credencial e depois carrega nove pacientes
inventados (um arquivado, um par de homônimos, um cadastro mínimo) com agenda
de seis semanas atrás até quatro à frente, contadas a partir do dia em que o
comando roda. A carga inclui atendimentos hoje, faltas e cancelamentos com
motivo (cifrado), cadeias de remarcação e um dia cheio na semana seguinte.

Se já houver algum paciente no banco, o comando não altera nada.
`pnpm seed:dev --recriar` apaga **todos** os pacientes e atendimentos antes de
recarregar. A trilha de auditoria é somente-inserção e fica como está. Com
`NODE_ENV=production` o comando se recusa a rodar.

### Testes

```bash
pnpm --filter @raiz/api test
```

São testes de integração contra um Postgres real em container, sem mock do
Prisma, porque a constraint de sobreposição só existe no banco. Eles precisam
do Docker rodando, mas não do banco do `docker-compose`. A chave de
criptografia e o piso de tempo do login dos testes vêm de `vitest.config.ts`.

### Problemas comuns

- **`RAIZ_CHAVE_CRIPTOGRAFIA não definida`** ao subir a API: falta a chave em
  `apps/api/.env`.
- **Login não mantém a sessão no Safari:** o cookie sai com `Secure`. Chrome e
  Firefox aceitam isso em `http://localhost`, o Safari não. Use outro navegador
  ou HTTPS local.
- **Erro de sintaxe ou de módulo ao rodar qualquer script:** confira
  `node -v`. O shell pode estar em uma versão anterior à 22.

## Credencial da profissional

Não existe rota de cadastro. A conta única é criada pelo seed a partir de
`RAIZ_EMAIL`, `RAIZ_SENHA` e `RAIZ_NOME` em `apps/api/.env`; rodar `pnpm seed`
de novo redefine a senha.

A API não deve ter porta pública: ela confia em `X-Forwarded-For` (vindo do BFF
do Next) para o rate limit de login por IP.
