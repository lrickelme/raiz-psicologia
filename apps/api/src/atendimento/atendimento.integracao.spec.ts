import type { Atendimento, ConflitoDeHorario, Paciente } from "@raiz/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { subirAmbiente, type Ambiente } from "../teste/ambiente";

/** Instante em São Paulo (UTC−3, sem horário de verão desde 2019). */
const sp = (dataHora: string) => new Date(`${dataHora}:00-03:00`).toISOString();

describe("agenda (integração)", () => {
  let amb: Ambiente;
  let paciente: Paciente;

  beforeAll(async () => {
    amb = await subirAmbiente();
  }, 180_000);

  afterAll(() => amb?.encerrar());

  beforeEach(async () => {
    await amb.prisma.$executeRawUnsafe("TRUNCATE atendimento, paciente CASCADE");
    paciente = (
      await amb.api("POST", "/pacientes", { nome: "Mariana Alves", valorConsultaPadrao: "150" })
    ).json();
  });

  function agendar(inicio: string, fim: string, extra: object = {}) {
    return amb.api("POST", "/atendimentos", {
      pacienteId: paciente.id,
      inicio: sp(inicio),
      fim: sp(fim),
      ...extra,
    });
  }

  async function agendado(inicio: string, fim: string): Promise<Atendimento> {
    const resposta = await agendar(inicio, fim);
    expect(resposta.statusCode).toBe(201);
    return resposta.json();
  }

  async function status(id: string) {
    return (await amb.prisma.atendimento.findUniqueOrThrow({ where: { id } })).status;
  }

  describe("sobreposição", () => {
    it("conflito: 409 com o conflitante e o próximo horário livre", async () => {
      const existente = await agendado("2030-03-14T14:00", "2030-03-14T14:50");
      await agendado("2030-03-14T14:50", "2030-03-14T15:40");

      const resposta = await agendar("2030-03-14T14:30", "2030-03-14T15:20");

      expect(resposta.statusCode).toBe(409);
      expect(resposta.headers["content-type"]).toContain("application/problem+json");
      const corpo: ConflitoDeHorario = resposta.json();
      expect(corpo.conflitante).toMatchObject({ id: existente.id, paciente: "Mariana Alves" });
      // Pula os dois atendimentos encadeados e oferece a primeira janela de 50 min.
      expect(corpo.proximoHorarioLivre).toEqual({
        inicio: sp("2030-03-14T15:40"),
        fim: sp("2030-03-14T16:30"),
      });
      expect(await amb.prisma.atendimento.count()).toBe(2);
    });

    it("encaixe adjacente é aceito", async () => {
      await agendado("2030-03-14T14:00", "2030-03-14T14:50");
      expect((await agendar("2030-03-14T14:50", "2030-03-14T15:40")).statusCode).toBe(201);
      expect((await agendar("2030-03-14T13:10", "2030-03-14T14:00")).statusCode).toBe(201);
    });

    it("horário liberado por cancelamento", async () => {
      const a = await agendado("2030-03-14T14:00", "2030-03-14T14:50");
      await amb.api("POST", `/atendimentos/${a.id}/cancelar`, { motivo: "Viagem" });
      expect((await agendar("2030-03-14T14:00", "2030-03-14T14:50")).statusCode).toBe(201);
    });

    it("horário liberado por remarcação", async () => {
      const a = await agendado("2030-03-14T14:00", "2030-03-14T14:50");
      await amb.api("POST", `/atendimentos/${a.id}/remarcar`, {
        inicio: sp("2030-03-15T10:00"),
        motivo: "Pediu outro dia",
      });
      expect((await agendar("2030-03-14T14:00", "2030-03-14T14:50")).statusCode).toBe(201);
    });

    it("requisições concorrentes: exatamente uma persiste, a outra recebe 409", async () => {
      const respostas = await Promise.all(
        Array.from({ length: 5 }, () => agendar("2030-03-14T09:00", "2030-03-14T09:50")),
      );
      expect(respostas.map((r) => r.statusCode).sort()).toEqual([201, 409, 409, 409, 409]);
      expect(await amb.prisma.atendimento.count()).toBe(1);
    });
  });

  describe("agendamento", () => {
    it("valor congelado: herda do paciente e não muda com reajuste", async () => {
      const antes = await agendado("2030-03-14T09:00", "2030-03-14T09:50");
      expect(antes).toMatchObject({ status: "AGENDADO", valor: "150.00" });

      await amb.api("PATCH", `/pacientes/${paciente.id}`, { valorConsultaPadrao: "180" });
      const depois = await agendado("2030-03-21T09:00", "2030-03-21T09:50");

      const lista: Atendimento[] = (
        await amb.api("GET", "/atendimentos?de=2030-03-01&ate=2030-03-31")
      ).json();
      expect(lista.map((a) => [a.id, a.valor])).toEqual([
        [antes.id, "150.00"],
        [depois.id, "180.00"],
      ]);
    });

    it("valor editável no ato", async () => {
      const a = (await agendar("2030-03-14T09:00", "2030-03-14T09:50", { valor: "99,90" })).json();
      expect(a.valor).toBe("99.90");
    });

    it.each([
      ["fim igual ao início", "2030-03-14T14:00"],
      ["fim anterior", "2030-03-14T13:00"],
      ["menos de 15 minutos", "2030-03-14T14:10"],
    ])("%s: 422 no campo fim", async (_caso, fim) => {
      const resposta = await agendar("2030-03-14T14:00", fim);
      expect(resposta.statusCode).toBe(422);
      expect(resposta.json().campos[0].caminho).toBe("fim");
      expect(await amb.prisma.atendimento.count()).toBe(0);
    });

    it("paciente arquivado não recebe agendamento", async () => {
      await amb.api("POST", `/pacientes/${paciente.id}/arquivar`);
      const resposta = await agendar("2030-03-14T14:00", "2030-03-14T14:50");
      expect(resposta.statusCode).toBe(422);
      expect(resposta.json().campos[0].caminho).toBe("pacienteId");
    });

    it("consulta sem paciente exige intervalo, e de no máximo 62 dias", async () => {
      expect((await amb.api("GET", "/atendimentos")).statusCode).toBe(422);
      expect((await amb.api("GET", "/atendimentos?de=2030-01-01")).statusCode).toBe(422);
      expect((await amb.api("GET", "/atendimentos?de=2030-01-01&ate=2030-06-01")).statusCode).toBe(
        422,
      );
      expect((await amb.api("GET", `/atendimentos?pacienteId=${paciente.id}`)).statusCode).toBe(200);
    });
  });

  describe("ciclo de vida", () => {
    it("conclusão antecipada: 422; depois do término: REALIZADO", async () => {
      const futuro = await agendado("2030-03-14T14:00", "2030-03-14T14:50");
      expect((await amb.api("POST", `/atendimentos/${futuro.id}/realizar`)).statusCode).toBe(422);
      expect(await status(futuro.id)).toBe("AGENDADO");

      const passado = await agendado("2020-03-14T14:00", "2020-03-14T14:50");
      const realizado = await amb.api("POST", `/atendimentos/${passado.id}/realizar`);
      expect(realizado.statusCode).toBe(200);
      expect(realizado.json().status).toBe("REALIZADO");
      // Encerrado não volta atrás.
      expect(
        (await amb.api("POST", `/atendimentos/${passado.id}/cancelar`, { motivo: "x" })).statusCode,
      ).toBe(409);
    });

    it("falta só depois do início, com motivo", async () => {
      const futuro = await agendado("2030-03-14T14:00", "2030-03-14T14:50");
      expect(
        (await amb.api("POST", `/atendimentos/${futuro.id}/falta`, { motivo: "Não veio" })).statusCode,
      ).toBe(422);

      const passado = await agendado("2020-03-14T14:00", "2020-03-14T14:50");
      const falta = await amb.api("POST", `/atendimentos/${passado.id}/falta`, { motivo: "Não veio" });
      expect(falta.json()).toMatchObject({ status: "FALTA", motivo: "Não veio" });
    });

    it.each(["cancelar", "falta", "remarcar"])(
      "encerramento sem motivo (%s): 422 no campo motivo, status intacto",
      async (acao) => {
        const a = await agendado("2020-03-14T14:00", "2020-03-14T14:50");
        const extra = acao === "remarcar" ? { inicio: sp("2030-03-15T10:00") } : {};

        for (const motivo of [undefined, "", "   "]) {
          const resposta = await amb.api("POST", `/atendimentos/${a.id}/${acao}`, { ...extra, motivo });
          expect(resposta.statusCode).toBe(422);
          expect(resposta.json().campos).toEqual([expect.objectContaining({ caminho: "motivo" })]);
        }
        expect(await status(a.id)).toBe("AGENDADO");
        expect(await amb.prisma.atendimento.count()).toBe(1);
      },
    );
  });

  describe("remarcação encadeada", () => {
    it("original REMARCADO com motivo; novo AGENDADO herda duração e valor, apontando para ele", async () => {
      const original = (
        await agendar("2030-03-14T14:00", "2030-03-14T14:50", { valor: "150" })
      ).json() as Atendimento;
      // Reajuste depois do agendamento: a remarcação mantém o valor congelado.
      await amb.api("PATCH", `/pacientes/${paciente.id}`, { valorConsultaPadrao: "180" });

      const resposta = await amb.api("POST", `/atendimentos/${original.id}/remarcar`, {
        inicio: sp("2030-03-21T10:00"),
        motivo: "Paciente viajou",
      });

      expect(resposta.statusCode).toBe(201);
      const novo: Atendimento = resposta.json();
      expect(novo).toMatchObject({
        status: "AGENDADO",
        inicio: sp("2030-03-21T10:00"),
        fim: sp("2030-03-21T10:50"),
        valor: "150.00",
        remarcadoDeId: original.id,
        paciente: { id: paciente.id },
      });

      const [historicoOriginal] = (
        (await amb.api("GET", `/atendimentos?pacienteId=${paciente.id}`)).json() as Atendimento[]
      ).filter((a) => a.id === original.id);
      expect(historicoOriginal).toMatchObject({
        status: "REMARCADO",
        motivo: "Paciente viajou",
        remarcadoParaId: novo.id,
      });
    });

    it("remarcar de novo alonga a cadeia e o histórico a mostra inteira", async () => {
      const a1 = await agendado("2030-03-14T14:00", "2030-03-14T14:50");
      const a2 = (
        await amb.api("POST", `/atendimentos/${a1.id}/remarcar`, {
          inicio: sp("2030-03-15T14:00"),
          motivo: "primeira",
        })
      ).json();
      const a3 = (
        await amb.api("POST", `/atendimentos/${a2.id}/remarcar`, {
          inicio: sp("2030-03-16T14:00"),
          motivo: "segunda",
        })
      ).json();

      const historico: Atendimento[] = (
        await amb.api("GET", `/atendimentos?pacienteId=${paciente.id}`)
      ).json();
      expect(historico.map((a) => [a.status, a.remarcadoDeId, a.remarcadoParaId])).toEqual([
        ["REMARCADO", null, a2.id],
        ["REMARCADO", a1.id, a3.id],
        ["AGENDADO", a2.id, null],
      ]);
    });

    it("novo horário ocupado: 409 e nada muda (transação)", async () => {
      const outro = await agendado("2030-03-21T10:00", "2030-03-21T10:50");
      const original = await agendado("2030-03-14T14:00", "2030-03-14T14:50");

      const resposta = await amb.api("POST", `/atendimentos/${original.id}/remarcar`, {
        inicio: sp("2030-03-21T10:20"),
        motivo: "tentativa",
      });

      expect(resposta.statusCode).toBe(409);
      expect(resposta.json().conflitante.id).toBe(outro.id);
      const intacto = await amb.prisma.atendimento.findUniqueOrThrow({ where: { id: original.id } });
      expect(intacto).toMatchObject({ status: "AGENDADO", motivo: null });
      expect(await amb.prisma.atendimento.count()).toBe(2);
    });

    it("pode ocupar trecho do próprio horário original", async () => {
      const original = await agendado("2030-03-14T14:00", "2030-03-14T14:50");
      const resposta = await amb.api("POST", `/atendimentos/${original.id}/remarcar`, {
        inicio: sp("2030-03-14T14:20"),
        motivo: "atraso",
      });
      expect(resposta.statusCode).toBe(201);
    });

    it("fim divergente da duração original: 422", async () => {
      const original = await agendado("2030-03-14T14:00", "2030-03-14T14:50");
      const resposta = await amb.api("POST", `/atendimentos/${original.id}/remarcar`, {
        inicio: sp("2030-03-15T14:00"),
        fim: sp("2030-03-15T15:00"),
        motivo: "x",
      });
      expect(resposta.statusCode).toBe(422);
      expect(resposta.json().campos[0].caminho).toBe("fim");
    });

    it.each(["cancelar", "remarcar"])("mover atendimento encerrado (%s antes): recusado", async (acao) => {
      const a = await agendado("2030-03-14T14:00", "2030-03-14T14:50");
      await amb.api("POST", `/atendimentos/${a.id}/${acao}`, {
        inicio: sp("2030-03-15T14:00"),
        motivo: "primeiro encerramento",
      });

      const resposta = await amb.api("POST", `/atendimentos/${a.id}/remarcar`, {
        inicio: sp("2030-03-16T14:00"),
        motivo: "de novo",
      });
      expect(resposta.statusCode).toBe(409);
    });
  });

  describe("motivo como dado clínico", () => {
    it("ilegível na coluna, legível no histórico, ausente da grade, leitura auditada", async () => {
      const a = await agendado("2030-03-14T14:00", "2030-03-14T14:50");
      const motivo = "Internação da mãe da paciente";
      await amb.api("POST", `/atendimentos/${a.id}/cancelar`, { motivo });

      const [linha] = await amb.prisma.$queryRaw<{ motivo: string }[]>`
        SELECT motivo FROM atendimento WHERE id = ${a.id}::uuid`;
      expect(linha.motivo).not.toContain("Internação");

      const grade: Atendimento[] = (
        await amb.api("GET", "/atendimentos?de=2030-03-14&ate=2030-03-14")
      ).json();
      expect(grade[0]).not.toHaveProperty("motivo");

      const historico: Atendimento[] = (
        await amb.api("GET", `/atendimentos?pacienteId=${paciente.id}`)
      ).json();
      expect(historico[0].motivo).toBe(motivo);

      const leituras = await amb.prisma.auditoria.findMany({
        where: { recursoTipo: "ATENDIMENTO", tipoEvento: "LEITURA" },
      });
      expect(leituras.some((l) => (l.detalhe as { ids?: string[] }).ids?.includes(a.id))).toBe(true);
      const escrita = await amb.prisma.auditoria.findFirst({
        where: { recursoTipo: "ATENDIMENTO", tipoEvento: "ESCRITA", recursoId: a.id },
      });
      expect(escrita).not.toBeNull();
    });
  });
});
