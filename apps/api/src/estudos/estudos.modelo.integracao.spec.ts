import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { subirAmbiente, type Ambiente } from "../teste/ambiente";
import { LABELS_INICIAIS, reiniciarEstudos } from "../teste/estudos";

/** Garantias do banco, exercidas sem passar pela API. */
describe("estudos: modelo (integração)", () => {
  let amb: Ambiente;

  beforeAll(async () => {
    amb = await subirAmbiente();
  }, 180_000);

  afterAll(() => amb?.encerrar());

  it("a migration instala Alta, Média e Baixa, nessa ordem e com essas cores", async () => {
    const labels = await amb.prisma.labelPrioridade.findMany({ orderBy: { ordem: "asc" } });
    expect(labels.map(({ id, nome, cor, ordem }) => ({ id, nome, cor, ordem }))).toEqual([
      { id: LABELS_INICIAIS.alta, nome: "Alta", cor: "VINHO", ordem: 1 },
      { id: LABELS_INICIAIS.media, nome: "Média", cor: "AMBAR", ordem: 2 },
      { id: LABELS_INICIAIS.baixa, nome: "Baixa", cor: "MUSGO", ordem: 3 },
    ]);
  });

  describe("CHECK topico_conclusao_coerente", () => {
    it("recusa CONCLUIDO sem concluido_em", async () => {
      await expect(
        amb.prisma.topicoEstudo.create({ data: { titulo: "Sem data", status: "CONCLUIDO" } }),
      ).rejects.toThrow(/topico_conclusao_coerente/);
    });

    it("recusa A_ESTUDAR com concluido_em", async () => {
      await expect(
        amb.prisma.topicoEstudo.create({
          data: { titulo: "Com data", status: "A_ESTUDAR", concluidoEm: new Date() },
        }),
      ).rejects.toThrow(/topico_conclusao_coerente/);
    });

    it("recusa também um UPDATE que deixa só um dos lados", async () => {
      const topico = await amb.prisma.topicoEstudo.create({
        data: { titulo: "Concluído", status: "CONCLUIDO", concluidoEm: new Date() },
      });
      await expect(
        amb.prisma.topicoEstudo.update({ where: { id: topico.id }, data: { status: "EM_ESTUDO" } }),
      ).rejects.toThrow(/topico_conclusao_coerente/);
    });
  });

  describe("nome de label único sem caixa nem acento", () => {
    it.each(["alta", "Álta", "ALTA"])("recusa %s diante de Alta", async (nome) => {
      await reiniciarEstudos(amb.prisma);
      const erro = await amb.prisma.labelPrioridade
        .create({ data: { nome, cor: "BEGE", ordem: 4 } })
        .catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
      expect((erro as Prisma.PrismaClientKnownRequestError).code).toBe("P2002");
    });
  });
});
