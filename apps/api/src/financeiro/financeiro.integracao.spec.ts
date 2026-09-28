import {
  hojeLocal,
  inicioDoMes,
  instanteLocal,
  somarMeses,
  type Paciente,
  type Receita,
  type ReceitaMensal,
  type ReceitaPorPaciente,
  type StatusAtendimento,
} from "@raiz/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { encerramento, type StatusEncerrado } from "../comum/cobranca/cobranca";
import { subirAmbiente, type Ambiente } from "../teste/ambiente";

/** Instante em São Paulo (UTC−3, sem horário de verão desde 2019). */
const sp = (dataHora: string) => new Date(`${dataHora}:00-03:00`);

describe("financeiro (integração)", () => {
  let amb: Ambiente;
  let paciente: Paciente;

  beforeAll(async () => {
    amb = await subirAmbiente();
  }, 180_000);

  afterAll(() => amb?.encerrar());

  beforeEach(async () => {
    await amb.prisma.$executeRawUnsafe("TRUNCATE atendimento, paciente CASCADE");
    paciente = await novoPaciente("Mariana Alves");
  });

  async function novoPaciente(nome: string): Promise<Paciente> {
    return (await amb.api("POST", "/pacientes", { nome, valorConsultaPadrao: "150" })).json();
  }

  /**
   * Atendimento já no estado final, com a cobrabilidade decidida pela mesma
   * função que o serviço usa — as datas de encerramento no passado não são
   * alcançáveis pela API. A transição pela API é coberta na agenda.
   */
  function atendimento(
    inicio: Date,
    status: StatusAtendimento,
    { encerradoEm = inicio, valor = "150", pacienteId = paciente.id } = {},
  ) {
    return amb.prisma.atendimento.create({
      data: {
        pacienteId,
        inicio,
        fim: new Date(inicio.getTime() + 50 * 60_000),
        valor,
        ...(status === "AGENDADO"
          ? {}
          : {
              ...encerramento(inicio, status as StatusEncerrado, encerradoEm),
              motivo: status === "REALIZADO" ? null : "Motivo.",
            }),
      },
    });
  }

  /** Janeiro de 2026 com os cinco status, R$ 600,00 realizados (spec, "Composição da receita"). */
  async function janeiroComOsCincoStatus() {
    await atendimento(sp("2026-01-05T09:00"), "REALIZADO");
    await atendimento(sp("2026-01-06T09:00"), "REALIZADO");
    await atendimento(sp("2026-01-07T09:00"), "FALTA");
    // Segunda 18h cancelada às 8h do mesmo dia: cobrável.
    const cobravel = await atendimento(sp("2026-01-12T18:00"), "CANCELADO", {
      encerradoEm: sp("2026-01-12T08:00"),
    });
    // Segunda 9h cancelada no domingo às 23h: não cobrável.
    const naoCobravel = await atendimento(sp("2026-01-19T09:00"), "CANCELADO", {
      encerradoEm: sp("2026-01-18T23:00"),
    });
    await atendimento(sp("2026-01-20T09:00"), "REMARCADO");
    // Passado, ainda não encerrado: sem cobrabilidade.
    await atendimento(sp("2026-01-21T09:00"), "AGENDADO");
    expect([cobravel.cobravel, naoCobravel.cobravel]).toEqual([true, false]);
  }

  async function receita(de: string, ate: string): Promise<Receita> {
    const resposta = await amb.api("GET", `/financeiro/receita?de=${de}&ate=${ate}`);
    expect(resposta.statusCode).toBe(200);
    return resposta.json();
  }

  async function mensal(meses?: number): Promise<ReceitaMensal[]> {
    const resposta = await amb.api("GET", `/financeiro/mensal${meses ? `?meses=${meses}` : ""}`);
    expect(resposta.statusCode).toBe(200);
    return resposta.json();
  }

  async function porPaciente(de: string, ate: string): Promise<ReceitaPorPaciente[]> {
    const resposta = await amb.api("GET", `/financeiro/por-paciente?de=${de}&ate=${ate}`);
    expect(resposta.statusCode).toBe(200);
    return resposta.json();
  }

  describe("receita realizada", () => {
    it("composição com os cinco status na mesma apuração: R$ 600,00", async () => {
      await janeiroComOsCincoStatus();
      expect(await receita("2026-01-01", "2026-01-31")).toEqual({
        realizada: "600.00",
        prevista: null,
        // O AGENDADO de 21/01 não entra na realizada: é pendência.
        pendentes: { quantidade: 1, valor: "150.00" },
      });
    });

    it("encerrado sem cobrabilidade definida não entra no total", async () => {
      await janeiroComOsCincoStatus();
      // Estado que só um defeito produziria: encerrado, com `cobravel` nulo.
      // Gravado direto, sem `encerramento()`, que sempre decide.
      const indefinido = await amb.prisma.atendimento.create({
        data: {
          pacienteId: paciente.id,
          inicio: sp("2026-01-22T09:00"),
          fim: sp("2026-01-22T09:50"),
          valor: "150",
          status: "CANCELADO",
          motivo: "Motivo.",
        },
      });
      expect(indefinido).toMatchObject({ status: "CANCELADO", cobravel: null });

      expect((await receita("2026-01-01", "2026-01-31")).realizada).toBe("600.00");
      expect((await porPaciente("2026-01-01", "2026-01-31"))[0].total).toBe("600.00");
    });

    it("reajuste do paciente não altera a receita de mês fechado", async () => {
      await janeiroComOsCincoStatus();
      expect((await receita("2026-01-01", "2026-01-31")).realizada).toBe("600.00");

      const reajuste = await amb.api("PATCH", `/pacientes/${paciente.id}`, { valorConsultaPadrao: "180" });
      expect(reajuste.statusCode).toBe(200);

      expect((await receita("2026-01-01", "2026-01-31")).realizada).toBe("600.00");
      expect((await porPaciente("2026-01-01", "2026-01-31"))[0].total).toBe("600.00");
    });

    it("só conta o início dentro do período, em datas de São Paulo", async () => {
      // 31/01 23h em SP já é 01/02 em UTC: é janeiro.
      await atendimento(sp("2026-01-31T23:00"), "REALIZADO");
      await atendimento(sp("2026-02-01T00:00"), "REALIZADO", { valor: "100" });
      expect((await receita("2026-01-01", "2026-01-31")).realizada).toBe("150.00");
      expect((await receita("2026-02-01", "2026-02-28")).realizada).toBe("100.00");
    });

    it("soma em decimal, sem erro de ponto flutuante", async () => {
      for (const dia of ["05", "06", "07"]) {
        await atendimento(sp(`2026-01-${dia}T09:00`), "REALIZADO", { valor: "0.10" });
      }
      await atendimento(sp("2026-01-08T09:00"), "REALIZADO", { valor: "99999999.99" });
      expect((await receita("2026-01-01", "2026-01-31")).realizada).toBe("100000000.29");
    });

    it("mês sem atendimento: R$ 0,00", async () => {
      expect(await receita("2026-01-01", "2026-01-31")).toEqual({
        realizada: "0.00",
        prevista: null,
        pendentes: { quantidade: 0, valor: "0.00" },
      });
    });
  });

  describe("receita prevista e pendentes de encerramento", () => {
    // Relógio fixo em 15/03/2026, meio-dia: o que separa previsão de pendência
    // é o término em relação a agora. Só `Date` é falso; timers seguem reais.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"], now: sp("2026-03-15T12:00") });
    });
    // A sessão renovou a expiração pelo relógio falso: no real, já venceu.
    afterEach(async () => {
      vi.useRealTimers();
      await amb.reautenticar();
    });

    it("AGENDADO por terminar no mês corrente, separada da realizada", async () => {
      for (const dia of ["20", "21", "22"]) await atendimento(sp(`2026-03-${dia}T09:00`), "AGENDADO");
      // Realizado no mês e agendado no mês seguinte não entram na previsão.
      await atendimento(sp("2026-03-10T09:00"), "REALIZADO", { valor: "80" });
      await atendimento(sp("2026-04-01T09:00"), "AGENDADO");

      expect(await receita("2026-03-01", "2026-05-31")).toEqual({
        realizada: "80.00",
        prevista: "450.00",
        pendentes: { quantidade: 0, valor: "0.00" },
      });
    });

    it("horário terminado sem encerramento: pendente, fora da previsão, em qualquer mês do período", async () => {
      await atendimento(sp("2026-03-15T09:00"), "AGENDADO"); // terminou às 9h50
      await atendimento(sp("2026-03-15T11:30"), "AGENDADO"); // em andamento: ainda previsão
      await atendimento(sp("2026-03-20T09:00"), "AGENDADO");
      await atendimento(sp("2026-02-10T09:00"), "AGENDADO", { valor: "200" });

      expect(await receita("2026-03-01", "2026-03-31")).toEqual({
        realizada: "0.00",
        prevista: "300.00",
        pendentes: { quantidade: 1, valor: "150.00" },
      });
      expect(await receita("2026-02-01", "2026-03-31")).toMatchObject({
        prevista: "300.00",
        pendentes: { quantidade: 2, valor: "350.00" },
      });
      // Mês passado inteiro: sem previsão, e a pendência continua à vista.
      expect(await receita("2026-02-01", "2026-02-28")).toMatchObject({
        prevista: null,
        pendentes: { quantidade: 1, valor: "200.00" },
      });
    });

    it("encerrar tira da pendência ou da previsão", async () => {
      const pendente = await atendimento(sp("2026-03-14T09:00"), "AGENDADO");
      const previsto = await atendimento(sp("2026-03-20T09:00"), "AGENDADO");
      expect(await receita("2026-03-01", "2026-03-31")).toMatchObject({
        prevista: "150.00",
        pendentes: { quantidade: 1, valor: "150.00" },
      });

      await amb.api("POST", `/atendimentos/${pendente.id}/falta`, { motivo: "Não veio." });
      await amb.api("POST", `/atendimentos/${previsto.id}/cancelar`, { motivo: "Avisou antes." });

      expect(await receita("2026-03-01", "2026-03-31")).toEqual({
        realizada: "150.00",
        prevista: "0.00",
        pendentes: { quantidade: 0, valor: "0.00" },
      });
    });

    it("período fora do mês corrente não tem previsão; parcial só conta a interseção", async () => {
      await atendimento(sp("2026-03-20T09:00"), "AGENDADO");
      await atendimento(sp("2026-03-31T23:00"), "AGENDADO");

      expect((await receita("2026-01-01", "2026-01-31")).prevista).toBeNull();
      expect((await receita("2026-04-01", "2026-05-31")).prevista).toBeNull();
      expect((await receita("2026-01-01", "2026-03-20")).prevista).toBe("150.00");
      expect((await receita("2026-03-01", "2026-06-30")).prevista).toBe("300.00");
    });
  });

  describe("comparativo mensal", () => {
    const atual = inicioDoMes(hojeLocal());

    it("dezoito meses de histórico: os doze mais recentes, em ordem, com zeros", async () => {
      for (let recuo = 17; recuo >= 1; recuo--) {
        if (recuo === 3 || recuo === 5) continue;
        await atendimento(instanteLocal(somarMeses(atual, -recuo), 10 * 60), "REALIZADO");
      }

      const serie = await mensal();

      expect(serie.map((m) => m.mes)).toEqual(
        Array.from({ length: 12 }, (_, i) => somarMeses(atual, i - 11).slice(0, 7)),
      );
      expect(serie.map((m) => m.realizada)).toEqual([
        ...Array(6).fill("150.00"), // −11 … −6
        "0.00", // −5
        "150.00", // −4
        "0.00", // −3
        "150.00", // −2
        "150.00", // −1
        "0.00", // mês corrente, nada realizado ainda
      ]);
    });

    it("histórico curto: só a partir do mês do primeiro atendimento", async () => {
      await atendimento(instanteLocal(somarMeses(atual, -2), 10 * 60), "CANCELADO", {
        encerradoEm: instanteLocal(somarMeses(atual, -3)),
      });
      await atendimento(instanteLocal(somarMeses(atual, -1), 10 * 60), "REALIZADO");

      expect(await mensal()).toEqual([
        { mes: somarMeses(atual, -2).slice(0, 7), realizada: "0.00" },
        { mes: somarMeses(atual, -1).slice(0, 7), realizada: "150.00" },
        { mes: atual.slice(0, 7), realizada: "0.00" },
      ]);
    });

    it("sem nenhum atendimento: série vazia", async () => {
      expect(await mensal()).toEqual([]);
    });

    it("quantidade de meses configurável", async () => {
      await atendimento(instanteLocal(somarMeses(atual, -30), 10 * 60), "REALIZADO");
      expect(await mensal(3)).toHaveLength(3);
      expect(await mensal(24)).toHaveLength(24);
    });
  });

  describe("receita por paciente", () => {
    it("total cobrado e contagem de cada status, remarcações sem somar", async () => {
      for (const dia of ["05", "06", "07"]) await atendimento(sp(`2026-01-${dia}T09:00`), "REALIZADO");
      await atendimento(sp("2026-01-08T09:00"), "FALTA");
      await atendimento(sp("2026-01-09T09:00"), "REMARCADO");
      await atendimento(sp("2026-01-10T09:00"), "REMARCADO");
      // Fora do período: não conta.
      await atendimento(sp("2026-02-02T09:00"), "REALIZADO");

      expect(await porPaciente("2026-01-01", "2026-01-31")).toEqual([
        {
          paciente: { id: paciente.id, nome: "Mariana Alves", status: "ATIVO" },
          total: "600.00",
          contagem: { AGENDADO: 0, REALIZADO: 3, CANCELADO: 0, REMARCADO: 2, FALTA: 1 },
        },
      ]);
    });

    it("paciente arquivado com atendimento no período consta, identificado como arquivado", async () => {
      const arquivado = await novoPaciente("Bruno Costa");
      await atendimento(sp("2026-01-05T09:00"), "REALIZADO", { pacienteId: arquivado.id, valor: "200" });
      await atendimento(sp("2026-01-06T09:00"), "REALIZADO");
      const arquivamento = await amb.api("POST", `/pacientes/${arquivado.id}/arquivar`, {});
      expect(arquivamento.statusCode).toBe(200);

      const lista = await porPaciente("2026-01-01", "2026-01-31");

      expect(lista.map((l) => [l.paciente.nome, l.paciente.status, l.total])).toEqual([
        ["Bruno Costa", "ARQUIVADO", "200.00"],
        ["Mariana Alves", "ATIVO", "150.00"],
      ]);
    });

    it("consulta registrada na trilha com os pacientes listados; receita e mensal não", async () => {
      const outro = await novoPaciente("Bruno Costa");
      await atendimento(sp("2026-01-05T09:00"), "REALIZADO");
      await atendimento(sp("2026-01-06T09:00"), "REALIZADO", { pacienteId: outro.id });

      await porPaciente("2026-01-01", "2026-01-31");
      await receita("2026-01-01", "2026-01-31");
      await mensal();

      const doFinanceiro = (
        await amb.prisma.auditoria.findMany({ where: { tipoEvento: "LEITURA" } })
      ).filter((r) => (r.detalhe as { rota?: string }).rota?.startsWith("/api/v1/financeiro"));
      expect(new Set(doFinanceiro.map((r) => (r.detalhe as { rota: string }).rota))).toEqual(
        new Set(["/api/v1/financeiro/por-paciente"]),
      );
      const desta = doFinanceiro.filter((r) => (r.detalhe as { ids: string[] }).ids.includes(outro.id));
      expect(desta).toHaveLength(1);
      expect(desta[0]).toMatchObject({ recursoTipo: "PACIENTE", ip: "198.51.100.50" });
      expect((desta[0].detalhe as { ids: string[] }).ids.sort()).toEqual([paciente.id, outro.id].sort());
    });

    it("período sem atendimento: lista vazia", async () => {
      expect(await porPaciente("2026-01-01", "2026-01-31")).toEqual([]);
    });
  });

  describe("validação", () => {
    it.each(["receita", "por-paciente"])("%s exige intervalo válido: 422", async (rota) => {
      for (const [consulta, campo] of [
        ["", "de"],
        ["?de=2026-01-01", "ate"],
        ["?ate=2026-01-31", "de"],
        ["?de=2026-01-31&ate=2026-01-01", "ate"],
        ["?de=01/01/2026&ate=2026-01-31", "de"],
      ]) {
        const resposta = await amb.api("GET", `/financeiro/${rota}${consulta}`);
        expect(resposta.statusCode).toBe(422);
        expect(resposta.json().campos.map((c: { caminho: string }) => c.caminho)).toContain(campo);
      }
    });

    it("mensal recusa quantidade de meses inválida", async () => {
      for (const meses of ["0", "25", "1.5", "doze"]) {
        expect((await amb.api("GET", `/financeiro/mensal?meses=${meses}`)).statusCode).toBe(422);
      }
    });

    it("exige sessão", async () => {
      const resposta = await amb.app.inject({
        method: "GET",
        url: "/api/v1/financeiro/receita?de=2026-01-01&ate=2026-01-31",
      });
      expect(resposta.statusCode).toBe(401);
    });
  });
});
