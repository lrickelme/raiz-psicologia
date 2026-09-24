import "reflect-metadata";
import { execFileSync } from "node:child_process";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { criarApp } from "../app.factory";
import { COOKIE_SESSAO } from "../auth/auth.constantes";
import { gerarHashSenha } from "../auth/senha";
import { PrismaService } from "../prisma/prisma.service";

type Metodo = "GET" | "POST" | "PATCH" | "DELETE";

/**
 * Postgres real (Testcontainers) com as migrations aplicadas, a aplicação
 * montada como em produção e uma sessão já autenticada.
 */
export async function subirAmbiente() {
  const banco = await new PostgreSqlContainer("postgres:16-alpine").start();
  process.env.DATABASE_URL = banco.getConnectionUri();
  execFileSync("npx", ["prisma", "migrate", "deploy"], { env: process.env, stdio: "ignore" });

  const app: NestFastifyApplication = await criarApp();
  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  const prisma = app.get(PrismaService);
  const email = "profissional@exemplo.com";
  const senha = "senha-correta-da-profissional";
  await prisma.usuario.create({
    data: { email, nome: "Profissional", senhaHash: await gerarHashSenha(senha) },
  });
  const entrada = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email, senha },
  });
  const token = entrada.cookies.find((c) => c.name === COOKIE_SESSAO)!.value;

  return {
    app,
    prisma,
    api: (method: Metodo, url: string, payload?: object) =>
      app.inject({
        method,
        url: `/api/v1${url}`,
        headers: { "x-forwarded-for": "198.51.100.50" },
        cookies: { [COOKIE_SESSAO]: token },
        payload,
      }),
    encerrar: async () => {
      await app.close();
      await banco.stop();
    },
  };
}

export type Ambiente = Awaited<ReturnType<typeof subirAmbiente>>;
