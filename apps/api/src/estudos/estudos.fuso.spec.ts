import type { QuadroEstudos, Topico } from "@raiz/shared";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { subirAmbiente, type Ambiente } from "../teste/ambiente";

const sp = (dataHora: string) => new Date(`${dataHora}:00-03:00`);

/**
 * "Concluídos este mês" no mês de São Paulo com o processo em outro fuso (spec
 * estudos, "Virada de mês no fuso local"). Tóquio pega erro de sinal que UTC
 * deixaria passar.
 */
describe.each(["UTC", "Asia/Tokyo"])("estudos com TZ=%s (integração)", (tz) => {
  let amb: Ambiente;
  const tzOriginal = process.env.TZ;

  beforeAll(async () => {
    process.env.TZ = tz;
    amb = await subirAmbiente();
  }, 180_000);

  afterAll(async () => {
    vi.useRealTimers();
    await amb?.encerrar();
    process.env.TZ = tzOriginal;
  });

  it("o processo está mesmo no outro fuso", () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(tz);
  });

  it("concluído às 22h de 30/09 em São Paulo conta em setembro", async () => {
    // 31/08 23h em SP já é setembro em UTC: não pode contar.
    await amb.prisma.topicoEstudo.create({
      data: { titulo: "Agosto", status: "CONCLUIDO", concluidoEm: sp("2026-08-31T23:00") },
    });

    vi.useFakeTimers({ toFake: ["Date"], now: sp("2026-09-30T22:00") });
    const topico: Topico = (await amb.api("POST", "/topicos", { titulo: "Setembro" })).json();
    const concluido: Topico = (
      await amb.api("POST", `/topicos/${topico.id}/mover`, { status: "CONCLUIDO" })
    ).json();
    expect(concluido.concluidoEm).toBe("2026-10-01T01:00:00.000Z");

    // Dentro dos 30 min de inatividade da sessão, que conta pelo relógio falso.
    vi.setSystemTime(sp("2026-09-30T22:20"));
    const quadro: QuadroEstudos = (await amb.api("GET", "/estudos/quadro")).json();
    expect(quadro.totalConcluidos).toBe(2);
    expect(quadro.concluidosNoMes).toBe(1);
  });
});
