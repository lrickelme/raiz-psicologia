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

Instruções completas de execução local ficam pendentes até a tarefa 7.4 da
change `01-fundacao` (README final, com passo a passo de setup). Por ora, o
essencial:

```bash
pnpm install
cp .env.example apps/api/.env      # ajustar se a porta 5433 já estiver em uso
cp .env.example apps/web/.env.local  # mantém só a linha API_INTERNAL_URL
pnpm migrate                       # aplica as migrations no container
pnpm seed                          # provisiona a credencial única (ver abaixo)
pnpm run dev                       # sobe Postgres (docker), api (:3333) e web (:3000)
```

O projeto exige Node 22 (`engines` no `package.json`). Com nvm: `nvm use 22`.

## Credencial da profissional

Não existe rota de cadastro. A conta única é criada pelo seed a partir de
`RAIZ_EMAIL`, `RAIZ_SENHA` e `RAIZ_NOME` em `apps/api/.env`; rodar `pnpm seed`
de novo redefine a senha. O cookie de sessão sai sempre com `Secure`: Chrome e
Firefox aceitam isso em `http://localhost`, Safari não — no Safari, use HTTPS.

A API não deve ter porta pública: ela confia em `X-Forwarded-For` (vindo do BFF
do Next) para o rate limit de login por IP.
