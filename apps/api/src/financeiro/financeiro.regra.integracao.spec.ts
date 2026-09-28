import type { Atendimento, Paciente } from "@raiz/shared";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type * as Cobranca from "../comum/cobranca/cobranca";
import { subirAmbiente, type Ambiente } from "../teste/ambiente";

/**
 * "Versão futura do sistema" com outra regra de cobrança: a mesma função, com
 * o resultado invertido quando `regra.invertida`. O módulo é trocado para a
 * aplicação inteira, então os encerramentos pela API passam a seguir a regra
 * nova — e a receita já apurada precisa continuar igual.
 */
const regra = vi.hoisted(() => ({ invertida: false }));

vi.mock("../comum/cobranca/cobranca", async (importOriginal) => {
  const real = await importOriginal<typeof Cobranca>();
  const cobravel: typeof real.cobravel = (...args) =>
    regra.invertida ? !real.cobravel(...args) : real.cobravel(...args);
  const encerramento: typeof real.encerramento = (inicio, status, agora = new Date()) => ({
    status,
    encerradoEm: agora,
    cobravel: cobravel(inicio, agora, status),
  });
  return { ...real, cobravel, encerramento };
});

const sp = (dataHora: string) => new Date(`${dataHora}:00-03:00`).toISOString();

describe("receita de mês fechado após mudança da regra de cobrança (integração)", () => {
  let amb: Ambiente;
  let paciente: Paciente;

  beforeAll(async () => {
    amb = await subirAmbiente();
    paciente = (
      await amb.api("POST", "/pacientes", { nome: "Mariana Alves", valorConsultaPadrao: "150" })
    ).json();
  }, 180_000);

  afterAll(() => amb?.encerrar());

  async function agendado(inicio: string, fim: string): Promise<Atendimento> {
    const resposta = await amb.api("POST", "/atendimentos", {
      pacienteId: paciente.id,
      inicio: sp(inicio),
      fim: sp(fim),
    });
    expect(resposta.statusCode).toBe(201);
    return resposta.json();
  }

  const receita = async (de: string, ate: string) =>
    (await amb.api("GET", `/financeiro/receita?de=${de}&ate=${ate}`)).json().realizada;

  it("a receita apurada não muda; só os encerramentos novos seguem a regra nova", async () => {
    // Janeiro, pela regra vigente: dois realizados cobráveis e um cancelamento
    // em outro dia, não cobrável.
    for (const dia of ["05", "06"]) {
      const a = await agendado(`2026-01-${dia}T09:00`, `2026-01-${dia}T09:50`);
      await amb.api("POST", `/atendimentos/${a.id}/realizar`);
    }
    const cancelado = await agendado("2026-01-07T09:00", "2026-01-07T09:50");
    await amb.api("POST", `/atendimentos/${cancelado.id}/cancelar`, { motivo: "Avisou depois." });
    expect(await receita("2026-01-01", "2026-01-31")).toBe("300.00");

    regra.invertida = true;

    // Janeiro não é reapurado com a regra nova.
    expect(await receita("2026-01-01", "2026-01-31")).toBe("300.00");

    // A troca é real: um encerramento feito agora segue a regra invertida.
    const novo = await agendado("2026-02-02T09:00", "2026-02-02T09:50");
    await amb.api("POST", `/atendimentos/${novo.id}/realizar`);
    const gravado = await amb.prisma.atendimento.findUniqueOrThrow({ where: { id: novo.id } });
    expect(gravado.cobravel).toBe(false);
    expect(await receita("2026-02-01", "2026-02-28")).toBe("0.00");
  });
});
