import { TAMANHO_MAXIMO_PAGINA, type PaginaConcluidos, type QuadroEstudos, type Topico } from "@raiz/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { subirAmbiente, type Ambiente } from "../teste/ambiente";
import { LABELS_INICIAIS, reiniciarEstudos } from "../teste/estudos";
import { TopicoRepository } from "./topico.repository";

/** Instante em São Paulo (UTC−3, sem horário de verão desde 2019). */
const sp = (dataHora: string) => new Date(`${dataHora}:00-03:00`);

describe("tópicos de estudo (integração)", () => {
  let amb: Ambiente;

  beforeAll(async () => {
    amb = await subirAmbiente();
  }, 180_000);

  afterAll(() => amb?.encerrar());

  beforeEach(() => reiniciarEstudos(amb.prisma));
  afterEach(() => vi.restoreAllMocks());

  async function criar(corpo: object): Promise<Topico> {
    const resposta = await amb.api("POST", "/topicos", corpo);
    expect(resposta.statusCode).toBe(201);
    return resposta.json();
  }

  async function mover(id: string, corpo: object): Promise<Topico> {
    const resposta = await amb.api("POST", `/topicos/${id}/mover`, corpo);
    expect(resposta.statusCode).toBe(200);
    return resposta.json();
  }

  async function quadro(): Promise<QuadroEstudos> {
    const resposta = await amb.api("GET", "/estudos/quadro");
    expect(resposta.statusCode).toBe(200);
    return resposta.json();
  }

  /** Tópico já concluído no instante dado, gravado direto: o passado não é alcançável pela API. */
  function concluidoEm(concluidoEm: Date, titulo = "Concluído") {
    return amb.prisma.topicoEstudo.create({ data: { titulo, status: "CONCLUIDO", concluidoEm } });
  }

  describe("cadastro", () => {
    it("criação mínima: só o título, em A_ESTUDAR, sem label", async () => {
      const topico = await criar({ titulo: "  Terapia do esquema  " });
      expect(topico).toMatchObject({
        titulo: "Terapia do esquema",
        descricao: null,
        label: null,
        status: "A_ESTUDAR",
        concluidoEm: null,
      });
      const q = await quadro();
      expect(q.aEstudar.map((t) => t.id)).toEqual([topico.id]);
      expect(q.pendentes).toBe(1);
    });

    it("status enviado na criação é ignorado: nasce A_ESTUDAR", async () => {
      const topico = await criar({ titulo: "X", status: "CONCLUIDO", concluidoEm: new Date() });
      expect(topico).toMatchObject({ status: "A_ESTUDAR", concluidoEm: null });
    });

    it.each(["", "   "])("título %j responde 422 em titulo", async (titulo) => {
      const resposta = await amb.api("POST", "/topicos", { titulo, descricao: "Mantida" });
      expect(resposta.statusCode).toBe(422);
      expect(resposta.json().campos).toEqual([{ caminho: "titulo", mensagem: "Informe o título" }]);
    });

    it("título acima de 200 e descrição acima de 2000 respondem 422", async () => {
      const resposta = await amb.api("POST", "/topicos", {
        titulo: "x".repeat(201),
        descricao: "x".repeat(2001),
      });
      expect(resposta.statusCode).toBe(422);
      expect(resposta.json().campos.map((c: { caminho: string }) => c.caminho)).toEqual([
        "titulo",
        "descricao",
      ]);
    });

    it("labelId inexistente responde 422 em labelId", async () => {
      const resposta = await amb.api("POST", "/topicos", {
        titulo: "X",
        labelId: "0199a000-0000-7000-8000-0000000000ff",
      });
      expect(resposta.statusCode).toBe(422);
      expect(resposta.json().campos).toEqual([{ caminho: "labelId", mensagem: "Label não encontrada" }]);
      expect(await amb.prisma.topicoEstudo.count()).toBe(0);
    });

    it("label excluída entre a verificação e a gravação: 422 pela FK", async () => {
      const nova = (await amb.api("POST", "/labels", { nome: "Efêmera", cor: "BEGE" })).json();
      const repositorio = amb.app.get(TopicoRepository);
      const verificar = repositorio.labelExiste.bind(repositorio);
      vi.spyOn(repositorio, "labelExiste").mockImplementationOnce(async (id) => {
        const vista = await verificar(id);
        await amb.prisma.labelPrioridade.delete({ where: { id } });
        return vista;
      });

      const resposta = await amb.api("POST", "/topicos", { titulo: "X", labelId: nova.id });
      expect(resposta.statusCode).toBe(422);
      expect(resposta.json().campos[0].caminho).toBe("labelId");
      expect(await amb.prisma.topicoEstudo.count()).toBe(0);
    });

    it("trocar e remover a label; status no PATCH é ignorado", async () => {
      const topico = await criar({ titulo: "X", labelId: LABELS_INICIAIS.alta });
      expect(topico.label?.nome).toBe("Alta");

      const trocado = await amb.api("PATCH", `/topicos/${topico.id}`, {
        labelId: LABELS_INICIAIS.baixa,
        status: "CONCLUIDO",
      });
      expect(trocado.statusCode).toBe(200);
      expect(trocado.json()).toMatchObject({ label: { nome: "Baixa" }, status: "A_ESTUDAR" });

      const removido = await amb.api("PATCH", `/topicos/${topico.id}`, { labelId: null });
      expect(removido.json()).toMatchObject({ label: null, titulo: "X" });
    });

    it("PATCH edita título e descrição; descrição vazia apaga", async () => {
      const topico = await criar({ titulo: "X", descricao: "Antes" });
      const editado = (await amb.api("PATCH", `/topicos/${topico.id}`, { titulo: "Y" })).json();
      expect(editado).toMatchObject({ titulo: "Y", descricao: "Antes" });
      const apagado = (await amb.api("PATCH", `/topicos/${topico.id}`, { descricao: " " })).json();
      expect(apagado.descricao).toBeNull();
    });

    it("PATCH com título em branco responde 422 em titulo", async () => {
      const topico = await criar({ titulo: "X" });
      const resposta = await amb.api("PATCH", `/topicos/${topico.id}`, { titulo: "  " });
      expect(resposta.statusCode).toBe(422);
      expect(resposta.json().campos[0].caminho).toBe("titulo");
    });

    it("não existe rota de exclusão de tópico", async () => {
      const topico = await criar({ titulo: "X" });
      const resposta = await amb.api("DELETE", `/topicos/${topico.id}`);
      expect(resposta.statusCode).toBe(404);
      expect(await amb.prisma.topicoEstudo.count()).toBe(1);
    });

    it("tópico inexistente responde 404 no PATCH e no mover", async () => {
      const id = "0199a000-0000-7000-8000-0000000000ff";
      expect((await amb.api("PATCH", `/topicos/${id}`, { titulo: "X" })).statusCode).toBe(404);
      expect((await amb.api("POST", `/topicos/${id}/mover`, { status: "EM_ESTUDO" })).statusCode).toBe(404);
    });
  });

  describe("estados", () => {
    // Saltos de minutos: a sessão expira com 30 min de inatividade, contados
    // pelo relógio falso.
    afterEach(async () => {
      vi.useRealTimers();
      // A sessão renovou a expiração pelo relógio falso.
      await amb.reautenticar();
    });

    it("de qualquer estado para qualquer outro, com concluidoEm coerente", async () => {
      const { id } = await criar({ titulo: "X" });
      expect(await mover(id, { status: "EM_ESTUDO" })).toMatchObject({ status: "EM_ESTUDO", concluidoEm: null });
      expect((await mover(id, { status: "CONCLUIDO" })).concluidoEm).not.toBeNull();
      expect(await mover(id, { status: "A_ESTUDAR" })).toMatchObject({ status: "A_ESTUDAR", concluidoEm: null });
      // Direto de A_ESTUDAR, sem passar por EM_ESTUDO.
      expect((await mover(id, { status: "CONCLUIDO" })).status).toBe("CONCLUIDO");
      expect(await mover(id, { status: "EM_ESTUDO" })).toMatchObject({ concluidoEm: null });
    });

    it("concluir, reabrir e concluir de novo grava o instante da segunda conclusão", async () => {
      const { id } = await criar({ titulo: "X" });
      vi.useFakeTimers({ toFake: ["Date"], now: sp("2026-06-14T10:00") });
      await mover(id, { status: "CONCLUIDO" });
      vi.setSystemTime(sp("2026-06-14T10:05"));
      await mover(id, { status: "EM_ESTUDO" });
      vi.setSystemTime(sp("2026-06-14T10:10"));
      const segunda = await mover(id, { status: "CONCLUIDO" });

      expect(segunda.concluidoEm).toBe(sp("2026-06-14T10:10").toISOString());
      const gravado = await amb.prisma.topicoEstudo.findUniqueOrThrow({ where: { id } });
      expect(gravado.concluidoEm).toEqual(sp("2026-06-14T10:10"));
    });

    it("concluidoEm enviado no corpo é ignorado: vale o do servidor", async () => {
      const { id } = await criar({ titulo: "X" });
      vi.useFakeTimers({ toFake: ["Date"], now: sp("2026-06-14T10:00") });
      const topico = await mover(id, { status: "CONCLUIDO", concluidoEm: "2020-01-01T00:00:00.000Z" });
      expect(topico.concluidoEm).toBe(sp("2026-06-14T10:00").toISOString());

      // Também ao sair de CONCLUIDO: o corpo não mantém data nenhuma.
      const reaberto = await mover(id, { status: "EM_ESTUDO", concluidoEm: "2020-01-01T00:00:00.000Z" });
      expect(reaberto.concluidoEm).toBeNull();
    });

    it("mover para o mesmo estado responde 200 sem regravar nada", async () => {
      const { id } = await criar({ titulo: "X" });
      vi.useFakeTimers({ toFake: ["Date"], now: sp("2026-06-14T10:00") });
      const concluido = await mover(id, { status: "CONCLUIDO" });

      vi.setSystemTime(sp("2026-06-14T10:05"));
      const denovo = await mover(id, { status: "CONCLUIDO" });
      expect(denovo).toEqual(concluido);
    });

    it("status fora dos três responde 422 em status", async () => {
      const { id } = await criar({ titulo: "X" });
      const resposta = await amb.api("POST", `/topicos/${id}/mover`, { status: "ARQUIVADO" });
      expect(resposta.statusCode).toBe(422);
      expect(resposta.json().campos[0].caminho).toBe("status");
    });
  });

  describe("quadro", () => {
    it("ordem: label por prioridade, sem label por último, mais antigos primeiro no mesmo nível", async () => {
      const semLabel = await criar({ titulo: "Sem label" });
      const baixa = await criar({ titulo: "Baixa", labelId: LABELS_INICIAIS.baixa });
      const altaAntiga = await criar({ titulo: "Alta antiga", labelId: LABELS_INICIAIS.alta });
      const altaNova = await criar({ titulo: "Alta nova", labelId: LABELS_INICIAIS.alta });
      // Mesma regra na coluna Em estudo.
      const emEstudoSem = await criar({ titulo: "Em estudo sem" });
      const emEstudoMedia = await criar({ titulo: "Em estudo média", labelId: LABELS_INICIAIS.media });
      await mover(emEstudoSem.id, { status: "EM_ESTUDO" });
      await mover(emEstudoMedia.id, { status: "EM_ESTUDO" });

      const q = await quadro();
      expect(q.aEstudar.map((t) => t.titulo)).toEqual([
        altaAntiga.titulo,
        altaNova.titulo,
        baixa.titulo,
        semLabel.titulo,
      ]);
      expect(q.emEstudo.map((t) => t.titulo)).toEqual(["Em estudo média", "Em estudo sem"]);
    });

    it("a ordem segue a label, não o nome: renomear não muda, reordenar muda", async () => {
      await criar({ titulo: "Baixa", labelId: LABELS_INICIAIS.baixa });
      await criar({ titulo: "Alta", labelId: LABELS_INICIAIS.alta });
      await amb.api("PATCH", `/labels/${LABELS_INICIAIS.alta}`, { nome: "Urgente" });
      expect((await quadro()).aEstudar.map((t) => t.label?.nome)).toEqual(["Urgente", "Baixa"]);

      const { alta, media, baixa } = LABELS_INICIAIS;
      await amb.api("PUT", "/labels/ordem", { ids: [baixa, alta, media] });
      expect((await quadro()).aEstudar.map((t) => t.label?.nome)).toEqual(["Baixa", "Urgente"]);
    });

    it("contadores: 5 pendentes · 4 concluídos este mês; coluna com 12, cinco cartões", async () => {
      vi.useFakeTimers({ toFake: ["Date"], now: sp("2026-09-20T12:00") });
      try {
        for (let i = 0; i < 3; i++) await criar({ titulo: `A estudar ${i}` });
        for (let i = 0; i < 2; i++) await mover((await criar({ titulo: `Em estudo ${i}` })).id, { status: "EM_ESTUDO" });
        for (const dia of ["01", "05", "10", "19"]) await concluidoEm(sp(`2026-09-${dia}T09:00`), `Set ${dia}`);
        for (let mes = 1; mes <= 8; mes++) {
          await concluidoEm(sp(`2026-0${mes}-15T09:00`), `Mês ${mes}`);
        }

        const q = await quadro();
        expect(q.pendentes).toBe(5);
        expect(q.concluidosNoMes).toBe(4);
        expect(q.totalConcluidos).toBe(12);
        expect(q.concluidos.map((t) => t.titulo)).toEqual(["Set 19", "Set 10", "Set 05", "Set 01", "Mês 8"]);
      } finally {
        vi.useRealTimers();
        await amb.reautenticar();
      }
    });

    it("quadro vazio", async () => {
      expect(await quadro()).toEqual({
        aEstudar: [],
        emEstudo: [],
        concluidos: [],
        totalConcluidos: 0,
        pendentes: 0,
        concluidosNoMes: 0,
      });
    });
  });

  describe("histórico de concluídos", () => {
    async function pagina(n?: number): Promise<PaginaConcluidos> {
      const resposta = await amb.api("GET", `/topicos/concluidos${n ? `?pagina=${n}` : ""}`);
      expect(resposta.statusCode).toBe(200);
      return resposta.json();
    }

    it("60 concluídos: 50 mais recentes na primeira página, 10 na segunda", async () => {
      const base = sp("2026-01-01T09:00").getTime();
      await amb.prisma.topicoEstudo.createMany({
        data: Array.from({ length: 60 }, (_, i) => ({
          titulo: `T${String(i).padStart(2, "0")}`,
          status: "CONCLUIDO" as const,
          concluidoEm: new Date(base + i * 3_600_000),
        })),
      });
      await criar({ titulo: "Pendente não entra" });

      const primeira = await pagina();
      expect(primeira).toMatchObject({ total: 60, page: 1, size: TAMANHO_MAXIMO_PAGINA });
      expect(primeira.itens).toHaveLength(50);
      expect(primeira.itens[0].titulo).toBe("T59");
      expect(primeira.itens[49].titulo).toBe("T10");

      const segunda = await pagina(2);
      expect(segunda.itens.map((t) => t.titulo)).toEqual(
        Array.from({ length: 10 }, (_, i) => `T${String(9 - i).padStart(2, "0")}`),
      );
    });

    it("reabrir pelo histórico tira dele e põe na coluna", async () => {
      const t = await concluidoEm(sp("2026-06-14T09:00"));
      await mover(t.id, { status: "A_ESTUDAR" });
      expect((await pagina()).total).toBe(0);
      expect((await quadro()).aEstudar.map((x) => x.id)).toEqual([t.id]);
    });

    it("página inválida responde 422", async () => {
      expect((await amb.api("GET", "/topicos/concluidos?pagina=0")).statusCode).toBe(422);
    });
  });

  it("nenhuma rota de tópicos grava na trilha de auditoria", async () => {
    const antes = await amb.prisma.auditoria.count();
    const { id } = await criar({ titulo: "X" });
    await amb.api("PATCH", `/topicos/${id}`, { titulo: "Y" });
    await mover(id, { status: "CONCLUIDO" });
    await quadro();
    await amb.api("GET", "/topicos/concluidos");
    expect(await amb.prisma.auditoria.count()).toBe(antes);
  });
});
