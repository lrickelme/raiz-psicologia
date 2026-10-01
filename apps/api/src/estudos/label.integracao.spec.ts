import type { Label, LabelComUso, Topico } from "@raiz/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { subirAmbiente, type Ambiente } from "../teste/ambiente";
import { LABELS_INICIAIS, reiniciarEstudos } from "../teste/estudos";
import { LabelRepository } from "./label.repository";

describe("labels de prioridade (integração)", () => {
  let amb: Ambiente;

  beforeAll(async () => {
    amb = await subirAmbiente();
  }, 180_000);

  afterAll(() => amb?.encerrar());

  beforeEach(() => reiniciarEstudos(amb.prisma));
  afterEach(() => vi.restoreAllMocks());

  async function labels(): Promise<LabelComUso[]> {
    const resposta = await amb.api("GET", "/labels");
    expect(resposta.statusCode).toBe(200);
    return resposta.json();
  }

  async function topico(labelId: string | null, titulo = "Tópico"): Promise<Topico> {
    const resposta = await amb.api("POST", "/topicos", { titulo, labelId });
    expect(resposta.statusCode).toBe(201);
    return resposta.json();
  }

  const nomes = async () => (await labels()).map((l) => `${l.ordem}:${l.nome}`);

  it("lista em ordem, com emUso contando tópicos de qualquer estado", async () => {
    await topico(LABELS_INICIAIS.media);
    const concluido = await topico(LABELS_INICIAIS.media);
    await amb.api("POST", `/topicos/${concluido.id}/mover`, { status: "CONCLUIDO" });

    expect(await labels()).toEqual([
      { id: LABELS_INICIAIS.alta, nome: "Alta", cor: "VINHO", ordem: 1, emUso: 0 },
      { id: LABELS_INICIAIS.media, nome: "Média", cor: "AMBAR", ordem: 2, emUso: 2 },
      { id: LABELS_INICIAIS.baixa, nome: "Baixa", cor: "MUSGO", ordem: 3, emUso: 0 },
    ]);
  });

  describe("criar", () => {
    it("nova label entra no fim", async () => {
      const resposta = await amb.api("POST", "/labels", { nome: " Leitura leve ", cor: "BEGE" });
      expect(resposta.statusCode).toBe(201);
      expect(resposta.json()).toMatchObject({ nome: "Leitura leve", cor: "BEGE", ordem: 4 });
    });

    it.each(["alta", "ALTA", "Álta"])("nome repetido (%s) responde 409", async (nome) => {
      const resposta = await amb.api("POST", "/labels", { nome, cor: "BEGE" });
      expect(resposta.statusCode).toBe(409);
      expect(resposta.json().detail).toBe("Já existe uma label com esse nome");
      expect(await nomes()).toEqual(["1:Alta", "2:Média", "3:Baixa"]);
    });

    it.each(["#FF00FF", "ROXO"])("cor fora da paleta (%s) responde 422 em cor", async (cor) => {
      const resposta = await amb.api("POST", "/labels", { nome: "Nova", cor });
      expect(resposta.statusCode).toBe(422);
      expect(resposta.json().campos).toEqual([
        { caminho: "cor", mensagem: "Escolha uma cor da paleta" },
      ]);
    });

    it("nome vazio ou acima de 30 caracteres responde 422 em nome", async () => {
      for (const nome of ["   ", "x".repeat(31)]) {
        const resposta = await amb.api("POST", "/labels", { nome, cor: "BEGE" });
        expect(resposta.statusCode).toBe(422);
        expect(resposta.json().campos.map((c: { caminho: string }) => c.caminho)).toEqual(["nome"]);
      }
    });
  });

  describe("alterar", () => {
    it("renomear muda o nome exibido pelos tópicos, sem mudar a ordem", async () => {
      const t = await topico(LABELS_INICIAIS.media);
      const resposta = await amb.api("PATCH", `/labels/${LABELS_INICIAIS.media}`, { nome: "Normal" });
      expect(resposta.statusCode).toBe(200);
      expect(resposta.json()).toEqual({
        id: LABELS_INICIAIS.media,
        nome: "Normal",
        cor: "AMBAR",
        ordem: 2,
      } satisfies Label);

      const quadro = (await amb.api("GET", "/estudos/quadro")).json();
      expect(quadro.aEstudar.find((x: Topico) => x.id === t.id).label.nome).toBe("Normal");
    });

    it("trocar a cor", async () => {
      const resposta = await amb.api("PATCH", `/labels/${LABELS_INICIAIS.baixa}`, { cor: "MUSGO_SUAVE" });
      expect(resposta.json()).toMatchObject({ nome: "Baixa", cor: "MUSGO_SUAVE" });
    });

    it("renomear para nome de outra label, em outra caixa, responde 409", async () => {
      const resposta = await amb.api("PATCH", `/labels/${LABELS_INICIAIS.baixa}`, { nome: "ALTA" });
      expect(resposta.statusCode).toBe(409);
      expect(await nomes()).toEqual(["1:Alta", "2:Média", "3:Baixa"]);
    });

    it("renomear para o próprio nome em outra caixa é permitido", async () => {
      const resposta = await amb.api("PATCH", `/labels/${LABELS_INICIAIS.alta}`, { nome: "ALTA" });
      expect(resposta.statusCode).toBe(200);
    });

    it("cor inválida responde 422 em cor", async () => {
      const resposta = await amb.api("PATCH", `/labels/${LABELS_INICIAIS.alta}`, { cor: "#FF00FF" });
      expect(resposta.statusCode).toBe(422);
      expect(resposta.json().campos[0].caminho).toBe("cor");
    });

    it("label inexistente responde 404", async () => {
      const resposta = await amb.api("PATCH", "/labels/0199a000-0000-7000-8000-0000000000ff", {
        nome: "X",
      });
      expect(resposta.statusCode).toBe(404);
    });
  });

  describe("reordenar", () => {
    it("Baixa para o topo: Baixa, Alta, Média", async () => {
      const { alta, media, baixa } = LABELS_INICIAIS;
      const resposta = await amb.api("PUT", "/labels/ordem", { ids: [baixa, alta, media] });
      expect(resposta.statusCode).toBe(200);
      expect((resposta.json() as LabelComUso[]).map((l) => `${l.ordem}:${l.nome}`)).toEqual([
        "1:Baixa",
        "2:Alta",
        "3:Média",
      ]);
    });

    it("lista que não é o conjunto atual responde 409 e não muda nada", async () => {
      const { alta, media, baixa } = LABELS_INICIAIS;
      const nova: Label = (await amb.api("POST", "/labels", { nome: "Nova", cor: "BEGE" })).json();
      for (const ids of [
        [baixa, alta, media], // desatualizada: falta a criada em outra aba
        [nova.id, baixa, alta, media, media], // repetida
        [nova.id, baixa, alta, alta], // mesmo tamanho, conjunto diferente
        [nova.id, baixa, alta, "0199a000-0000-7000-8000-0000000000ff"], // desconhecida
      ]) {
        const resposta = await amb.api("PUT", "/labels/ordem", { ids });
        expect(resposta.statusCode).toBe(409);
      }
      expect(await nomes()).toEqual(["1:Alta", "2:Média", "3:Baixa", "4:Nova"]);
    });
  });

  describe("excluir", () => {
    it("label livre: 204, e a ordem fica sem buracos depois de excluir a do meio", async () => {
      const resposta = await amb.api("DELETE", `/labels/${LABELS_INICIAIS.media}`);
      expect(resposta.statusCode).toBe(204);
      expect(await nomes()).toEqual(["1:Alta", "2:Baixa"]);

      const nova = await amb.api("POST", "/labels", { nome: "Nova", cor: "BEGE" });
      expect(nova.json().ordem).toBe(3);
    });

    it("em uso por pendentes e concluído: 409 com a quantidade, nada muda", async () => {
      await topico(LABELS_INICIAIS.media);
      await topico(LABELS_INICIAIS.media);
      const concluido = await topico(LABELS_INICIAIS.media);
      await amb.api("POST", `/topicos/${concluido.id}/mover`, { status: "CONCLUIDO" });

      const resposta = await amb.api("DELETE", `/labels/${LABELS_INICIAIS.media}`);
      expect(resposta.statusCode).toBe(409);
      expect(resposta.json()).toMatchObject({ title: "Label em uso", topicos: 3 });
      expect(await nomes()).toEqual(["1:Alta", "2:Média", "3:Baixa"]);
    });

    it("usada só por tópico concluído também é bloqueada", async () => {
      const concluido = await topico(LABELS_INICIAIS.baixa);
      await amb.api("POST", `/topicos/${concluido.id}/mover`, { status: "CONCLUIDO" });

      const resposta = await amb.api("DELETE", `/labels/${LABELS_INICIAIS.baixa}`);
      expect(resposta.statusCode).toBe(409);
      expect(resposta.json().topicos).toBe(1);
    });

    it("tópico associado entre a contagem e o DELETE: 409 pela FK", async () => {
      const repositorio = amb.app.get(LabelRepository);
      const contar = repositorio.contarTopicos.bind(repositorio);
      // A contagem do serviço vê zero; logo depois, outra requisição associa
      // um tópico. O DELETE que segue esbarra na FK.
      vi.spyOn(repositorio, "contarTopicos").mockImplementationOnce(async (labelId) => {
        const vista = await contar(labelId);
        await amb.prisma.topicoEstudo.create({ data: { titulo: "Na corrida", labelId } });
        return vista;
      });

      const resposta = await amb.api("DELETE", `/labels/${LABELS_INICIAIS.baixa}`);
      expect(resposta.statusCode).toBe(409);
      expect(resposta.json()).toMatchObject({ title: "Label em uso", topicos: 1 });
      expect(await nomes()).toEqual(["1:Alta", "2:Média", "3:Baixa"]);
    });

    it("label inexistente responde 404", async () => {
      const resposta = await amb.api("DELETE", "/labels/0199a000-0000-7000-8000-0000000000ff");
      expect(resposta.statusCode).toBe(404);
    });
  });

  it("nenhuma rota de labels grava na trilha de auditoria", async () => {
    const antes = await amb.prisma.auditoria.count();
    await amb.api("GET", "/labels");
    await amb.api("POST", "/labels", { nome: "Nova", cor: "BEGE" });
    await amb.api("PATCH", `/labels/${LABELS_INICIAIS.alta}`, { nome: "Urgente" });
    expect(await amb.prisma.auditoria.count()).toBe(antes);
  });
});
