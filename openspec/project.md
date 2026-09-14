# Raíz — Contexto do Projeto

## Propósito

Sistema de gestão de consultório para uma psicóloga autônoma. Centraliza agenda,
prontuário eletrônico, controle financeiro, rotina de estudos e lembretes,
substituindo registros em papel.

## Tenancy

**Single-tenant, usuário único.** Não há cadastro público, convite, papéis ou
organizações. Toda a modelagem parte do princípio de que existe exatamente uma
profissional usando o sistema. Qualquer requisito que pressuponha múltiplos
usuários deve ser rejeitado na revisão do proposal.

## Stack

| Camada | Tecnologia |
| --- | --- |
| Frontend | Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS |
| Backend | NestJS 11 sobre Fastify + TypeScript |
| Runtime | Node.js 22 LTS |
| Persistência | PostgreSQL 16 + Prisma (migrations versionadas) |
| Validação | Zod, com schemas compartilhados entre web e api |
| Estado de servidor | TanStack Query |
| Autenticação | Sessão server-side, cookie `HttpOnly` + `SameSite=Strict` |
| Hash de senha | Argon2id (`@node-rs/argon2`) |
| Testes | Vitest nas duas pontas; Testcontainers para integração da API |
| Gerenciador | pnpm workspaces |

### Nota sobre a versão do NestJS

O NestJS 12 saiu em 27/08/2026 e traz migração completa de CommonJS para ESM,
além de troca do toolchain padrão (Vitest no lugar do Jest, oxlint no lugar do
ESLint, Rspack no lugar do Webpack). São mudanças boas, mas recentes demais para
um projeto que precisa de integrações de terceiros estáveis.

A stack fixa **NestJS 11.x**. Antes de subir para 12, verificar se os pacotes
`@nestjs/*` e as bibliotecas de sessão e Prisma usadas aqui já publicaram
versões compatíveis com ESM. Se tiverem, a migração vira uma change própria.

O Next.js está em 16.x, que é a linha Active LTS. Sem ressalva.

## Layout do repositório

```
apps/
  web/          # Next.js — App Router
  api/          # NestJS
packages/
  shared/       # schemas Zod e tipos derivados, consumidos pelas duas pontas
design-ref/     # export do Claude Design ("Raíz - Guia e Telas") — referência visual
openspec/       # este diretório
```

`design-ref/` é somente leitura. Nunca importe código dele para `apps/web`;
ele serve para extrair tokens, espaçamentos e estrutura de layout.

## Identidade visual

Os tokens canônicos vêm de `design-ref/TOKENS.md` (extraído de `styles.css` e
`guia.html` — é a fonte da verdade; não reescrever hex de memória).

Cores primárias:

- `--raiz-marrom: #46342A` (texto e chrome — inclui o fundo escuro da sidebar).
  Corresponde a `--ink` no design-ref.
- `--raiz-vinho: #7E2B2E` (ação primária — botões, item de nav ativo).
  Corresponde a `--wine`.
- `--raiz-areia: #F3E9DC` (fundo do app shell). Corresponde a `--bg`. O `body`
  cru usa `#E9E0D3` antes do shell montar — esse valor é só fallback de página,
  não usar em componente.
- `--raiz-superficie: #FCF8F2` (superfícies elevadas — cards, inputs).
  Corresponde a `--surface`. Renomeado de "argila": o token que de fato cumpre
  o papel de superfície elevada no design é `--surface`; `--beige` é apenas um
  swatch de exemplo na paleta, sem uso estrutural nos arquivos-fonte.
- `--raiz-musgo: #5E6E4E` (sucesso/concluído). Corresponde a `--moss`.
- `--raiz-ambar: #B6863C` (atenção/pendente — ex.: status "Agendada").
  Corresponde a `--amber`. Ausente da versão anterior deste documento; é uma
  cor semântica tão relevante quanto o musgo e faltava.

Tokens secundários de texto/borda (hierarquia de texto e divisores — não
hardcode, sempre via variável):

- `--raiz-texto-secundario: #5C4636` (`--ink2`)
- `--raiz-texto-terciario: #8C7A68` (`--muted`)
- `--raiz-texto-inativo: #A89682` (`--muted2` — nav inativo)
- `--raiz-borda: #E6D8C7` (`--line`)
- `--raiz-borda-forte: #DECDB8` (`--line2` — inputs, botão secundário)

Tipografia — sistema de três famílias (a versão anterior deste documento citava
"Inter", que está incorreto; nenhuma tela do design usa Inter):

- **Bricolage Grotesque** — display: wordmark, headings.
- **Hanken Grotesk** — corpo/UI: texto padrão, botões, nav.
- **IBM Plex Mono** — dados: horas, valores, eyebrows/labels em caixa alta.

Todo componente novo consome esses tokens via `tailwind.config`. Hex hardcoded em
JSX é erro de revisão.

## Convenções

- API sob `/api/v1`. Respostas de erro seguem RFC 7807 (`application/problem+json`).
- O navegador **nunca** fala direto com o NestJS. Todo tráfego passa pelos route
  handlers do Next, que atuam como BFF e repassam o cookie de sessão. Isso mantém
  a API fora da internet pública e o cookie em origem única.
- Schemas Zod vivem em `packages/shared` e são a fonte única de verdade de
  contrato. O Nest valida com eles na entrada; o formulário do Next valida com os
  mesmos schemas. Tipo derivado com `z.infer`, nunca redigitado.
- IDs públicos são UUID v7. Nunca expor a PK sequencial.
- Datas e horas trafegam em ISO-8601 com offset. Persistência em `timestamptz`.
  O servidor assume `America/Sao_Paulo` para regras de negócio de calendário.
- Valores monetários em `Prisma.Decimal` e `numeric(10,2)` no Postgres. Nunca
  `number`. Na fronteira da API, serializar como string.
- Migrations Prisma são imutáveis após commit. Correção é uma migration nova.
- Server Components para o shell e carregamento inicial. Módulos interativos
  (agenda, formulários) são Client Components com TanStack Query. Não force RSC
  em tela que o usuário manipula o tempo todo.
- Desktop primeiro nas changes 01 a 05. A adaptação para celular e a instalação
  como PWA vêm na change 06. Sabendo disso, evite decisões que travem a adaptação:
  sem largura fixa em pixel no shell, sem tabela como única forma de exibir lista,
  sem ação essencial escondida atrás de `hover`. São restrições baratas agora e
  caras de desfazer depois.

## Restrições regulatórias

Prontuário psicológico é dado pessoal sensível de saúde sob a LGPD (Art. 5º, II e
Art. 11) e está sujeito às normas de sigilo e guarda do Conselho Federal de
Psicologia. Consequências que valem como regra de arquitetura:

1. O texto da evolução e o motivo de cancelamento/remarcação/falta de um
   atendimento são dados clínicos e ficam **criptografados em repouso** na coluna.
2. Toda leitura e escrita de evolução ou de motivo de atendimento gera registro em
   trilha de auditoria.
3. Evolução **não é deletável** pela interface — apenas retificável, com histórico.
4. O sistema precisa exportar o prontuário completo de um paciente em formato
   legível, para transferência ou requisição.
5. O prazo mínimo de guarda deve ser confirmado na resolução vigente do CFP antes
   de qualquer implementação de expurgo. Enquanto não confirmado, nada expira.
6. Texto de prontuário e motivo de atendimento **não trafegam por Server
   Component renderizado em cache**. Qualquer rota que toque evolução ou motivo é
   dinâmica e sem cache, explicitamente.

## Fora de escopo (v1)

Multiusuário, agenda pública para pacientes, teleconsulta, emissão de nota fiscal,
integração com convênios, app nativo, notificação por e-mail ou WhatsApp.