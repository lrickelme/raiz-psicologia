import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cobravel, encerramento } from "./cobranca";

/** Instante em São Paulo (UTC−3, sem horário de verão desde 2019). */
const sp = (dataHora: string) => new Date(`${dataHora}:00-03:00`);

describe("cobrabilidade", () => {
  describe("cancelamento", () => {
    it("no dia anterior não é cobrável: segunda 9h cancelada no domingo 23h", () => {
      expect(cobravel(sp("2030-03-18T09:00"), sp("2030-03-17T23:00"), "CANCELADO")).toBe(false);
    });

    it("no mesmo dia é cobrável, apesar de dez horas de aviso: segunda 18h cancelada na segunda 8h", () => {
      expect(cobravel(sp("2030-03-18T18:00"), sp("2030-03-18T08:00"), "CANCELADO")).toBe(true);
    });

    it("após o horário, no mesmo dia, é cobrável", () => {
      expect(cobravel(sp("2030-03-18T09:00"), sp("2030-03-18T11:00"), "CANCELADO")).toBe(true);
    });

    it("dias antes, com semanas de aviso, não é cobrável", () => {
      expect(cobravel(sp("2030-03-18T09:00"), sp("2030-03-01T09:00"), "CANCELADO")).toBe(false);
    });

    it("é por dia de calendário, não por 24 horas: 23h59 de véspera não é cobrável", () => {
      expect(cobravel(sp("2030-03-18T00:30"), sp("2030-03-17T23:59"), "CANCELADO")).toBe(false);
      expect(cobravel(sp("2030-03-18T23:30"), sp("2030-03-18T00:01"), "CANCELADO")).toBe(true);
    });
  });

  it("remarcação nunca é cobrável, nem no mesmo dia", () => {
    expect(cobravel(sp("2030-03-18T09:00"), sp("2030-03-18T08:00"), "REMARCADO")).toBe(false);
    expect(cobravel(sp("2030-03-18T09:00"), sp("2030-03-10T08:00"), "REMARCADO")).toBe(false);
  });

  it("falta é sempre cobrável", () => {
    expect(cobravel(sp("2030-03-18T09:00"), sp("2030-03-18T10:00"), "FALTA")).toBe(true);
    expect(cobravel(sp("2030-03-18T09:00"), sp("2030-03-20T10:00"), "FALTA")).toBe(true);
  });

  it("realizado é sempre cobrável", () => {
    expect(cobravel(sp("2030-03-18T09:00"), sp("2030-03-18T10:00"), "REALIZADO")).toBe(true);
    expect(cobravel(sp("2030-03-18T09:00"), sp("2030-03-25T10:00"), "REALIZADO")).toBe(true);
  });

  it("encerramento reúne status, instante e cobrabilidade para o mesmo UPDATE", () => {
    const agora = sp("2030-03-18T08:00");
    expect(encerramento(sp("2030-03-18T18:00"), "CANCELADO", agora)).toEqual({
      status: "CANCELADO",
      encerradoEm: agora,
      cobravel: true,
    });
  });
});

/**
 * A virada do dia é a de São Paulo, qualquer que seja o fuso do processo.
 * UTC é o caso comum de servidor; Tóquio, do outro lado do meridiano, pega
 * erro de sinal que UTC deixaria passar.
 */
describe.each(["UTC", "Asia/Tokyo", "America/Sao_Paulo"])("à meia-noite com TZ=%s", (tz) => {
  const original = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = tz;
  });
  afterAll(() => {
    process.env.TZ = original;
  });

  it("cancelada às 23h30 da véspera em SP — mesmo dia em UTC — não é cobrável", () => {
    // 17/03 23h30 em SP = 18/03 02h30 UTC: mesma data UTC da consulta.
    const encerradoEm = sp("2030-03-17T23:30");
    const inicio = sp("2030-03-18T09:00");
    expect(encerradoEm.toISOString().slice(0, 10)).toBe(inicio.toISOString().slice(0, 10));
    expect(cobravel(inicio, encerradoEm, "CANCELADO")).toBe(false);
  });

  it("cancelada às 00h05 do dia em SP é cobrável", () => {
    expect(cobravel(sp("2030-03-18T09:00"), sp("2030-03-18T00:05"), "CANCELADO")).toBe(true);
  });

  it("consulta às 22h cancelada às 21h do mesmo dia — dias diferentes em UTC — é cobrável", () => {
    // 18/03 22h em SP = 19/03 01h UTC; 21h em SP = 19/03 00h UTC. Em Tóquio,
    // os dois caem em 19/03 também; em SP, ambos em 18/03.
    expect(cobravel(sp("2030-03-18T22:00"), sp("2030-03-18T21:00"), "CANCELADO")).toBe(true);
  });

  it("consulta às 20h30 cancelada às 21h30 da véspera — datas UTC diferentes das de SP — não é cobrável", () => {
    // 17/03 21h30 SP = 18/03 00h30 UTC; 18/03 20h30 SP = 18/03 23h30 UTC.
    expect(cobravel(sp("2030-03-18T20:30"), sp("2030-03-17T21:30"), "CANCELADO")).toBe(false);
  });
});
