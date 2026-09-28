import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { CREDENCIAL, PORTA_API, PORTA_WEB, URL_API, URL_WEB } from "./ambiente";

const WEB = join(__dirname, "..");

/**
 * A imagem do `docker-compose.yml`, a de produção — não a alpine, cuja
 * collation com musl ordena nomes por byte (ver `apps/api/src/teste/imagem-postgres.ts`).
 */
const IMAGEM_POSTGRES = "postgres:16";
const API = join(WEB, "../api");

async function esperar(url: string, processo: ChildProcess, limiteMs = 60_000): Promise<void> {
  const fim = Date.now() + limiteMs;
  while (Date.now() < fim) {
    if (processo.exitCode !== null) throw new Error(`${url}: processo saiu com ${processo.exitCode}`);
    try {
      const resposta = await fetch(url, { redirect: "manual" });
      if (resposta.status < 500) return;
    } catch {
      // ainda subindo
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${url} não respondeu em ${limiteMs} ms`);
}

function iniciar(comando: string, argumentos: string[], cwd: string, env: NodeJS.ProcessEnv) {
  // Grupo próprio, para o encerramento derrubar também os filhos do `npx`.
  const processo = spawn(comando, argumentos, { cwd, env, detached: true, stdio: "inherit" });
  return processo;
}

function encerrar(processo: ChildProcess) {
  if (processo.pid && processo.exitCode === null) {
    try {
      process.kill(-processo.pid, "SIGTERM");
    } catch {
      // já encerrado
    }
  }
}

/**
 * Sobe o ambiente descartável: Postgres em container, migrations, a
 * credencial da profissional, a API compilada e o Next em build de produção
 * com `distDir` próprio. Devolve o encerramento, que o Playwright chama ao fim.
 */
export default async function prepararAmbiente() {
  const banco = await new PostgreSqlContainer(IMAGEM_POSTGRES).start();
  // Para os testes que precisam de volume (carga do financeiro) semear por SQL.
  process.env.E2E_DATABASE_URL = banco.getConnectionUri();
  const envApi: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "production",
    DATABASE_URL: banco.getConnectionUri(),
    PORT: String(PORTA_API),
    // Chave fixa só do ambiente de teste, a mesma da suíte da API.
    RAIZ_CHAVE_CRIPTOGRAFIA: "dGVzdGUtdGVzdGUtdGVzdGUtdGVzdGUtdGVzdGUtMzI=",
    RAIZ_LOGIN_PISO_MS: "0",
    RAIZ_EMAIL: CREDENCIAL.email,
    RAIZ_SENHA: CREDENCIAL.senha,
    RAIZ_NOME: CREDENCIAL.nome,
  };

  execFileSync("npx", ["prisma", "migrate", "deploy"], { cwd: API, env: envApi, stdio: "ignore" });
  execFileSync("npx", ["prisma", "db", "seed"], { cwd: API, env: envApi, stdio: "ignore" });
  // `tsc` com saída própria, e não `nest build`: este apaga a `dist` que um
  // `nest start --watch` de desenvolvimento pode estar usando.
  execFileSync(
    "npx",
    ["tsc", "-p", "tsconfig.build.json", "--outDir", "dist-e2e", "--incremental", "false", "--declaration", "false", "--sourceMap", "false"],
    { cwd: API, stdio: "inherit" },
  );
  const api = iniciar("node", ["dist-e2e/main.js"], API, envApi);
  await esperar(`${URL_API}/api/v1/health`, api);

  const envWeb: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "production",
    NEXT_DIST_DIR: ".next-e2e",
    API_INTERNAL_URL: URL_API,
  };
  execFileSync("npx", ["next", "build"], { cwd: WEB, env: envWeb, stdio: "inherit" });
  const web = iniciar("npx", ["next", "start", "-p", String(PORTA_WEB)], WEB, envWeb);
  await esperar(`${URL_WEB}/login`, web);

  return async () => {
    encerrar(web);
    encerrar(api);
    await banco.stop();
  };
}
