import { expect, test, type Page } from "@playwright/test";
import type { Label, Topico } from "@raiz/shared";
import { entrar } from "./apoio";

/** O banco é compartilhado entre os testes: títulos e labels levam sufixo próprio. */
const sufixo = () => Math.random().toString(36).slice(2, 7);

const coluna = (page: Page, nome: "A estudar" | "Em estudo" | "Concluídos") =>
  page.getByRole("region", { name: nome, exact: true });

async function criarLabel(page: Page, nome: string): Promise<Label> {
  const resposta = await page.request.post("/api/v1/labels", { data: { nome, cor: "MARROM" } });
  expect(resposta.status()).toBe(201);
  return resposta.json();
}

async function criarTopico(page: Page, titulo: string, labelId?: string): Promise<Topico> {
  const resposta = await page.request.post("/api/v1/topicos", { data: { titulo, labelId } });
  expect(resposta.status()).toBe(201);
  return resposta.json();
}

async function acao(page: Page, titulo: string, item: string) {
  await page.getByRole("button", { name: `Ações de “${titulo}”` }).click();
  await page.getByRole("menuitem", { name: item }).click();
}

test.beforeEach(async ({ page }) => {
  await entrar(page);
});

test.describe("estudos", () => {
  test("criar tópico, mover, concluir e reabrir pelo histórico", async ({ page }) => {
    const titulo = `Terapia do Esquema ${sufixo()}`;
    await page.goto("/estudos");
    await expect(page.getByRole("heading", { name: "Conteúdos a estudar" })).toBeVisible();

    // Título em branco: erro no campo, sem perder a descrição.
    await page.getByRole("button", { name: "+ Novo tópico" }).click();
    const modal = page.getByRole("dialog", { name: "Novo tópico" });
    await expect(modal.getByText(/Estudos não é prontuário/)).toBeVisible();
    await modal.getByLabel("Título").fill("   ");
    await modal.getByLabel("Descrição (opcional)").fill("Módulo 3 de 8.");
    await modal.getByRole("button", { name: "Criar tópico" }).click();
    await expect(modal.getByText("Informe o título")).toBeVisible();
    await expect(modal.getByLabel("Descrição (opcional)")).toHaveValue("Módulo 3 de 8.");

    await modal.getByLabel("Título").fill(titulo);
    await modal.getByLabel("Prioridade").selectOption({ label: "Alta" });
    await modal.getByRole("button", { name: "Criar tópico" }).click();
    await expect(modal).toBeHidden();
    const cartao = coluna(page, "A estudar").getByRole("article", { name: titulo });
    await expect(cartao).toContainText("Alta");
    await expect(cartao).toContainText("Módulo 3 de 8.");

    // Menu operável por teclado.
    await page.getByRole("button", { name: `Ações de “${titulo}”` }).focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitem", { name: "Mover para Em estudo" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(coluna(page, "Em estudo").getByRole("article", { name: titulo })).toBeVisible();
    await expect(coluna(page, "A estudar").getByRole("article", { name: titulo })).toHaveCount(0);

    await page.getByRole("checkbox", { name: `Concluído: ${titulo}` }).check();
    const concluido = coluna(page, "Concluídos").getByRole("article", { name: titulo });
    await expect(concluido).toContainText("concluído");
    await expect(page.getByRole("checkbox", { name: `Concluído: ${titulo}` })).toBeChecked();
    // A conclusão marca, não apaga: o servidor confirma depois de recarregar.
    await page.reload();
    await expect(coluna(page, "Concluídos").getByRole("article", { name: titulo })).toBeVisible();

    await coluna(page, "Concluídos").getByRole("link", { name: /no histórico|Ver histórico/ }).click();
    await expect(page.getByRole("heading", { name: "Histórico de estudos" })).toBeVisible();
    const item = page.getByRole("listitem").filter({ hasText: titulo });
    await expect(item).toContainText("Alta");
    await acao(page, titulo, "Reabrir em A estudar");
    await expect(item).toHaveCount(0);

    await page.getByRole("link", { name: "← Voltar ao quadro" }).click();
    await expect(coluna(page, "A estudar").getByRole("article", { name: titulo })).toBeVisible();
    await expect(coluna(page, "Concluídos").getByRole("article", { name: titulo })).toHaveCount(0);
  });

  test("label em uso não é excluída; depois de trocar a prioridade dos tópicos, é", async ({ page }) => {
    const marca = sufixo();
    const label = await criarLabel(page, `Leitura ${marca}`);
    const pendente = await criarTopico(page, `Artigo ${marca}`, label.id);
    const concluido = await criarTopico(page, `Webinar ${marca}`, label.id);
    await page.request.post(`/api/v1/topicos/${concluido.id}/mover`, { data: { status: "CONCLUIDO" } });

    await page.goto("/estudos");
    await page.getByRole("button", { name: "Gerenciar labels" }).click();
    const gestao = page.getByRole("dialog", { name: "Labels de prioridade" });
    await gestao.getByRole("button", { name: `Excluir ${label.nome}` }).click();
    await expect(gestao.getByRole("alert")).toContainText("em uso por 2 tópicos");
    await gestao.getByRole("button", { name: "Entendi" }).click();
    await page.keyboard.press("Escape");
    expect((await (await page.request.get("/api/v1/labels")).json()).map((l: Label) => l.id)).toContain(label.id);

    // Troca a prioridade dos dois, o concluído inclusive, pela interface.
    for (const titulo of [pendente.titulo, concluido.titulo]) {
      await acao(page, titulo, "Editar");
      const modal = page.getByRole("dialog", { name: "Editar tópico" });
      await modal.getByLabel("Prioridade").selectOption({ label: "Sem prioridade" });
      await modal.getByRole("button", { name: "Salvar" }).click();
      await expect(modal).toBeHidden();
    }
    await expect(coluna(page, "A estudar").getByRole("article", { name: pendente.titulo })).not.toContainText(
      label.nome,
    );

    await page.getByRole("button", { name: "Gerenciar labels" }).click();
    await expect(gestao.getByText(label.nome).locator("..")).toContainText("sem tópicos");

    // Associada por outra aba entre o aviso e a confirmação: o 409 do servidor vence.
    await gestao.getByRole("button", { name: `Excluir ${label.nome}` }).click();
    await page.request.patch(`/api/v1/topicos/${pendente.id}`, { data: { labelId: label.id } });
    await gestao.getByRole("button", { name: "Excluir", exact: true }).click();
    await expect(gestao.getByRole("alert")).toContainText("em uso por 1 tópico");
    await gestao.getByRole("button", { name: "Entendi" }).click();

    await page.request.patch(`/api/v1/topicos/${pendente.id}`, { data: { labelId: null } });
    await page.keyboard.press("Escape");
    await page.reload();
    await page.getByRole("button", { name: "Gerenciar labels" }).click();
    await gestao.getByRole("button", { name: `Excluir ${label.nome}` }).click();
    await gestao.getByRole("button", { name: "Excluir", exact: true }).click();
    await expect(gestao.getByText(label.nome)).toHaveCount(0);

    // Some também do seletor do formulário de tópico.
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "+ Novo tópico" }).click();
    await expect(
      page.getByRole("dialog", { name: "Novo tópico" }).getByRole("option", { name: label.nome }),
    ).toHaveCount(0);
  });
});
