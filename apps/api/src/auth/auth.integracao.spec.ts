import "reflect-metadata";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { HEADER_SESSAO_EXPIRA } from "@raiz/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { criarApp } from "../app.factory";
import { PrismaService } from "../prisma/prisma.service";
import {
  COOKIE_SESSAO,
  LOGIN_MAX_FALHAS,
  SESSAO_INATIVIDADE_MS,
} from "./auth.constantes";
import { gerarHashSenha } from "./senha";

const EMAIL = "profissional@exemplo.com";
const SENHA = "senha-correta-da-profissional";

/** Postgres real (Testcontainers) com as migrations aplicadas, como em produção. */
describe("autenticação (integração)", () => {
  let banco: StartedPostgreSqlContainer;
  let app: NestFastifyApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    banco = await new PostgreSqlContainer("postgres:16-alpine").start();
    process.env.DATABASE_URL = banco.getConnectionUri();
    execFileSync("npx", ["prisma", "migrate", "deploy"], {
      env: process.env,
      stdio: "ignore",
    });

    app = await criarApp();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    prisma = app.get(PrismaService);
    await prisma.usuario.create({
      data: { email: EMAIL, nome: "Profissional", senhaHash: await gerarHashSenha(SENHA) },
    });
  }, 180_000);

  afterAll(async () => {
    await app?.close();
    await banco?.stop();
  });

  /** Cada teste usa o próprio IP, para o rate limit de um não vazar no outro. */
  function login(ip: string, email: string, senha: string) {
    return app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: { "x-forwarded-for": ip },
      payload: { email, senha },
    });
  }

  function consultarSessao(token: string) {
    return app.inject({
      method: "GET",
      url: "/api/v1/auth/sessao",
      cookies: { [COOKIE_SESSAO]: token },
    });
  }

  it("login válido: 204, cookie protegido e sessão renovada a cada requisição", async () => {
    const resposta = await login("198.51.100.1", EMAIL, SENHA);

    expect(resposta.statusCode).toBe(204);
    const cookie = resposta.cookies.find((c) => c.name === COOKIE_SESSAO);
    expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: "Strict", path: "/" });

    const antes = Date.now();
    const sessao = await consultarSessao(cookie!.value);
    expect(sessao.statusCode).toBe(200);

    const { usuario, expiraEm } = sessao.json();
    expect(usuario).toMatchObject({ email: EMAIL, nome: "Profissional" });
    expect(sessao.headers[HEADER_SESSAO_EXPIRA]).toBe(expiraEm);
    expect(Date.parse(expiraEm)).toBeGreaterThanOrEqual(antes + SESSAO_INATIVIDADE_MS);
  });

  it("senha errada: 401 com o mesmo corpo de e-mail desconhecido", async () => {
    const senhaErrada = await login("198.51.100.2", EMAIL, "senha-errada");
    const desconhecido = await login("198.51.100.2", "ninguem@exemplo.com", "senha-errada");

    expect(senhaErrada.statusCode).toBe(401);
    expect(senhaErrada.headers["content-type"]).toContain("application/problem+json");
    expect(senhaErrada.cookies).toHaveLength(0);
    expect(desconhecido.statusCode).toBe(401);
    expect(desconhecido.json()).toEqual(senhaErrada.json());
  });

  it("sessão expirada: 401, registro removido e cookie apagado", async () => {
    const entrada = await login("198.51.100.3", EMAIL, SENHA);
    const token = entrada.cookies.find((c) => c.name === COOKIE_SESSAO)!.value;
    const daSessao = { tokenHash: createHash("sha256").update(token).digest("hex") };
    await prisma.sessao.update({
      where: daSessao,
      data: { expiraEm: new Date(Date.now() - 1000) },
    });

    const resposta = await consultarSessao(token);

    expect(resposta.statusCode).toBe(401);
    expect(resposta.headers["content-type"]).toContain("application/problem+json");
    expect(await prisma.sessao.count({ where: daSessao })).toBe(0);
    // O BFF reconhece o encerramento por esse formato para apagar o cookie
    // de expiração (apps/web, cookie-expira.ts).
    expect(resposta.headers["set-cookie"]).toMatch(new RegExp(`^${COOKIE_SESSAO}=;`));
  });

  it("sem cookie: 401 antes de consultar sessão", async () => {
    const resposta = await app.inject({ method: "GET", url: "/api/v1/auth/sessao" });
    expect(resposta.statusCode).toBe(401);
  });

  it("sexta tentativa em cinco minutos: 429 sem avaliar a senha", async () => {
    const ip = "198.51.100.4";
    for (let i = 0; i < LOGIN_MAX_FALHAS; i++) {
      expect((await login(ip, EMAIL, "senha-errada")).statusCode).toBe(401);
    }

    // A senha certa prova que a recusa vem antes da verificação.
    const resposta = await login(ip, EMAIL, SENHA);

    expect(resposta.statusCode).toBe(429);
    expect(Number(resposta.headers["retry-after"])).toBeGreaterThan(0);
    expect(resposta.cookies).toHaveLength(0);
  });
});
