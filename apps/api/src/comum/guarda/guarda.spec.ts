import { describe, expect, it } from "vitest";
import { dataDeElegibilidade } from "./guarda";

/** `@db.Date` chega do Prisma como meia-noite UTC. */
const data = (dia: string) => new Date(`${dia}T00:00:00Z`);

describe("data de elegibilidade para descarte", () => {
  it("conta o prazo a partir do último registro", () => {
    const registro = new Date("2024-03-10T14:00:00-03:00");
    expect(dataDeElegibilidade(registro, data("1990-06-01"), 20)).toBe("2044-03-10");
  });

  it("usa a data do registro no fuso da clínica, não em UTC", () => {
    // 22:30 de 10/03 em São Paulo já é 11/03 em UTC.
    const registro = new Date("2024-03-11T01:30:00Z");
    expect(dataDeElegibilidade(registro, data("1990-06-01"), 20)).toBe("2044-03-10");
  });

  it("respeita o prazo configurado", () => {
    const registro = new Date("2024-03-10T14:00:00-03:00");
    expect(dataDeElegibilidade(registro, data("1990-06-01"), 5)).toBe("2029-03-10");
  });

  it("sem data de nascimento, conta do último registro", () => {
    const registro = new Date("2024-03-10T14:00:00-03:00");
    expect(dataDeElegibilidade(registro, null, 20)).toBe("2044-03-10");
  });

  describe("paciente que era menor de idade", () => {
    it("com 15 anos no último registro, conta a partir dos 18", () => {
      const registro = new Date("2024-08-01T10:00:00-03:00");
      expect(dataDeElegibilidade(registro, data("2009-05-20"), 20)).toBe("2047-05-20");
    });

    it("já maior no último registro, conta do registro mesmo tendo sido atendido menor", () => {
      const registro = new Date("2030-01-15T10:00:00-03:00");
      expect(dataDeElegibilidade(registro, data("2009-05-20"), 20)).toBe("2050-01-15");
    });

    it("nascido em 29/02 completa 18 anos em 01/03 quando o ano não é bissexto", () => {
      const registro = new Date("2020-03-10T10:00:00-03:00");
      expect(dataDeElegibilidade(registro, data("2008-02-29"), 20)).toBe("2046-03-01");
    });
  });

  it("prazo iniciado em 29/02 vence em 01/03, nunca antes do prazo completo", () => {
    const registro = new Date("2024-02-29T10:00:00-03:00");
    expect(dataDeElegibilidade(registro, null, 5)).toBe("2029-03-01");
  });

  describe("reativação com novo registro", () => {
    it("recalcula a partir do novo registro", () => {
      const nascimento = data("1990-06-01");
      const arquivado = new Date("2024-03-10T14:00:00-03:00");
      const reativado = new Date("2026-09-26T09:00:00-03:00");

      expect(dataDeElegibilidade(arquivado, nascimento, 20)).toBe("2044-03-10");
      expect(dataDeElegibilidade(reativado, nascimento, 20)).toBe("2046-09-26");
    });

    it("de paciente que era menor, passa a contar do novo registro quando ele já é maior", () => {
      const nascimento = data("2009-05-20");
      const menor = new Date("2024-08-01T10:00:00-03:00");
      const reativado = new Date("2029-02-10T10:00:00-03:00");

      expect(dataDeElegibilidade(menor, nascimento, 20)).toBe("2047-05-20");
      expect(dataDeElegibilidade(reativado, nascimento, 20)).toBe("2049-02-10");
    });
  });
});
