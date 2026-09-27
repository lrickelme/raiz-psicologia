import { COOKIE_SESSAO_EXPIRA } from "@raiz/shared";
import { expect, test } from "@playwright/test";
import { URL_WEB } from "./ambiente";
import {
  abrirEditor,
  cadastrarPaciente,
  entrar,
  rascunhoNoServidor,
  reautenticar,
} from "./apoio";

test.beforeEach(async ({ page }) => {
  await entrar(page);
});

test("gravar com salvamento em voo não recria o rascunho", async ({ page }) => {
  const paciente = await cadastrarPaciente(page);
  const editor = await abrirEditor(page, paciente.id);

  // Segura cada salvamento de rascunho antes de ele chegar ao servidor: é a
  // janela em que um cliente que não espera enviaria o POST na frente.
  const ordem: string[] = [];
  await page.route("**/api/v1/prontuario/rascunho*", async (rota) => {
    if (rota.request().method() !== "PUT") return rota.continue();
    await new Promise((r) => setTimeout(r, 1500));
    await rota.continue();
    ordem.push("PUT chegou ao servidor");
  });
  page.on("request", (requisicao) => {
    if (requisicao.method() === "POST" && requisicao.url().endsWith("/evolucoes")) {
      ordem.push("POST enviado");
    }
  });

  await editor.fill("Sessão sobre o retorno ao trabalho.");
  await page.waitForRequest((r) => r.method() === "PUT" && r.url().includes("/prontuario/rascunho"));
  await page.getByRole("button", { name: "Gravar evolução" }).click();

  await expect(page.getByText("1 registro")).toBeVisible();
  expect(ordem).toEqual(["PUT chegou ao servidor", "POST enviado"]);
  expect(await rascunhoNoServidor(page, paciente.id)).toBeNull();

  await page.unrouteAll({ behavior: "wait" });
  await page.reload();
  await expect(page.getByText("1 registro")).toBeVisible();
  await expect(page.getByText("Há um rascunho não gravado")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Nova evolução" })).toBeVisible();
});

test("401 durante a edição preserva o trecho posterior ao último salvamento", async ({ page }) => {
  const paciente = await cadastrarPaciente(page);
  const editor = await abrirEditor(page, paciente.id);
  const url = page.url();

  await editor.fill("Primeira parte, já salva.");
  await expect(page.getByText(/Rascunho salvo às/)).toBeVisible();

  // A sessão some: o próximo salvamento recebe 401.
  await page.context().clearCookies();
  await editor.press("End");
  await editor.pressSequentially(" Trecho escrito depois do último salvamento.");

  await expect(page.getByRole("dialog", { name: "Sua sessão expirou" })).toBeVisible();
  expect(page.url()).toBe(url);
  const integral = "Primeira parte, já salva. Trecho escrito depois do último salvamento.";
  await expect(editor).toHaveValue(integral);

  await reautenticar(page);

  await expect(page.getByText(/Rascunho salvo às/)).toBeVisible();
  await expect(editor).toHaveValue(integral);
  expect(await rascunhoNoServidor(page, paciente.id)).toBe(integral);
});

test("aviso de expiração do shell cede ao editor em vez de ir ao login", async ({ page }) => {
  const paciente = await cadastrarPaciente(page);
  const editor = await abrirEditor(page, paciente.id);
  const url = page.url();
  await editor.fill("Texto em edição quando a contagem zera.");
  await expect(page.getByText(/Rascunho salvo às/)).toBeVisible();

  await page.context().addCookies([
    {
      name: COOKIE_SESSAO_EXPIRA,
      value: encodeURIComponent(new Date(Date.now() - 1000).toISOString()),
      url: URL_WEB,
    },
  ]);

  await expect(page.getByRole("dialog", { name: "Sua sessão expirou" })).toBeVisible();
  await page.waitForTimeout(1500);
  expect(page.url()).toBe(url);
  await expect(editor).toHaveValue("Texto em edição quando a contagem zera.");
});

test("nada de texto clínico em armazenamento do navegador após um 401", async ({ page, context }) => {
  const paciente = await cadastrarPaciente(page);
  const editor = await abrirEditor(page, paciente.id);
  const marcador = "Conteúdo-sigiloso-7f3a";

  await editor.fill(`${marcador} parte salva.`);
  await expect(page.getByText(/Rascunho salvo às/)).toBeVisible();
  await context.clearCookies();
  await editor.press("End");
  await editor.pressSequentially(` ${marcador} parte retida.`);
  await expect(page.getByRole("dialog", { name: "Sua sessão expirou" })).toBeVisible();

  const varrer = () =>
    page.evaluate(async () => {
      const valores = (armazenamento: Storage) =>
        Array.from({ length: armazenamento.length }, (_, i) => {
          const chave = armazenamento.key(i)!;
          return `${chave}=${armazenamento.getItem(chave)}`;
        });
      return {
        local: valores(localStorage),
        sessao: valores(sessionStorage),
        indexedDb: (await indexedDB.databases()).map((banco) => banco.name),
        cookies: document.cookie,
      };
    });

  const durante = await varrer();
  expect(JSON.stringify(durante)).not.toContain(marcador);
  expect(durante.indexedDb).toEqual([]);

  // Aba fechada sem reautenticar: a retenção era só memória.
  await page.close({ runBeforeUnload: false });
  const nova = await context.newPage();
  await nova.goto("/login");
  const depois = await nova.evaluate(async () => ({
    local: JSON.stringify({ ...localStorage }),
    sessao: JSON.stringify({ ...sessionStorage }),
    indexedDb: (await indexedDB.databases()).map((banco) => banco.name),
  }));
  expect(JSON.stringify(depois)).not.toContain(marcador);
  expect(depois.indexedDb).toEqual([]);
});
