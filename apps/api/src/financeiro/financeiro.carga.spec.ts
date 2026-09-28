import {
  hojeLocal,
  instanteLocal,
  somarDias,
  type Receita,
  type ReceitaMensal,
  type ReceitaPorPaciente,
  type StatusAtendimento,
} from "@raiz/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { encerramento, type StatusEncerrado } from "../comum/cobranca/cobranca";
import { subirAmbiente, type Ambiente } from "../teste/ambiente";

const DIAS = 2 * 365;
const POR_DIA = 10;
const PACIENTES = 40;
/** Ciclo de status dos atendimentos já passados; os futuros ficam `AGENDADO`. */
const CICLO: StatusEncerrado[] = ["REALIZADO", "REALIZADO", "FALTA", "CANCELADO", "REMARCADO"];

/**
 * Dois anos de agenda cheia terminando no mês corrente (spec financeiro,
 * "Volume de dois anos"). Mede a API — é onde a agregação acontece.
 */
describe("financeiro com dois anos de atendimentos (carga)", () => {
  let amb: Ambiente;
  const hoje = hojeLocal();
  const de = somarDias(hoje, -(DIAS - 31));
  const ate = somarDias(hoje, 30);

  beforeAll(async () => {
    amb = await subirAmbiente();
    const pacientes = await amb.prisma.paciente.createManyAndReturn({
      data: Array.from({ length: PACIENTES }, (_, i) => ({
        nome: `Paciente ${String(i).padStart(2, "0")}`,
        valorConsultaPadrao: "150",
      })),
      select: { id: true },
    });

    const agora = new Date();
    const dados = [];
    for (let dia = 0; dia < DIAS; dia++) {
      const data = somarDias(de, dia);
      for (let slot = 0; slot < POR_DIA; slot++) {
        const inicio = instanteLocal(data, (8 + slot) * 60);
        const status: StatusAtendimento =
          inicio < agora ? CICLO[(dia + slot) % CICLO.length] : "AGENDADO";
        dados.push({
          pacienteId: pacientes[(dia * POR_DIA + slot) % PACIENTES].id,
          inicio,
          fim: new Date(inicio.getTime() + 50 * 60_000),
          valor: "150",
          ...(status !== "AGENDADO" && {
            // Cancelamentos uma hora antes do início: mesmo dia, cobráveis.
            ...encerramento(inicio, status, new Date(inicio.getTime() - 60 * 60_000)),
            motivo: status === "REALIZADO" ? null : "Motivo.",
          }),
        });
      }
    }
    await amb.prisma.atendimento.createMany({ data: dados });
    await amb.prisma.$executeRawUnsafe("ANALYZE atendimento");
  }, 300_000);

  afterAll(() => amb?.encerrar());

  async function cronometrado<T>(url: string): Promise<{ corpo: T; ms: number }> {
    const inicio = performance.now();
    const resposta = await amb.api("GET", url);
    const ms = performance.now() - inicio;
    expect(resposta.statusCode).toBe(200);
    return { corpo: resposta.json(), ms };
  }

  it("receita dos dois anos, abaixo de 2 s e igual à contagem de cobráveis", async () => {
    expect(await amb.prisma.atendimento.count()).toBe(DIAS * POR_DIA);
    const cobraveis = await amb.prisma.atendimento.count({
      where: { cobravel: true, cobrancaDispensada: false },
    });

    const { corpo, ms } = await cronometrado<Receita>(`/financeiro/receita?de=${de}&ate=${ate}`);

    expect(corpo.realizada).toBe(`${cobraveis * 150}.00`);
    expect(corpo.prevista).not.toBeNull();
    expect(ms).toBeLessThan(2000);
  });

  it("série de 24 meses, abaixo de 2 s", async () => {
    const { corpo, ms } = await cronometrado<ReceitaMensal[]>("/financeiro/mensal?meses=24");
    expect(corpo).toHaveLength(24);
    expect(corpo.at(-1)!.mes).toBe(hoje.slice(0, 7));
    expect(ms).toBeLessThan(2000);
  });

  it("por paciente nos dois anos: uma linha por paciente, abaixo de 2 s", async () => {
    const { corpo, ms } = await cronometrado<ReceitaPorPaciente[]>(
      `/financeiro/por-paciente?de=${de}&ate=${ate}`,
    );
    expect(corpo).toHaveLength(PACIENTES);
    const total = corpo.reduce((soma, l) => soma + Object.values(l.contagem).reduce((a, b) => a + b), 0);
    expect(total).toBe(DIAS * POR_DIA);
    expect(ms).toBeLessThan(2000);
  });

  it("dashboard aberto: as três apurações em paralelo, abaixo de 2 s", async () => {
    const inicio = performance.now();
    await Promise.all([
      cronometrado(`/financeiro/receita?de=${de}&ate=${ate}`),
      cronometrado("/financeiro/mensal"),
      cronometrado(`/financeiro/por-paciente?de=${de}&ate=${ate}`),
    ]);
    expect(performance.now() - inicio).toBeLessThan(2000);
  });
});
