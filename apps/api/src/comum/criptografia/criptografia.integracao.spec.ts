import "reflect-metadata";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaService } from "../../prisma/prisma.service";
import { carregarChave, cifrar, decifrar, VARIAVEL_CHAVE } from "./cifra";
import { criptografiaDeColuna } from "./extensao";

const CHAVE = carregarChave();
const TEXTO = "Paciente pediu para remarcar: internação da mãe";

/**
 * O modelo `Atendimento`, dono do primeiro campo cifrado real, chega na tarefa
 * 6.1. A extensão é genérica por modelo, então aqui ela cifra `Usuario.nome`
 * só para exercitar o caminho completo contra um Postgres real.
 */
function clienteCifrado(url: string) {
  return new PrismaClient({ datasourceUrl: url }).$extends(
    criptografiaDeColuna({ Usuario: ["nome"] }, CHAVE),
  );
}

describe("criptografia de coluna (integração)", () => {
  let banco: StartedPostgreSqlContainer;
  let prisma: ReturnType<typeof clienteCifrado>;

  beforeAll(async () => {
    banco = await new PostgreSqlContainer("postgres:16-alpine").start();
    execFileSync("npx", ["prisma", "migrate", "deploy"], {
      env: { ...process.env, DATABASE_URL: banco.getConnectionUri() },
      stdio: "ignore",
    });
    prisma = clienteCifrado(banco.getConnectionUri());
  }, 180_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await banco?.stop();
  });

  async function colunaCrua(id: string): Promise<string> {
    const [linha] = await prisma.$queryRaw<{ nome: string }[]>`
      SELECT nome FROM usuario WHERE id = ${id}::uuid`;
    return linha.nome;
  }

  it("grava ilegível na coluna e devolve em claro pela extensão", async () => {
    const criado = await prisma.usuario.create({
      data: { email: "a@exemplo.com", nome: TEXTO, senhaHash: "x" },
    });

    const cru = await colunaCrua(criado.id);
    expect(cru).not.toContain(TEXTO);
    expect(cru).not.toContain("internação");
    expect(cru).toMatch(/^v1\./);

    expect(criado.nome).toBe(TEXTO);
    expect((await prisma.usuario.findUniqueOrThrow({ where: { id: criado.id } })).nome).toBe(TEXTO);
  });

  it("cifra também em update, upsert e createMany, e decifra via include", async () => {
    const { id } = await prisma.usuario.create({
      data: { email: "b@exemplo.com", nome: "inicial", senhaHash: "x" },
    });
    await prisma.usuario.update({ where: { id }, data: { nome: { set: TEXTO } } });
    expect(await colunaCrua(id)).not.toContain(TEXTO);

    await prisma.usuario.upsert({
      where: { email: "c@exemplo.com" },
      create: { email: "c@exemplo.com", nome: TEXTO, senhaHash: "x" },
      update: {},
    });
    await prisma.usuario.createMany({
      data: [{ email: "d@exemplo.com", nome: TEXTO, senhaHash: "x" }],
    });
    const [crus] = await prisma.$queryRaw<{ claros: bigint }[]>`
      SELECT count(*) AS claros FROM usuario WHERE nome = ${TEXTO}`;
    expect(crus.claros).toBe(0n);

    // Registro cifrado chegando por relação de outro modelo.
    await prisma.sessao.create({
      data: { usuarioId: id, tokenHash: "h", expiraEm: new Date() },
    });
    const sessao = await prisma.sessao.findFirstOrThrow({ include: { usuario: true } });
    expect(sessao.usuario.nome).toBe(TEXTO);
  });

  it("recusa filtro por campo cifrado e escrita aninhada que gravaria em claro", async () => {
    await expect(prisma.usuario.findMany({ where: { nome: TEXTO } })).rejects.toThrow(
      /não pode ser filtrado/,
    );
    await expect(
      prisma.sessao.create({
        data: {
          tokenHash: "h2",
          expiraEm: new Date(),
          usuario: { create: { email: "e@exemplo.com", nome: TEXTO, senhaHash: "x" } },
        },
      }),
    ).rejects.toThrow(/Escrita aninhada/);
  });
});

describe("cifra", () => {
  it("valor copiado para outra coluna não decifra", () => {
    const cifrado = cifrar(TEXTO, CHAVE, "Atendimento.motivo");
    expect(decifrar(cifrado, CHAVE, "Atendimento.motivo")).toBe(TEXTO);
    expect(() => decifrar(cifrado, CHAVE, "Evolucao.texto")).toThrow();
  });

  it("valor em claro na coluna é erro, não é devolvido como veio", () => {
    expect(() => decifrar(TEXTO, CHAVE, "Atendimento.motivo")).toThrow(/formato cifrado/);
  });

  it("sem a chave, ou com tamanho errado, a API não sobe", () => {
    expect(() => carregarChave({})).toThrow(VARIAVEL_CHAVE);
    expect(() => carregarChave({ [VARIAVEL_CHAVE]: "curta" })).toThrow(/32 bytes/);

    // O Nest constrói o PrismaService no boot; lançar aqui aborta a subida.
    // Vazia e não apagada: o PrismaClient carrega o .env ao ser construído e
    // repõe variável ausente, mas não sobrescreve uma existente.
    const chave = process.env[VARIAVEL_CHAVE];
    process.env[VARIAVEL_CHAVE] = "";
    try {
      expect(() => new PrismaService()).toThrow(VARIAVEL_CHAVE);
    } finally {
      process.env[VARIAVEL_CHAVE] = chave;
    }
  });
});
