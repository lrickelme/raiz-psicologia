import "reflect-metadata";
import { execFileSync } from "node:child_process";
import { Controller, Get, Module, Param, Post } from "@nestjs/common";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AppModule } from "../app.module";
import { criarApp } from "../app.factory";
import { COOKIE_SESSAO } from "../auth/auth.constantes";
import { gerarHashSenha } from "../auth/senha";
import { PrismaService } from "../prisma/prisma.service";
import { Auditado } from "./auditado.decorator";

const EMAIL = "profissional@exemplo.com";
const SENHA = "senha-correta-da-profissional";
const ID = "0199a0e0-0000-7000-8000-000000000001";

/** Faz o papel dos controllers de paciente, que chegam na seção 5. */
@Auditado("PACIENTE")
@Controller("pacientes-falsos")
class PacienteFalsoController {
  @Get()
  listar() {
    return { itens: [{ id: ID }, { id: "0199a0e0-0000-7000-8000-000000000002" }] };
  }

  @Get(":id")
  obter(@Param("id") id: string) {
    return { id };
  }

  @Post()
  criar() {
    return { id: ID };
  }
}

@Module({ imports: [AppModule], controllers: [PacienteFalsoController] })
class AppDeTeste {}

describe("trilha de auditoria (integração)", () => {
  let banco: StartedPostgreSqlContainer;
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let token: string;

  beforeAll(async () => {
    banco = await new PostgreSqlContainer("postgres:16-alpine").start();
    process.env.DATABASE_URL = banco.getConnectionUri();
    execFileSync("npx", ["prisma", "migrate", "deploy"], {
      env: process.env,
      stdio: "ignore",
    });

    app = await criarApp(AppDeTeste);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    prisma = app.get(PrismaService);
    await prisma.usuario.create({
      data: { email: EMAIL, nome: "Profissional", senhaHash: await gerarHashSenha(SENHA) },
    });

    const entrada = await login(EMAIL, SENHA);
    token = entrada.cookies.find((c) => c.name === COOKIE_SESSAO)!.value;
  }, 180_000);

  afterAll(async () => {
    await app?.close();
    await banco?.stop();
  });

  function login(email: string, senha: string) {
    return app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: { "x-forwarded-for": "198.51.100.10" },
      payload: { email, senha },
    });
  }

  function acessar(method: "GET" | "POST", url: string, comSessao = true) {
    return app.inject({
      method,
      url,
      headers: { "x-forwarded-for": "198.51.100.20" },
      cookies: comSessao ? { [COOKIE_SESSAO]: token } : {},
    });
  }

  it("login bem-sucedido e malsucedido geram LOGIN_SUCESSO e LOGIN_FALHA", async () => {
    await login(EMAIL, "senha-errada");
    await login("ninguem@exemplo.com", "senha-errada");

    const sucesso = await prisma.auditoria.findMany({ where: { tipoEvento: "LOGIN_SUCESSO" } });
    expect(sucesso).toHaveLength(1);
    expect(sucesso[0]).toMatchObject({ recursoTipo: "USUARIO", ip: "198.51.100.10" });

    const falhas = await prisma.auditoria.findMany({
      where: { tipoEvento: "LOGIN_FALHA" },
      orderBy: { ocorridoEm: "asc" },
    });
    expect(falhas.map((f) => f.detalhe)).toEqual([
      { email: EMAIL },
      { email: "ninguem@exemplo.com" },
    ]);
    // Conta existente e inexistente geram o mesmo registro, sem id.
    expect(falhas.every((f) => f.recursoId === null)).toBe(true);
  });

  it("acesso a recurso auditado grava leitura e escrita com id e origem", async () => {
    expect((await acessar("GET", `/api/v1/pacientes-falsos/${ID}`)).statusCode).toBe(200);
    expect((await acessar("POST", "/api/v1/pacientes-falsos")).statusCode).toBe(201);
    expect((await acessar("GET", "/api/v1/pacientes-falsos")).statusCode).toBe(200);

    const acessos = await prisma.auditoria.findMany({
      where: { recursoTipo: "PACIENTE" },
      orderBy: { ocorridoEm: "asc" },
    });
    expect(acessos).toMatchObject([
      { tipoEvento: "LEITURA", recursoId: ID, ip: "198.51.100.20" },
      { tipoEvento: "ESCRITA", recursoId: ID },
      {
        tipoEvento: "LEITURA",
        recursoId: null,
        detalhe: { metodo: "GET", rota: "/api/v1/pacientes-falsos", ids: [ID, expect.any(String)] },
      },
    ]);
  });

  it("requisição recusada pelo guard não gera acesso", async () => {
    const antes = await prisma.auditoria.count({ where: { recursoTipo: "PACIENTE" } });
    expect((await acessar("GET", `/api/v1/pacientes-falsos/${ID}`, false)).statusCode).toBe(401);
    expect(await prisma.auditoria.count({ where: { recursoTipo: "PACIENTE" } })).toBe(antes);
  });

  it("logout gera LOGOUT", async () => {
    const entrada = await login(EMAIL, SENHA);
    const outro = entrada.cookies.find((c) => c.name === COOKIE_SESSAO)!.value;
    await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      cookies: { [COOKIE_SESSAO]: outro },
    });
    expect(await prisma.auditoria.count({ where: { tipoEvento: "LOGOUT" } })).toBe(1);
  });

  it("alterar ou remover registro de auditoria falha", async () => {
    const { id } = await prisma.auditoria.findFirstOrThrow();
    const total = await prisma.auditoria.count();

    await expect(
      prisma.auditoria.update({ where: { id }, data: { tipoEvento: "ADULTERADO" } }),
    ).rejects.toThrow(/somente-inserção/);
    await expect(prisma.auditoria.delete({ where: { id } })).rejects.toThrow(/somente-inserção/);
    await expect(prisma.auditoria.deleteMany()).rejects.toThrow(/somente-inserção/);
    await expect(prisma.$executeRawUnsafe('TRUNCATE "auditoria"')).rejects.toThrow(
      /somente-inserção/,
    );

    expect(await prisma.auditoria.count()).toBe(total);
    expect((await prisma.auditoria.findUniqueOrThrow({ where: { id } })).tipoEvento).not.toBe(
      "ADULTERADO",
    );
  });
});
