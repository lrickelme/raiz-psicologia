import { readdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { PrismaClient, type StatusAtendimento } from "@prisma/client";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cobravel, type StatusEncerrado } from "../comum/cobranca/cobranca";
import { IMAGEM_POSTGRES } from "../teste/imagem-postgres";

const MIGRATIONS = join(__dirname, "../../prisma/migrations");
const BACKFILL = readdirSync(MIGRATIONS).find((nome) => nome.endsWith("_cobranca_backfill"))!;

const sp = (dataHora: string) => new Date(`${dataHora}:00-03:00`);

type Caso = {
  nome: string;
  status: StatusAtendimento;
  inicio: Date;
  /** Registro da transição na trilha, se houver. */
  trilha?: { em: Date; rota?: string; operacao?: string };
  esperado: { cobravel: boolean | null; encerradoEm: Date | null };
};

const ROTA = (acao: string) => `/api/v1/atendimentos/:id/${acao}`;

const CASOS: Caso[] = [
  {
    nome: "cancelado no dia, com trilha",
    status: "CANCELADO",
    inicio: sp("2026-03-16T18:00"),
    trilha: { em: sp("2026-03-16T08:00"), rota: ROTA("cancelar") },
    esperado: { cobravel: true, encerradoEm: sp("2026-03-16T08:00") },
  },
  {
    // 23h30 de SP já é o dia seguinte em UTC — a data da consulta.
    nome: "cancelado na véspera às 23h30, com trilha",
    status: "CANCELADO",
    inicio: sp("2026-03-17T09:00"),
    trilha: { em: sp("2026-03-16T23:30"), rota: ROTA("cancelar") },
    esperado: { cobravel: false, encerradoEm: sp("2026-03-16T23:30") },
  },
  {
    nome: "cancelado pelo arquivamento do paciente",
    status: "CANCELADO",
    inicio: sp("2026-03-20T10:00"),
    trilha: { em: sp("2026-03-18T15:00"), operacao: "cancelamento por arquivamento do paciente" },
    esperado: { cobravel: false, encerradoEm: sp("2026-03-18T15:00") },
  },
  {
    nome: "cancelado sem trilha",
    status: "CANCELADO",
    inicio: sp("2026-02-02T09:00"),
    esperado: { cobravel: null, encerradoEm: null },
  },
  {
    nome: "realizado com trilha",
    status: "REALIZADO",
    inicio: sp("2026-03-09T09:00"),
    trilha: { em: sp("2026-03-09T10:05"), rota: ROTA("realizar") },
    esperado: { cobravel: true, encerradoEm: sp("2026-03-09T10:05") },
  },
  {
    nome: "realizado sem trilha",
    status: "REALIZADO",
    inicio: sp("2026-02-09T09:00"),
    esperado: { cobravel: true, encerradoEm: null },
  },
  {
    nome: "falta com trilha",
    status: "FALTA",
    inicio: sp("2026-03-10T09:00"),
    trilha: { em: sp("2026-03-12T09:00"), rota: ROTA("falta") },
    esperado: { cobravel: true, encerradoEm: sp("2026-03-12T09:00") },
  },
  {
    nome: "remarcado no dia, com trilha",
    status: "REMARCADO",
    inicio: sp("2026-03-11T14:00"),
    trilha: { em: sp("2026-03-11T08:00"), rota: ROTA("remarcar") },
    esperado: { cobravel: false, encerradoEm: sp("2026-03-11T08:00") },
  },
  {
    nome: "remarcado sem trilha",
    status: "REMARCADO",
    inicio: sp("2026-02-11T14:00"),
    esperado: { cobravel: false, encerradoEm: null },
  },
  {
    // A criação do atendimento também é ESCRITA na trilha, mas não encerra.
    nome: "cancelado cuja única trilha é a criação",
    status: "CANCELADO",
    inicio: sp("2026-02-16T09:00"),
    trilha: { em: sp("2026-02-01T09:00"), rota: "/api/v1/atendimentos" },
    esperado: { cobravel: null, encerradoEm: null },
  },
  {
    nome: "agendado",
    status: "AGENDADO",
    inicio: sp("2030-01-07T09:00"),
    esperado: { cobravel: null, encerradoEm: null },
  },
];

/**
 * Executa o arquivo da migration `cobranca_backfill` sobre atendimentos
 * encerrados antes da change 03. O `migrate deploy` roda com a tabela vazia;
 * aqui os atendimentos e a trilha são inseridos no estado antigo — encerrados
 * sem cobrabilidade — e o SQL roda de novo, exatamente como está no repositório.
 */
describe("migration cobranca_backfill (integração)", () => {
  let banco: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let saida: string;
  const ids = new Map<string, string>();

  async function rodarBackfill(): Promise<string> {
    const sql = readFileSync(join(MIGRATIONS, BACKFILL, "migration.sql"), "utf8");
    const resultado = await banco.exec([
      "psql", "-v", "ON_ERROR_STOP=1",
      "-U", banco.getUsername(), "-d", banco.getDatabase(), "-c", sql,
    ]);
    expect(resultado.exitCode, resultado.output).toBe(0);
    return resultado.output;
  }

  beforeAll(async () => {
    banco = await new PostgreSqlContainer(IMAGEM_POSTGRES).start();
    execFileSync("npx", ["prisma", "migrate", "deploy"], {
      env: { ...process.env, DATABASE_URL: banco.getConnectionUri() },
      stdio: "ignore",
    });
    prisma = new PrismaClient({ datasourceUrl: banco.getConnectionUri() });

    const paciente = await prisma.paciente.create({
      data: { nome: "Legado", valorConsultaPadrao: "150" },
    });
    for (const caso of CASOS) {
      const { id } = await prisma.atendimento.create({
        data: {
          pacienteId: paciente.id,
          inicio: caso.inicio,
          fim: new Date(caso.inicio.getTime() + 50 * 60_000),
          valor: "150",
          status: caso.status,
          // Motivo em claro: este cliente não tem a extensão, e o backfill não o lê.
          motivo: ["CANCELADO", "REMARCADO", "FALTA"].includes(caso.status) ? "legado" : null,
        },
        select: { id: true },
      });
      ids.set(caso.nome, id);
      if (caso.trilha) {
        await prisma.auditoria.create({
          data: {
            ocorridoEm: caso.trilha.em,
            tipoEvento: "ESCRITA",
            recursoTipo: "ATENDIMENTO",
            recursoId: id,
            ip: "198.51.100.1",
            detalhe: caso.trilha.operacao
              ? { operacao: caso.trilha.operacao }
              : { metodo: "POST", rota: caso.trilha.rota! },
          },
        });
      }
    }
    saida = await rodarBackfill();
  }, 180_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await banco?.stop();
  });

  async function estado(nome: string) {
    return prisma.atendimento.findUniqueOrThrow({
      where: { id: ids.get(nome)! },
      select: { cobravel: true, encerradoEm: true },
    });
  }

  it.each(CASOS.map((c) => [c.nome, c] as const))("%s", async (nome, caso) => {
    expect(await estado(nome)).toEqual(caso.esperado);
  });

  it("o SQL decide igual à função pura sempre que há instante na trilha", () => {
    for (const caso of CASOS.filter((c) => c.status !== "AGENDADO" && c.esperado.encerradoEm)) {
      expect(cobravel(caso.inicio, caso.trilha!.em, caso.status as StatusEncerrado), caso.nome).toBe(
        caso.esperado.cobravel,
      );
    }
  });

  it("lista os cancelamentos sem trilha, e só eles", () => {
    expect(saida).toContain("Cancelamentos sem registro na trilha, com cobravel nulo até decisão");
    expect(saida).toContain(ids.get("cancelado sem trilha"));
    expect(saida).toContain(ids.get("cancelado cuja única trilha é a criação"));
    expect(saida).toContain("02/02/2026 09:00");
    expect(saida).not.toContain(ids.get("cancelado no dia, com trilha"));
    expect(saida).toMatch(/2 atendimento\(s\) realizado\(s\), com falta ou remarcado\(s\) sem registro na trilha/);
  });

  it("reexecutar não altera o que já foi decidido, nem uma decisão manual posterior", async () => {
    // A profissional decide um dos pendentes; a migration roda de novo.
    await prisma.atendimento.update({
      where: { id: ids.get("cancelado sem trilha")! },
      data: { cobravel: false },
    });
    const antes = await prisma.atendimento.findMany({
      select: { id: true, cobravel: true, encerradoEm: true },
      orderBy: { id: "asc" },
    });

    await rodarBackfill();

    expect(
      await prisma.atendimento.findMany({
        select: { id: true, cobravel: true, encerradoEm: true },
        orderBy: { id: "asc" },
      }),
    ).toEqual(antes);
  });
});
