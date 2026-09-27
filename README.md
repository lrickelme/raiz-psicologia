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

`pnpm -F @raiz/api seed:dev:evolucoes` acrescenta quatro evoluções fictícias,
em linha de TCC, a cada paciente existente, com datas retroativas e algumas
retificações. Paciente que já tem quatro evoluções é pulado.

Se já houver algum paciente no banco, o `seed:dev` não altera nada.
`pnpm seed:dev --recriar` apaga **todos** os pacientes, atendimentos e
evoluções antes de recarregar. A trilha de auditoria é somente-inserção e fica como está. Com
`NODE_ENV=production` o comando se recusa a rodar.

### Testes

```bash
pnpm --filter @raiz/api test      # integração da API
pnpm --filter @raiz/shared test   # schemas e máscara de telefone
pnpm --filter @raiz/web test:e2e  # ponta a ponta, navegador real
```

Os testes ponta a ponta sobem Postgres, API e Next próprios e descartáveis,
em portas separadas (3334 e 3100), e nunca tocam o banco de desenvolvimento.
Com `COMPARACAO_VISUAL=1`, geram também capturas lado a lado com o
`design-ref` em `apps/web/test-results/comparacao-visual/`.

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

## Backup

O backup roda fora da aplicação, em container próprio (`infra/backup`):
`pg_dump` agendado, com a saída cifrada pelo [age](https://age-encryption.org).
A cifragem é assimétrica. O servidor guarda só a **chave pública**, então
consegue gerar backups mas não lê-los. A **chave privada** fica fora do
servidor, com a profissional.

### Duas chaves, duas cópias fora do servidor

1. **Chave privada do age**, para decifrar o arquivo de backup.
2. **`RAIZ_CHAVE_CRIPTOGRAFIA`** de `apps/api/.env`. O backup contém as
   evoluções e os motivos de atendimento já cifrados pela aplicação; sem essa
   chave, um banco restaurado é ilegível.

Guarde as duas em lugares seguros e diferentes do servidor, por exemplo um
gerenciador de senhas e um pendrive guardado em local seguro. Perder qualquer
uma delas torna os backups inúteis.

### Configurar

Gere o par de chaves age **fora do servidor** (ou gere e apague a privada de
lá em seguida):

```bash
docker build -t raiz-backup infra/backup
docker run --rm --entrypoint age-keygen raiz-backup > raiz-backup.age
grep 'public key' raiz-backup.age     # age1... — é a que vai para o servidor
```

`raiz-backup.age` é a chave privada. Tire-a do servidor.

No servidor, crie um `.env` na **raiz do repositório** (é o que o Docker
Compose lê; não confundir com `apps/api/.env`):

```bash
BACKUP_AGE_RECIPIENT="age1..."     # a chave pública
BACKUP_CRON="0 3 * * *"            # opcional: todo dia às 3h (America/Sao_Paulo)
BACKUP_RETENCAO_DIAS=30            # opcional: apaga os mais antigos que isso
BACKUP_DIR=./backups               # opcional: onde os arquivos ficam
```

```bash
docker compose --profile backup up -d backup
docker compose --profile backup run --rm backup agora   # um backup imediato
```

Cada arquivo tem data no nome (`raiz-2026-09-26T030000.dump.age`) e só
aparece com esse nome quando termina. A retenção nunca apaga os 7 mais
recentes, mesmo que os backups tenham parado de funcionar. Os backups ficam no
mesmo disco do banco: copie-os periodicamente para outro lugar.

### Log

Cada execução registra início, fim, arquivo, tamanho e duração, ou `FALHA`
com o código de saída. O registro vai para `backups/backup.log` e para
`docker compose logs backup`:

```
2026-09-26T03:00:00-0300 início banco=raiz@db:5432
2026-09-26T03:00:01-0300 ok arquivo=raiz-2026-09-26T030000.dump.age bytes=68943 duracao=1s
```

### Restaurar

A restauração vai para um banco **vazio**; o script se recusa a restaurar sobre
dados existentes.

1. Crie o banco de destino, por exemplo `raiz_restaurado`:

   ```bash
   docker compose exec db createdb -U raiz raiz_restaurado
   ```

2. Traga a chave privada e o arquivo de backup para uma pasta, por exemplo
   `./restauracao`, e restaure:

   ```bash
   docker compose --profile backup run --rm \
     -v "$PWD/restauracao:/restauracao" -e PGDATABASE=raiz_restaurado \
     backup restaurar /restauracao/raiz-2026-09-26T030000.dump.age /restauracao/raiz-backup.age
   ```

3. Aponte a API para o banco restaurado (`DATABASE_URL` em `apps/api/.env`),
   com a **mesma** `RAIZ_CHAVE_CRIPTOGRAFIA` de antes, e suba-a. Abra o
   prontuário de um paciente e leia uma evolução.

4. Apague a chave privada da pasta de restauração quando terminar.

Os gatilhos de imutabilidade (evolução e auditoria) voltam junto com os dados.

### Exercitar a restauração

```bash
infra/backup/exercitar-restauracao.sh
```

O script faz o ciclo inteiro contra o Postgres do `docker-compose`, sem
escrever nele:

1. gera um par de chaves descartável;
2. faz o backup e confere que o arquivo saiu cifrado;
3. restaura num Postgres limpo e confere os gatilhos de imutabilidade;
4. lê os dois bancos pela criptografia da aplicação, comparando o texto
   decifrado de evoluções e motivos.

Rode-o depois de mudar migrations ou a imagem de backup. Um backup que nunca
foi restaurado não é garantia de nada.

## Credencial da profissional

Não existe rota de cadastro. A conta única é criada pelo seed a partir de
`RAIZ_EMAIL`, `RAIZ_SENHA` e `RAIZ_NOME` em `apps/api/.env`; rodar `pnpm seed`
de novo redefine a senha.

A API não deve ter porta pública: ela confia em `X-Forwarded-For` (vindo do BFF
do Next) para o rate limit de login por IP.
