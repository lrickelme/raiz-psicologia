import type {
  Evolucao,
  EvolucaoListada,
  EvolucaoResumo,
  Paciente,
  RascunhoEvolucao,
  ResumoProntuario,
} from "@raiz/shared";
import { dataLocal } from "@raiz/shared";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { subirAmbiente, type Ambiente } from "../teste/ambiente";

const TEXTO = "Paciente relata melhora do sono após retomar a rotina de exercícios.";
const IP = "198.51.100.50";

describe("prontuário — evolução (integração)", () => {
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

  function atendimento(status: "REALIZADO" | "AGENDADO", pacienteId = paciente.id, dia = "10") {
    return amb.prisma.atendimento.create({
      data: {
        pacienteId,
        inicio: new Date(`2026-01-${dia}T14:00:00-03:00`),
        fim: new Date(`2026-01-${dia}T14:50:00-03:00`),
        valor: "150",
        status,
      },
    });
  }

  function registrar(corpo: object, pacienteId = paciente.id) {
    return amb.api("POST", `/pacientes/${pacienteId}/evolucoes`, corpo);
  }

  async function registrada(texto = TEXTO): Promise<EvolucaoResumo> {
    const resposta = await registrar({ texto });
    expect(resposta.statusCode).toBe(201);
    return resposta.json();
  }

  function eventos(tipoEvento: string, pacienteId = paciente.id) {
    return amb.prisma.auditoria.findMany({
      where:
        tipoEvento === "EVOLUCAO_LISTADA"
          ? { tipoEvento, recursoId: pacienteId }
          : { tipoEvento, detalhe: { path: ["pacienteId"], equals: pacienteId } },
    });
  }

  describe("registro", () => {
    it("a partir do atendimento: vinculada a ele, com data e hora do servidor", async () => {
      const realizado = await atendimento("REALIZADO");
      const antes = Date.now();

      const resposta = await registrar({
        texto: TEXTO,
        atendimentoId: realizado.id,
        registradoEm: "2000-01-01T00:00:00Z",
      });

      expect(resposta.statusCode).toBe(201);
      const criada: EvolucaoResumo = resposta.json();
      expect(criada).toMatchObject({
        pacienteId: paciente.id,
        atendimentoId: realizado.id,
        vigente: true,
        retificaDeId: null,
      });
      expect(criada).not.toHaveProperty("texto");
      const registradoEm = Date.parse(criada.registradoEm);
      expect(registradoEm).toBeGreaterThanOrEqual(antes - 1000);
      expect(registradoEm).toBeLessThanOrEqual(Date.now() + 1000);

      // Gravar não é ler: nenhum EVOLUCAO_LIDA, mas a escrita entra na trilha.
      expect(await eventos("EVOLUCAO_LIDA")).toHaveLength(0);
      const escrita = await amb.prisma.auditoria.findFirst({
        where: { tipoEvento: "ESCRITA", recursoTipo: "EVOLUCAO", recursoId: criada.id },
      });
      expect(escrita).not.toBeNull();
    });

    it("avulsa: vinculada só ao paciente", async () => {
      const criada = await registrada();
      expect(criada.atendimentoId).toBeNull();
    });

    it("atendimento não realizado ou de outro paciente: 422 no campo atendimentoId", async () => {
      const agendado = await atendimento("AGENDADO");
      const outro: Paciente = (
        await amb.api("POST", "/pacientes", { nome: "Outro", valorConsultaPadrao: "100" })
      ).json();
      const deOutro = await atendimento("REALIZADO", outro.id, "11");

      for (const atendimentoId of [agendado.id, deOutro.id]) {
        const resposta = await registrar({ texto: TEXTO, atendimentoId });
        expect(resposta.statusCode).toBe(422);
        expect(resposta.json().campos).toEqual([
          expect.objectContaining({ caminho: "atendimentoId" }),
        ]);
      }
      expect(await amb.prisma.evolucao.count()).toBe(0);
    });

    it.each([
      ["vazio", ""],
      ["só espaços", "   \n\t "],
      ["ausente", undefined],
    ])("texto %s: 422 e nada persistido", async (_caso, texto) => {
      const resposta = await registrar({ texto });
      expect(resposta.statusCode).toBe(422);
      expect(resposta.json().campos).toEqual([expect.objectContaining({ caminho: "texto" })]);
      expect(await amb.prisma.evolucao.count()).toBe(0);
    });

    it("paciente arquivado: evoluções existentes legíveis, nova recusada", async () => {
      const existente = await registrada();
      await amb.api("POST", `/pacientes/${paciente.id}/arquivar`, {});

      const resposta = await registrar({ texto: "nova" });
      expect(resposta.statusCode).toBe(409);
      expect(await amb.prisma.evolucao.count()).toBe(1);

      expect((await amb.api("GET", `/pacientes/${paciente.id}/evolucoes`)).json()).toHaveLength(1);
      const aberta = await amb.api("GET", `/evolucoes/${existente.id}`);
      expect(aberta.statusCode).toBe(200);
      expect(aberta.json().texto).toBe(TEXTO);
    });

    it("paciente ou evolução inexistente: 404", async () => {
      const inexistente = "0199a0e0-0000-7000-8000-00000000ffff";
      expect((await registrar({ texto: TEXTO }, inexistente)).statusCode).toBe(404);
      expect((await amb.api("GET", `/pacientes/${inexistente}/evolucoes`)).statusCode).toBe(404);
      expect((await amb.api("GET", `/evolucoes/${inexistente}`)).statusCode).toBe(404);
    });
  });

  describe("criptografia e auditoria", () => {
    it("texto ilegível ao ler a coluna direto no Postgres", async () => {
      const { id } = await registrada();

      const [linha] = await amb.prisma.$queryRaw<{ texto: string }[]>`
        SELECT texto FROM evolucao WHERE id = ${id}::uuid`;
      expect(linha.texto).toMatch(/^v1\./);
      expect(linha.texto).not.toContain("sono");
      expect(linha.texto).not.toContain(TEXTO);
    });

    it("abrir a lista gera um EVOLUCAO_LISTADA com a quantidade e nenhum EVOLUCAO_LIDA", async () => {
      for (let i = 0; i < 5; i++) await registrada(`${TEXTO} (${i})`);

      const resposta = await amb.api("GET", `/pacientes/${paciente.id}/evolucoes`);

      expect(resposta.statusCode).toBe(200);
      const lista: EvolucaoResumo[] = resposta.json();
      expect(lista).toHaveLength(5);
      expect(lista.every((e) => !("texto" in e))).toBe(true);
      // Mais recente primeiro.
      expect(lista.map((e) => e.registradoEm)).toEqual(
        [...lista.map((e) => e.registradoEm)].sort().reverse(),
      );

      const listadas = await eventos("EVOLUCAO_LISTADA");
      expect(listadas).toHaveLength(1);
      expect(listadas[0]).toMatchObject({
        recursoTipo: "PACIENTE",
        ip: IP,
        detalhe: { quantidade: 5 },
      });
      expect(await eventos("EVOLUCAO_LIDA")).toHaveLength(0);
    });

    it("abrir uma evolução gera exatamente um EVOLUCAO_LIDA para aquele id", async () => {
      const aberta = await registrada();
      await registrada("outra evolução, que não é aberta");

      const resposta = await amb.api("GET", `/evolucoes/${aberta.id}`);

      expect(resposta.statusCode).toBe(200);
      const evolucao: Evolucao = resposta.json();
      expect(evolucao).toMatchObject({ id: aberta.id, texto: TEXTO });

      const lidas = await eventos("EVOLUCAO_LIDA");
      expect(lidas).toHaveLength(1);
      expect(lidas[0]).toMatchObject({
        recursoTipo: "EVOLUCAO",
        recursoId: aberta.id,
        ip: IP,
        detalhe: { pacienteId: paciente.id },
      });
    });

    it("caminho novo de leitura entra na trilha sem chamar a auditoria", async () => {
      const ids = [(await registrada("a")).id, (await registrada("b")).id];

      // Consulta que nenhuma rota faz hoje, direto pelo PrismaService.
      const lidas = await amb.prisma.evolucao.findMany({
        where: { pacienteId: paciente.id },
        select: { id: true, pacienteId: true, texto: true },
      });

      expect(lidas.map((e) => e.texto).sort()).toEqual(["a", "b"]);
      const trilha = await eventos("EVOLUCAO_LIDA");
      expect(trilha.map((e) => e.recursoId).sort()).toEqual([...ids].sort());
      // Fora de requisição HTTP não há origem a registrar.
      expect(trilha.every((e) => e.ip === null)).toBe(true);
    });

    it("decifrar sem id no resultado falha em vez de ler sem rastro", async () => {
      await registrada();
      await expect(
        amb.prisma.evolucao.findMany({ select: { texto: true } }),
      ).rejects.toThrow(/não pode ser auditada/);
      expect(await eventos("EVOLUCAO_LIDA")).toHaveLength(0);
    });
  });

  describe("retificação", () => {
    function retificar(id: string, texto: string) {
      return amb.api("POST", `/evolucoes/${id}/retificar`, { texto });
    }

    async function retificada(id: string, texto: string): Promise<EvolucaoResumo> {
      const resposta = await retificar(id, texto);
      expect(resposta.statusCode).toBe(201);
      return resposta.json();
    }

    it("cria versão nova e preserva a anterior, legível e marcada como retificada", async () => {
      const realizado = await atendimento("REALIZADO");
      const original: EvolucaoResumo = (
        await registrar({ texto: "v1", atendimentoId: realizado.id })
      ).json();

      const nova = await retificada(original.id, "v2");

      expect(nova).toMatchObject({
        pacienteId: paciente.id,
        atendimentoId: realizado.id,
        retificaDeId: original.id,
        vigente: true,
      });
      expect(nova.id).not.toBe(original.id);
      expect(Date.parse(nova.registradoEm)).toBeGreaterThanOrEqual(
        Date.parse(original.registradoEm),
      );

      const anterior: Evolucao = (await amb.api("GET", `/evolucoes/${original.id}`)).json();
      expect(anterior).toMatchObject({ texto: "v1", vigente: false, registradoEm: original.registradoEm });

      // O prontuário mostra só a vigente, e ela indica a retificação.
      const lista: EvolucaoResumo[] = (
        await amb.api("GET", `/pacientes/${paciente.id}/evolucoes`)
      ).json();
      expect(lista).toEqual([expect.objectContaining({ id: nova.id, retificaDeId: original.id })]);

      const escrita = await amb.prisma.auditoria.findFirst({
        where: {
          tipoEvento: "ESCRITA",
          recursoTipo: "EVOLUCAO",
          recursoId: original.id,
          detalhe: { path: ["rota"], equals: "/api/v1/evolucoes/:id/retificar" },
        },
      });
      expect(escrita?.detalhe).toMatchObject({ criadoId: nova.id });
    });

    it("cadeia íntegra após duas retificações, vista de qualquer versão", async () => {
      const v1 = await registrada("primeira versão");
      const v2 = await retificada(v1.id, "segunda versão");
      const v3 = await retificada(v2.id, "terceira versão");

      for (const ponto of [v1, v2, v3]) {
        const resposta = await amb.api("GET", `/evolucoes/${ponto.id}/historico`);
        expect(resposta.statusCode).toBe(200);
        const historico: Evolucao[] = resposta.json();
        expect(historico.map((v) => [v.id, v.texto, v.vigente, v.retificaDeId])).toEqual([
          [v1.id, "primeira versão", false, null],
          [v2.id, "segunda versão", false, v1.id],
          [v3.id, "terceira versão", true, v2.id],
        ]);
      }

      // Cada abertura do histórico decifrou as três versões.
      const lidas = await eventos("EVOLUCAO_LIDA");
      expect(lidas).toHaveLength(9);
      expect(new Set(lidas.map((l) => l.recursoId))).toEqual(new Set([v1.id, v2.id, v3.id]));

      expect(await amb.prisma.evolucao.count()).toBe(3);
      expect(await amb.prisma.evolucao.count({ where: { vigente: true } })).toBe(1);
    });

    it("versão já retificada não é retificada de novo, nem em corrida", async () => {
      const v1 = await registrada("v1");
      await retificada(v1.id, "v2");
      expect((await retificar(v1.id, "ramo paralelo")).statusCode).toBe(409);

      const outra = await registrada("outra");
      const respostas = await Promise.all([
        retificar(outra.id, "a"),
        retificar(outra.id, "b"),
      ]);
      expect(respostas.map((r) => r.statusCode).sort()).toEqual([201, 409]);
      expect(await amb.prisma.evolucao.count({ where: { retificaDeId: outra.id } })).toBe(1);
    });

    it("texto em branco: 422 e a versão anterior continua vigente", async () => {
      const v1 = await registrada();
      expect((await retificar(v1.id, "  ")).statusCode).toBe(422);
      expect((await amb.prisma.evolucao.findUniqueOrThrow({ where: { id: v1.id } })).vigente).toBe(true);
      expect(await amb.prisma.evolucao.count()).toBe(1);
    });

    it("paciente arquivado: retificação recusada", async () => {
      const v1 = await registrada();
      await amb.api("POST", `/pacientes/${paciente.id}/arquivar`, {});
      expect((await retificar(v1.id, "correção")).statusCode).toBe(409);
      expect(await amb.prisma.evolucao.count()).toBe(1);
    });

    it("inexistente: 404 na retificação e no histórico", async () => {
      const inexistente = "0199a0e0-0000-7000-8000-00000000ffff";
      expect((await retificar(inexistente, "x")).statusCode).toBe(404);
      expect((await amb.api("GET", `/evolucoes/${inexistente}/historico`)).statusCode).toBe(404);
    });
  });

  describe("sem edição nem exclusão", () => {
    it("pedido de exclusão ou edição pela API é recusado e nada muda", async () => {
      const v1 = await registrada();

      expect((await amb.api("DELETE", `/evolucoes/${v1.id}`)).statusCode).toBe(404);
      expect((await amb.api("PATCH", `/evolucoes/${v1.id}`, { texto: "adulterado" })).statusCode).toBe(404);

      const intacta: Evolucao = (await amb.api("GET", `/evolucoes/${v1.id}`)).json();
      expect(intacta).toMatchObject({ texto: TEXTO, vigente: true });
    });

    it("o banco recusa exclusão e alteração vindas por fora da API", async () => {
      const v1 = await registrada();
      const v2 = await retificada(v1.id);

      await expect(amb.prisma.evolucao.delete({ where: { id: v1.id } })).rejects.toThrow(/imutável/);
      await expect(amb.prisma.evolucao.deleteMany()).rejects.toThrow(/imutável/);
      await expect(
        amb.prisma.evolucao.update({ where: { id: v2.id }, data: { texto: "adulterado" } }),
      ).rejects.toThrow(/imutável/);
      // Reabrir uma versão retificada também é alteração.
      await expect(
        amb.prisma.evolucao.update({ where: { id: v1.id }, data: { vigente: true } }),
      ).rejects.toThrow(/imutável/);

      expect(await amb.prisma.evolucao.count()).toBe(2);
    });

    async function retificada(id: string): Promise<EvolucaoResumo> {
      return (await amb.api("POST", `/evolucoes/${id}/retificar`, { texto: "correção" })).json();
    }
  });

  describe("rascunho", () => {
    const TEXTO_LONGO = "Sessão focada no luto. Paciente trouxe lembranças da infância e ";

    function salvar(corpo: object) {
      return amb.api("PUT", "/prontuario/rascunho", { pacienteId: paciente.id, ...corpo });
    }

    function consulta(atendimentoId?: string) {
      const params = new URLSearchParams({ pacienteId: paciente.id });
      if (atendimentoId) params.set("atendimentoId", atendimentoId);
      return `/prontuario/rascunho?${params}`;
    }

    async function obter(atendimentoId?: string): Promise<RascunhoEvolucao | null> {
      const resposta = await amb.api("GET", consulta(atendimentoId));
      if (resposta.statusCode === 204) return null;
      expect(resposta.statusCode).toBe(200);
      return resposta.json();
    }

    it("salva cifrado, devolve só id e hora, e sobrescreve a cada salvamento", async () => {
      const primeiro = await salvar({ texto: TEXTO_LONGO });
      expect(primeiro.statusCode).toBe(200);
      expect(Object.keys(primeiro.json()).sort()).toEqual(["atualizadoEm", "id"]);

      const segundo = await salvar({ texto: `${TEXTO_LONGO}do pai.` });
      expect(segundo.json().id).toBe(primeiro.json().id);
      expect(await amb.prisma.rascunhoEvolucao.count()).toBe(1);

      const [linha] = await amb.prisma.$queryRaw<{ texto: string }[]>`
        SELECT texto FROM rascunho_evolucao WHERE paciente_id = ${paciente.id}::uuid`;
      expect(linha.texto).toMatch(/^v1\./);
      expect(linha.texto).not.toContain("luto");

      expect(await obter()).toMatchObject({
        id: primeiro.json().id,
        pacienteId: paciente.id,
        atendimentoId: null,
        texto: `${TEXTO_LONGO}do pai.`,
      });
      // Rascunho não é evolução: lê-lo não entra como EVOLUCAO_LIDA, mas o
      // acesso fica na trilha pela rota.
      expect(await eventos("EVOLUCAO_LIDA")).toHaveLength(0);
      const leitura = await amb.prisma.auditoria.findFirst({
        where: { tipoEvento: "LEITURA", recursoTipo: "RASCUNHO_EVOLUCAO", recursoId: primeiro.json().id },
      });
      expect(leitura).not.toBeNull();
    });

    it("um por paciente e atendimento, e um avulso, mesmo com salvamentos simultâneos", async () => {
      const realizado = await atendimento("REALIZADO");

      await Promise.all([
        salvar({ texto: "avulso a" }),
        salvar({ texto: "avulso b" }),
        salvar({ texto: "do atendimento a", atendimentoId: realizado.id }),
        salvar({ texto: "do atendimento b", atendimentoId: realizado.id }),
      ]);

      expect(await amb.prisma.rascunhoEvolucao.count()).toBe(2);
      expect((await obter())?.texto).toMatch(/^avulso /);
      expect((await obter(realizado.id))?.texto).toMatch(/^do atendimento /);
    });

    it("sem rascunho: 204; descartar é idempotente", async () => {
      expect((await amb.api("GET", consulta())).statusCode).toBe(204);

      await salvar({ texto: "descartável" });
      expect((await amb.api("DELETE", consulta())).statusCode).toBe(204);
      expect((await amb.api("DELETE", consulta())).statusCode).toBe(204);
      expect(await obter()).toBeNull();
    });

    it("texto vazio é aceito; paciente arquivado e atendimento alheio, não", async () => {
      expect((await salvar({ texto: "" })).statusCode).toBe(200);

      const outro: Paciente = (
        await amb.api("POST", "/pacientes", { nome: "Outro", valorConsultaPadrao: "100" })
      ).json();
      const deOutro = await atendimento("REALIZADO", outro.id, "11");
      expect((await salvar({ texto: "x", atendimentoId: deOutro.id })).statusCode).toBe(422);

      await amb.api("POST", `/pacientes/${paciente.id}/arquivar`, {});
      expect((await salvar({ texto: "x" })).statusCode).toBe(409);
    });

    it("sobrevive a sessão expirada e reautenticação", async () => {
      await salvar({ texto: TEXTO_LONGO });

      // Inatividade: a sessão vence no servidor.
      await amb.prisma.sessao.updateMany({ data: { expiraEm: new Date(Date.now() - 1000) } });
      expect((await amb.api("GET", consulta())).statusCode).toBe(401);
      expect((await salvar({ texto: "não deve sobrescrever" })).statusCode).toBe(401);

      await amb.reautenticar();

      expect((await obter())?.texto).toBe(TEXTO_LONGO);
    });

    it("não reaparece depois de consumido pela evolução correspondente", async () => {
      const realizado = await atendimento("REALIZADO");
      await salvar({ texto: "rascunho do atendimento", atendimentoId: realizado.id });
      await salvar({ texto: "rascunho avulso" });

      const gravada = await registrar({ texto: "evolução final", atendimentoId: realizado.id });
      expect(gravada.statusCode).toBe(201);

      expect(await obter(realizado.id)).toBeNull();
      expect(await obter(realizado.id)).toBeNull();
      // O avulso é de outra evolução, ainda por escrever.
      expect((await obter())?.texto).toBe("rascunho avulso");

      await registrar({ texto: "evolução avulsa" });
      expect(await obter()).toBeNull();
      expect(await amb.prisma.rascunhoEvolucao.count()).toBe(0);
    });

    it("evolução recusada não consome o rascunho", async () => {
      await salvar({ texto: TEXTO_LONGO });
      expect((await registrar({ texto: "   " })).statusCode).toBe(422);
      expect((await obter())?.texto).toBe(TEXTO_LONGO);
    });
  });

  describe("lista e resumo para as telas", () => {
    function evolucaoAntiga(registradoEm: string, texto = "registro antigo") {
      return amb.prisma.evolucao.create({
        data: { pacienteId: paciente.id, texto, registradoEm: new Date(registradoEm) },
        select: { id: true },
      });
    }

    async function resumo(): Promise<ResumoProntuario> {
      const resposta = await amb.api("GET", `/pacientes/${paciente.id}/prontuario/resumo`);
      expect(resposta.statusCode).toBe(200);
      return resposta.json();
    }

    it("lista ordena pela data original: retificar uma evolução antiga não a traz ao topo", async () => {
      const antiga = await evolucaoAntiga("2026-01-10T15:00:00-03:00");
      const recente = await registrada("recente");
      const correcao = await amb.api("POST", `/evolucoes/${antiga.id}/retificar`, { texto: "corrigida" });

      const lista: EvolucaoListada[] = (
        await amb.api("GET", `/pacientes/${paciente.id}/evolucoes`)
      ).json();

      expect(lista.map((e) => e.id)).toEqual([recente.id, correcao.json().id]);
      expect(lista[1]).toMatchObject({
        retificaDeId: antiga.id,
        originalmenteEm: new Date("2026-01-10T15:00:00-03:00").toISOString(),
      });
      expect(lista[0].originalmenteEm).toBe(lista[0].registradoEm);
    });

    it("resumo de paciente ativo: contagem e data mais recente, sem texto nem guarda", async () => {
      expect(await resumo()).toEqual({ evolucoes: 0, ultimaEvolucaoEm: null, guarda: null });

      const v1 = await registrada("a");
      const b = await registrada("b");
      await amb.api("POST", `/evolucoes/${v1.id}/retificar`, { texto: "a corrigida" });

      const atual = await resumo();
      expect(atual.evolucoes).toBe(2);
      expect(Date.parse(atual.ultimaEvolucaoEm!)).toBeGreaterThanOrEqual(Date.parse(b.registradoEm));
      expect(atual.guarda).toBeNull();
      expect(await eventos("EVOLUCAO_LIDA")).toHaveLength(0);
      expect(await eventos("EVOLUCAO_LISTADA")).toHaveLength(0);
    });

    it("arquivado com último registro em 10/03/2024: elegível em 10/03/2044, prazo de 20 anos", async () => {
      await evolucaoAntiga("2024-03-10T11:00:00-03:00");
      await amb.api("POST", `/pacientes/${paciente.id}/arquivar`, {});

      expect((await resumo()).guarda).toEqual({
        prazoAnos: 20,
        ultimoRegistroEm: new Date("2024-03-10T11:00:00-03:00").toISOString(),
        elegivelEm: "2044-03-10",
        elegivel: false,
      });
    });

    it("atendimento realizado mais recente que a evolução adia a contagem", async () => {
      await evolucaoAntiga("2024-03-10T11:00:00-03:00");
      await atendimento("REALIZADO"); // 10/01/2026
      await amb.api("POST", `/pacientes/${paciente.id}/arquivar`, {});

      expect((await resumo()).guarda).toMatchObject({ elegivelEm: "2046-01-10" });
    });

    it("novo registro adia a contagem: reativado, nova evolução, arquivado de novo", async () => {
      await evolucaoAntiga("2024-03-10T11:00:00-03:00");
      await amb.api("POST", `/pacientes/${paciente.id}/arquivar`, {});
      expect((await resumo()).guarda?.elegivelEm).toBe("2044-03-10");

      await amb.api("POST", `/pacientes/${paciente.id}/reativar`, {});
      const nova = await registrada("retorno ao acompanhamento");
      await amb.api("POST", `/pacientes/${paciente.id}/arquivar`, {});

      const { guarda } = await resumo();
      expect(guarda?.ultimoRegistroEm).toBe(nova.registradoEm);
      // Dia do registro em São Paulo, não em UTC, mais 20 anos.
      const dia = dataLocal(nova.registradoEm);
      expect(guarda?.elegivelEm).toBe(`${Number(dia.slice(0, 4)) + 20}${dia.slice(4)}`);
    });

    it("prazo vencido só sinaliza: nada é apagado", async () => {
      const { id } = await evolucaoAntiga("2000-05-02T10:00:00-03:00");
      await amb.api("POST", `/pacientes/${paciente.id}/arquivar`, {});

      expect((await resumo()).guarda).toMatchObject({ elegivelEm: "2020-05-02", elegivel: true });
      expect(await amb.prisma.evolucao.findUnique({ where: { id } })).not.toBeNull();
    });

    it("arquivado sem registro nenhum conta do cadastro", async () => {
      await amb.api("POST", `/pacientes/${paciente.id}/arquivar`, {});
      const { guarda } = await resumo();
      expect(guarda?.ultimoRegistroEm).toBe(paciente.criadoEm);
    });
  });
});
