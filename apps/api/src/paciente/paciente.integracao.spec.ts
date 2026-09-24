import "reflect-metadata";
import { execFileSync } from "node:child_process";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { Pagina, Paciente } from "@raiz/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { criarApp } from "../app.factory";
import { COOKIE_SESSAO } from "../auth/auth.constantes";
import { gerarHashSenha } from "../auth/senha";
import { PrismaService } from "../prisma/prisma.service";

const EMAIL = "profissional@exemplo.com";
const SENHA = "senha-correta-da-profissional";

describe("pacientes (integração)", () => {
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

    app = await criarApp();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    prisma = app.get(PrismaService);
    await prisma.usuario.create({
      data: { email: EMAIL, nome: "Profissional", senhaHash: await gerarHashSenha(SENHA) },
    });
    const entrada = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: EMAIL, senha: SENHA },
    });
    token = entrada.cookies.find((c) => c.name === COOKIE_SESSAO)!.value;
  }, 180_000);

  afterAll(async () => {
    await app?.close();
    await banco?.stop();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe("TRUNCATE atendimento, paciente CASCADE");
  });

  function api(method: "GET" | "POST" | "PATCH" | "DELETE", url: string, payload?: object) {
    return app.inject({
      method,
      url: `/api/v1${url}`,
      cookies: { [COOKIE_SESSAO]: token },
      payload,
    });
  }

  async function cadastrar(dados: Record<string, unknown>): Promise<Paciente> {
    const resposta = await api("POST", "/pacientes", { valorConsultaPadrao: "150", ...dados });
    expect(resposta.statusCode).toBe(201);
    return resposta.json();
  }

  async function listar(query = ""): Promise<Pagina<Paciente>> {
    const resposta = await api("GET", `/pacientes${query}`);
    expect(resposta.statusCode).toBe(200);
    return resposta.json();
  }

  it("cadastro mínimo: só nome e valor, ativo e já na listagem", async () => {
    const criado = await cadastrar({ nome: "Mariana Alves", valorConsultaPadrao: "225,5" });

    expect(criado).toMatchObject({
      nome: "Mariana Alves",
      status: "ATIVO",
      telefone: null,
      email: null,
      nascimento: null,
      observacoes: null,
      // Decimal sai como string com duas casas, nunca number.
      valorConsultaPadrao: "225.50",
    });
    expect((await listar()).itens.map((p) => p.id)).toEqual([criado.id]);
  });

  it.each([
    ["negativo", "-10"],
    ["com três casas", "150.555"],
    ["não numérico", "abc"],
    ["como number", 150],
  ])("valor inválido (%s): 422 apontando o campo, nada criado", async (_caso, valor) => {
    const resposta = await api("POST", "/pacientes", {
      nome: "Rafael Costa",
      valorConsultaPadrao: valor,
    });

    expect(resposta.statusCode).toBe(422);
    expect(resposta.headers["content-type"]).toContain("application/problem+json");
    expect(resposta.json().campos).toEqual([
      expect.objectContaining({ caminho: "valorConsultaPadrao" }),
    ]);
    expect(await prisma.paciente.count()).toBe(0);
  });

  it("nome ausente: 422 no campo nome", async () => {
    const resposta = await api("POST", "/pacientes", { valorConsultaPadrao: "150" });
    expect(resposta.statusCode).toBe(422);
    expect(resposta.json().campos[0].caminho).toBe("nome");
  });

  it("busca parcial ignora acento e caixa, e acha telefone pelos dígitos", async () => {
    const jose = await cadastrar({ nome: "José Conceição", telefone: "(83) 99812-4471" });
    await cadastrar({ nome: "Beatriz Lemos", telefone: "(83) 98888-0000" });

    expect((await listar("?busca=CONCEI")).itens.map((p) => p.id)).toEqual([jose.id]);
    expect((await listar("?busca=jose")).itens.map((p) => p.id)).toEqual([jose.id]);
    expect((await listar("?busca=99812")).itens.map((p) => p.id)).toEqual([jose.id]);
    expect((await listar("?busca=zzz")).itens).toEqual([]);
  });

  it("homônimos são aceitos", async () => {
    await cadastrar({ nome: "Ana Souza" });
    await cadastrar({ nome: "Ana Souza" });
    expect((await listar("?busca=ana souza")).total).toBe(2);
  });

  it("paginação com teto de 50 por página e total correto", async () => {
    await prisma.paciente.createMany({
      data: Array.from({ length: 55 }, (_, i) => ({
        nome: `Paciente ${String(i).padStart(2, "0")}`,
        valorConsultaPadrao: "100",
      })),
    });

    const primeira = await listar("?size=500");
    expect(primeira).toMatchObject({ total: 55, page: 1, size: 50 });
    expect(primeira.itens).toHaveLength(50);
    expect(primeira.itens[0].nome).toBe("Paciente 00");

    const segunda = await listar("?size=50&page=2");
    expect(segunda.itens.map((p) => p.nome)).toEqual([
      "Paciente 50",
      "Paciente 51",
      "Paciente 52",
      "Paciente 53",
      "Paciente 54",
    ]);

    const alemDoFim = await listar("?size=50&page=9");
    expect(alemDoFim).toMatchObject({ itens: [], total: 55 });
  });

  it("arquivar tira da listagem padrão; reativar volta com o valor anterior", async () => {
    const paciente = await cadastrar({ nome: "Carla Nunes", valorConsultaPadrao: "180" });

    expect((await api("POST", `/pacientes/${paciente.id}/arquivar`)).json().status).toBe(
      "ARQUIVADO",
    );
    expect((await listar()).itens).toEqual([]);
    expect((await listar("?status=ARQUIVADO")).itens.map((p) => p.id)).toEqual([paciente.id]);
    // Perfil continua acessível.
    expect((await api("GET", `/pacientes/${paciente.id}`)).statusCode).toBe(200);

    const reativado = (await api("POST", `/pacientes/${paciente.id}/reativar`)).json();
    expect(reativado).toMatchObject({ status: "ATIVO", valorConsultaPadrao: "180.00" });
    expect((await listar()).itens.map((p) => p.id)).toEqual([paciente.id]);
  });

  it("arquivar com agenda futura: 409 listando pendentes; com motivo, cancela e arquiva", async () => {
    const paciente = await cadastrar({ nome: "Carla Nunes" });
    const agendar = async (inicio: string, fim: string) =>
      (
        await api("POST", "/atendimentos", { pacienteId: paciente.id, inicio, fim })
      ).json() as { id: string };
    const passado = await agendar("2020-03-10T12:00:00Z", "2020-03-10T12:50:00Z");
    const futuro1 = await agendar("2030-03-10T12:00:00Z", "2030-03-10T12:50:00Z");
    const futuro2 = await agendar("2030-03-17T12:00:00Z", "2030-03-17T12:50:00Z");

    const semConfirmar = await api("POST", `/pacientes/${paciente.id}/arquivar`);
    expect(semConfirmar.statusCode).toBe(409);
    expect(semConfirmar.json().pendentes.map((p: { id: string }) => p.id)).toEqual([
      futuro1.id,
      futuro2.id,
    ]);
    expect((await prisma.paciente.findUniqueOrThrow({ where: { id: paciente.id } })).status).toBe(
      "ATIVO",
    );

    const escritasNosFuturos = () =>
      prisma.auditoria.count({
        where: {
          recursoTipo: "ATENDIMENTO",
          tipoEvento: "ESCRITA",
          recursoId: { in: [futuro1.id, futuro2.id] },
        },
      });
    const escritasAntes = await escritasNosFuturos();

    const confirmado = await api("POST", `/pacientes/${paciente.id}/arquivar`, {
      motivoCancelamento: "Encerramento do acompanhamento",
    });
    expect(confirmado.statusCode).toBe(200);
    expect(confirmado.json().status).toBe("ARQUIVADO");

    const historico = (await api("GET", `/atendimentos?pacienteId=${paciente.id}`)).json();
    type Item = { id: string; status: string; motivo: string | null };
    expect(historico.map((a: Item) => [a.id, a.status, a.motivo])).toEqual([
      // O passado ainda agendado não é tocado: não é agenda futura.
      [passado.id, "AGENDADO", null],
      [futuro1.id, "CANCELADO", "Encerramento do acompanhamento"],
      [futuro2.id, "CANCELADO", "Encerramento do acompanhamento"],
    ]);
    // A escrita do motivo em cada atendimento entra na trilha.
    expect(await escritasNosFuturos()).toBe(escritasAntes + 2);
  });

  it("edição parcial: ausente fica, null apaga, vazio apaga", async () => {
    const paciente = await cadastrar({
      nome: "Rafael Costa",
      telefone: "83 9999-0000",
      email: "rafael@exemplo.com",
    });

    const alterado = (
      await api("PATCH", `/pacientes/${paciente.id}`, {
        valorConsultaPadrao: "200",
        telefone: null,
        email: "",
      })
    ).json();

    expect(alterado).toMatchObject({
      nome: "Rafael Costa",
      telefone: null,
      email: null,
      valorConsultaPadrao: "200.00",
    });
  });

  it("não há exclusão, e id inexistente ou malformado não quebra", async () => {
    const paciente = await cadastrar({ nome: "Beatriz Lemos" });

    expect((await api("DELETE", `/pacientes/${paciente.id}`)).statusCode).toBe(404);
    expect(await prisma.paciente.count()).toBe(1);
    expect(
      (await api("GET", "/pacientes/0199a0e0-0000-7000-8000-000000000999")).statusCode,
    ).toBe(404);
    expect((await api("GET", "/pacientes/nao-e-uuid")).statusCode).toBe(400);
  });

  it("acesso ao perfil entra na trilha de auditoria", async () => {
    const paciente = await cadastrar({ nome: "Mariana Alves" });
    await api("GET", `/pacientes/${paciente.id}`);

    expect(
      await prisma.auditoria.count({
        where: { recursoTipo: "PACIENTE", recursoId: paciente.id, tipoEvento: "LEITURA" },
      }),
    ).toBe(1);
  });
});
