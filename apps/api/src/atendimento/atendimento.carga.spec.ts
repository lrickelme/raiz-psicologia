import type { Atendimento } from "@raiz/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { subirAmbiente, type Ambiente } from "../teste/ambiente";

const DIAS = 2 * 365;
const POR_DIA = 10;

/**
 * Dois anos de agenda cheia (spec agenda, "Carregamento por período"). O que
 * se mede é a API, que é onde o volume pesa: a interface recebe só a janela.
 */
describe("agenda com dois anos de atendimentos (carga)", () => {
  let amb: Ambiente;

  beforeAll(async () => {
    amb = await subirAmbiente();
    const paciente = await amb.prisma.paciente.create({
      data: { nome: "Paciente de carga", valorConsultaPadrao: "150" },
    });

    const inicioBase = Date.parse("2028-01-01T11:00:00Z"); // 08h em SP
    const dados = [];
    for (let dia = 0; dia < DIAS; dia++) {
      for (let slot = 0; slot < POR_DIA; slot++) {
        const inicio = new Date(inicioBase + dia * 86_400_000 + slot * 60 * 60_000);
        dados.push({
          pacienteId: paciente.id,
          inicio,
          fim: new Date(inicio.getTime() + 50 * 60_000),
          valor: "150",
          status: slot % 4 === 0 ? ("REALIZADO" as const) : ("AGENDADO" as const),
        });
      }
    }
    await amb.prisma.atendimento.createMany({ data: dados });
    await amb.prisma.$executeRawUnsafe("ANALYZE atendimento");
  }, 300_000);

  afterAll(() => amb?.encerrar());

  it.each([
    ["dia", "2029-06-12", "2029-06-12", 1],
    ["semana", "2029-06-11", "2029-06-17", 7],
    ["mês com margem", "2029-05-27", "2029-07-07", 42],
  ])("visão de %s: só a janela, abaixo de 2 s", async (_visao, de, ate, dias) => {
    expect(await amb.prisma.atendimento.count()).toBe(DIAS * POR_DIA);

    const inicio = performance.now();
    const resposta = await amb.api("GET", `/atendimentos?de=${de}&ate=${ate}`);
    const decorridoMs = performance.now() - inicio;

    expect(resposta.statusCode).toBe(200);
    expect((resposta.json() as Atendimento[]).length).toBe(dias * POR_DIA);
    expect(decorridoMs).toBeLessThan(2000);
  });
});
