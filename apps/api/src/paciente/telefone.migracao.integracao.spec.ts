import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { IMAGEM_POSTGRES } from "../teste/imagem-postgres";

const MIGRATIONS = join(__dirname, "../../prisma/migrations");
const MIGRATION = readdirSync(MIGRATIONS).find((nome) => nome.endsWith("_telefone_digitos"))!;

/** Telefone como estava gravado antes → como deve ficar. */
const LEGADOS: [string | null, string | null][] = [
  ["(83) 99812-4471", "83998124471"],
  ["83 3221-4567", "8332214567"],
  ["+55 (83) 99322-9097", "83993229097"],
  ["+55 55 99999-8888", "55999998888"],
  ["(55) 99999-8888", "55999998888"],
  ["83993229097", "83993229097"],
  ["", null],
  ["  -  ", null],
  [null, null],
  // Fora de 10 ou 11 dígitos: mantido com os dígitos que tem, nunca perdido.
  ["3221-4567", "32214567"],
  ["ramal 22", "22"],
];

/**
 * Executa o arquivo da migration `telefone_digitos` sobre dados legados. O
 * `migrate deploy` roda com a tabela ainda vazia; aqui a constraint é
 * retirada, os formatos antigos são inseridos e o SQL da migration roda de
 * novo, exatamente como está no repositório.
 */
describe("migration telefone_digitos (integração)", () => {
  let banco: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let saida: string;

  beforeAll(async () => {
    banco = await new PostgreSqlContainer(IMAGEM_POSTGRES).start();
    execFileSync("npx", ["prisma", "migrate", "deploy"], {
      env: { ...process.env, DATABASE_URL: banco.getConnectionUri() },
      stdio: "ignore",
    });
    prisma = new PrismaClient({ datasourceUrl: banco.getConnectionUri() });

    await prisma.$executeRawUnsafe(
      'ALTER TABLE "paciente" DROP CONSTRAINT "paciente_telefone_digitos"',
    );
    for (const [i, [telefone]] of LEGADOS.entries()) {
      await prisma.$executeRaw`
        INSERT INTO paciente (id, nome, telefone, valor_consulta_padrao, atualizado_em)
        VALUES (gen_random_uuid(), ${`Legado ${i}`}, ${telefone}, 150, now())`;
    }

    const sql = readFileSync(join(MIGRATIONS, MIGRATION, "migration.sql"), "utf8");
    const resultado = await banco.exec([
      "psql", "-v", "ON_ERROR_STOP=1",
      "-U", banco.getUsername(), "-d", banco.getDatabase(), "-c", sql,
    ]);
    expect(resultado.exitCode, resultado.output).toBe(0);
    saida = resultado.output;
  }, 180_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await banco?.stop();
  });

  it("todos passam a conter só dígitos, sem perder registro", async () => {
    const pacientes = await prisma.paciente.findMany({ select: { nome: true, telefone: true } });
    expect(pacientes).toHaveLength(LEGADOS.length);

    const porNome = new Map(pacientes.map((p) => [p.nome, p.telefone]));
    expect(LEGADOS.map((_, i) => porNome.get(`Legado ${i}`))).toEqual(
      LEGADOS.map(([, esperado]) => esperado),
    );
  });

  it("avisa quantos ficaram fora de 10 ou 11 dígitos", () => {
    expect(saida).toMatch(/2 paciente\(s\) com telefone fora de 10 ou 11 dígitos/);
  });

  it("depois dela, o banco recusa telefone com máscara", async () => {
    await expect(
      prisma.$executeRaw`
        INSERT INTO paciente (id, nome, telefone, valor_consulta_padrao, atualizado_em)
        VALUES (gen_random_uuid(), 'Novo', '(83) 99322-9097', 150, now())`,
    ).rejects.toThrow(/paciente_telefone_digitos/);
  });
});
