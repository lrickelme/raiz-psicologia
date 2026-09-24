import {
  hojeLocal,
  inicioDaSemana,
  intervaloDosDias,
  type Atendimento,
  type Paciente,
} from "@raiz/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { subirAmbiente, type Ambiente } from "../teste/ambiente";

/**
 * "Hoje" e "esta semana" resolvidos em São Paulo com o processo em outro fuso
 * (spec agenda, "Correção de horário local"). UTC é o caso da spec; Tóquio,
 * do outro lado do meridiano, pega erro de sinal que UTC deixaria passar.
 */
describe.each(["UTC", "Asia/Tokyo"])("fuso com TZ=%s (integração)", (tz) => {
  let amb: Ambiente;
  let paciente: Paciente;
  const tzOriginal = process.env.TZ;

  beforeAll(async () => {
    process.env.TZ = tz;
    amb = await subirAmbiente();
    paciente = (
      await amb.api("POST", "/pacientes", { nome: "Rafael Costa", valorConsultaPadrao: "150" })
    ).json();

    const agendar = (inicio: string, fim: string) =>
      amb.api("POST", "/atendimentos", { pacienteId: paciente.id, inicio, fim });
    // Quinta 14/03/2030, 23h em SP = sexta 02h UTC.
    await agendar("2030-03-14T23:00:00-03:00", "2030-03-14T23:50:00-03:00");
    await agendar("2030-03-15T00:00:00-03:00", "2030-03-15T00:50:00-03:00");
    // Domingo 17/03 23h e segunda 18/03 00h: virada da semana.
    await agendar("2030-03-17T23:00:00-03:00", "2030-03-17T23:50:00-03:00");
    await agendar("2030-03-18T00:00:00-03:00", "2030-03-18T00:50:00-03:00");
  }, 180_000);

  afterAll(async () => {
    await amb?.encerrar();
    process.env.TZ = tzOriginal;
  });

  async function inicios(de: string, ate: string): Promise<string[]> {
    const resposta = await amb.api("GET", `/atendimentos?de=${de}&ate=${ate}`);
    expect(resposta.statusCode).toBe(200);
    return (resposta.json() as Atendimento[]).map((a) => a.inicio);
  }

  it("o processo está mesmo no outro fuso", () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(tz);
  });

  it("virada do dia: o das 23h fica no dia, o da meia-noite no seguinte", async () => {
    expect(await inicios("2030-03-14", "2030-03-14")).toEqual(["2030-03-15T02:00:00.000Z"]);
    expect(await inicios("2030-03-15", "2030-03-15")).toEqual(["2030-03-15T03:00:00.000Z"]);
  });

  it("virada da semana: domingo 23h fecha a semana, segunda 00h abre a próxima", async () => {
    expect(inicioDaSemana("2030-03-17")).toBe("2030-03-11");
    expect(inicioDaSemana("2030-03-18")).toBe("2030-03-18");
    expect(await inicios("2030-03-11", "2030-03-17")).toEqual([
      "2030-03-15T02:00:00.000Z",
      "2030-03-15T03:00:00.000Z",
      "2030-03-18T02:00:00.000Z",
    ]);
    expect(await inicios("2030-03-18", "2030-03-24")).toEqual(["2030-03-18T03:00:00.000Z"]);
  });

  it("às 22h de São Paulo, hoje ainda é o dia de São Paulo", () => {
    // 22h de 14/03 em SP já é dia 15 em UTC e em Tóquio.
    const agora = new Date("2030-03-15T01:00:00Z");
    expect(hojeLocal(agora)).toBe("2030-03-14");
    expect(intervaloDosDias("2030-03-14", "2030-03-14")).toEqual({
      inicio: new Date("2030-03-14T03:00:00Z"),
      fim: new Date("2030-03-15T03:00:00Z"),
    });
  });
});
