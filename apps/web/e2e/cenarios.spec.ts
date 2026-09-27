import type { EvolucaoResumo, Paciente } from "@raiz/shared";
import { expect, test, type Page } from "@playwright/test";
import { abrirEditor, cadastrarPaciente, entrar, rascunhoNoServidor } from "./apoio";

/**
 * Cenários de interface das delta specs de pacientes e prontuário que os
 * testes da API não alcançam (tarefa 8.1), e a ausência de cache na rota do
 * prontuário (8.2).
 */
test.use({ permissions: ["clipboard-read", "clipboard-write"] });

test.beforeEach(async ({ page }) => {
  await entrar(page);
});

async function registrar(page: Page, pacienteId: string, texto: string): Promise<EvolucaoResumo> {
  const resposta = await page.request.post(`/api/v1/pacientes/${pacienteId}/evolucoes`, {
    data: { texto },
  });
  expect(resposta.status()).toBe(201);
  return resposta.json();
}

async function arquivar(page: Page, paciente: Paciente) {
  expect((await page.request.post(`/api/v1/pacientes/${paciente.id}/arquivar`, { data: {} })).ok()).toBe(true);
}

test.describe("prontuário", () => {
  test("rascunho: recuperado após fechar a aba, com opção de retomar ou descartar", async ({ page, context }) => {
    const paciente = await cadastrarPaciente(page);
    const editor = await abrirEditor(page, paciente.id);
    await editor.fill("Texto longo escrito antes de a aba fechar.");
    await expect(page.getByText(/Rascunho salvo às/)).toBeVisible();
    await page.close({ runBeforeUnload: false });

    const nova = await context.newPage();
    await nova.goto(`/pacientes/${paciente.id}/prontuario`);
    await expect(nova.getByText("Há um rascunho não gravado")).toBeVisible();
    await nova.getByRole("button", { name: "Retomar rascunho" }).click();
    await expect(nova.getByLabel("Texto da evolução")).toHaveValue(
      "Texto longo escrito antes de a aba fechar.",
    );

    await nova.getByRole("button", { name: "Fechar e continuar depois" }).click();
    nova.once("dialog", (dialogo) => dialogo.accept());
    await nova.getByRole("button", { name: "Descartar" }).click();
    await expect(nova.getByText("Há um rascunho não gravado")).toHaveCount(0);
    expect(await rascunhoNoServidor(nova, paciente.id)).toBeNull();
  });

  test("retificar: a vigente aparece com a indicação, e o histórico traz as duas versões", async ({ page }) => {
    const paciente = await cadastrarPaciente(page);
    await registrar(page, paciente.id, "Versão original do registro.");
    await page.goto(`/pacientes/${paciente.id}/prontuario`);

    await page.getByRole("button", { name: "Ler evolução" }).click();
    await page.getByRole("button", { name: "Retificar" }).click();
    await expect(page.getByText("Versão vigente ·")).toBeVisible();
    await page.getByLabel("Texto corrigido").fill("Versão corrigida do registro.");
    await page.getByRole("button", { name: "Gravar retificação" }).click();

    await expect(page.getByText(/Retificada em/)).toBeVisible();
    await expect(page.getByText("1 registro")).toBeVisible();
    await page.getByRole("button", { name: "Histórico de versões" }).click();
    const historico = page.getByRole("dialog", { name: "Histórico de versões" });
    await expect(historico.getByText("Versão original do registro.")).toBeVisible();
    await expect(historico.getByText("Versão corrigida do registro.")).toBeVisible();
    await expect(historico.getByText("Retificada", { exact: true })).toBeVisible();
    await expect(historico.getByText("Vigente", { exact: true })).toBeVisible();
  });

  test("nenhum comando de excluir ou editar evolução na interface", async ({ page }) => {
    const paciente = await cadastrarPaciente(page);
    await registrar(page, paciente.id, "Registro que não pode ser apagado.");
    await page.goto(`/pacientes/${paciente.id}/prontuario`);
    await page.getByRole("button", { name: "Ler evolução" }).click();
    await expect(page.getByText("Registro que não pode ser apagado.")).toBeVisible();

    await expect(page.getByRole("button", { name: /excluir|apagar|editar/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /excluir|apagar|editar evolução/i })).toHaveCount(0);
  });

  test("paciente arquivado: evoluções legíveis e registro não oferecido", async ({ page }) => {
    const paciente = await cadastrarPaciente(page);
    await registrar(page, paciente.id, "Última evolução antes do arquivamento.");
    await arquivar(page, paciente);

    await page.goto(`/pacientes/${paciente.id}/prontuario`);
    await expect(page.getByText(/o prontuário é somente leitura/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Nova evolução|Continuar evolução/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Ler evolução" }).click();
    await expect(page.getByText("Última evolução antes do arquivamento.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Retificar" })).toHaveCount(0);
  });

  test("rota do prontuário, chamadas do BFF e PDF saem sem cache", async ({ page }) => {
    const paciente = await cadastrarPaciente(page);
    await registrar(page, paciente.id, "Texto clínico.");

    const pagina = await page.goto(`/pacientes/${paciente.id}/prontuario`);
    expect(pagina?.headers()["cache-control"]).toContain("no-store");

    const lista = await page.request.get(`/api/v1/pacientes/${paciente.id}/evolucoes`);
    expect(lista.headers()["cache-control"]).toBe("private, no-store");

    const pdf = await page.request.get(`/api/v1/pacientes/${paciente.id}/prontuario.pdf`);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
    expect(pdf.headers()["cache-control"]).toContain("no-store");
  });
});

test.describe("perfil do paciente", () => {
  test("acesso ao prontuário com contagem e data da mais recente, sem abrir texto", async ({ page }) => {
    const paciente = await cadastrarPaciente(page);
    await registrar(page, paciente.id, "Primeira.");
    await registrar(page, paciente.id, "Segunda.");

    const lidas: string[] = [];
    page.on("request", (r) => {
      if (/\/api\/v1\/evolucoes\//.test(r.url())) lidas.push(r.url());
    });
    await page.goto(`/pacientes/${paciente.id}`);
    await expect(page.getByText("2 evoluções")).toBeVisible();
    await expect(page.getByText(/Mais recente em \d{1,2} \w{3} \d{4}/)).toBeVisible();
    expect(lidas).toEqual([]);

    await page.getByRole("link", { name: "Abrir prontuário →" }).click();
    await expect(page).toHaveURL(new RegExp(`/pacientes/${paciente.id}/prontuario$`));
  });

  test("arquivado: data de elegibilidade com o prazo que a originou", async ({ page }) => {
    const paciente = await cadastrarPaciente(page);
    await registrar(page, paciente.id, "Registro.");
    await arquivar(page, paciente);

    await page.goto(`/pacientes/${paciente.id}`);
    await expect(page.getByText("Guarda do prontuário")).toBeVisible();
    const ano = new Date().getFullYear() + 20;
    await expect(page.getByText(new RegExp(`Elegível para descarte a partir de \\d{1,2} \\w{3} ${ano}`))).toBeVisible();
    await expect(page.getByText(/prazo configurado de 20 anos/)).toBeVisible();
    await expect(page.getByText(/Nada é apagado automaticamente/)).toBeVisible();
  });
});

test.describe("telefone", () => {
  async function campoTelefone(page: Page) {
    await page.goto("/pacientes/novo");
    const campo = page.getByLabel("Telefone");
    await campo.click();
    return campo;
  }

  const cursor = (campo: ReturnType<Page["getByLabel"]>) =>
    campo.evaluate((e: HTMLInputElement) => `${e.value.slice(0, e.selectionStart!)}|${e.value.slice(e.selectionStart!)}`);

  test("máscara progressiva e valor enviado só com dígitos", async ({ page }) => {
    const campo = await campoTelefone(page);
    await page.keyboard.type("839932");
    await expect(campo).toHaveValue("(83) 9932");
    await page.keyboard.type("29097");
    await expect(campo).toHaveValue("(83) 99322-9097");

    await page.getByLabel("Nome completo").fill("Paciente Telefone");
    await page.getByLabel("Valor da consulta (R$)").fill("150");
    const envio = page.waitForRequest((r) => r.method() === "POST" && r.url().endsWith("/api/v1/pacientes"));
    await page.getByRole("button", { name: "Cadastrar paciente" }).click();
    expect((await envio).postDataJSON().telefone).toBe("83993229097");
  });

  test("telefone fixo com 10 dígitos", async ({ page }) => {
    const campo = await campoTelefone(page);
    await page.keyboard.type("8332214567");
    await expect(campo).toHaveValue("(83) 3221-4567");
  });

  test("colar +55 (83) 99322-9097 normaliza e descarta o 55", async ({ page }) => {
    const campo = await campoTelefone(page);
    await page.evaluate(() => navigator.clipboard.writeText("+55 (83) 99322-9097"));
    await page.keyboard.press("ControlOrMeta+V");
    await expect(campo).toHaveValue("(83) 99322-9097");
  });

  test("backspace remove um dígito por toque e o cursor não salta para o fim", async ({ page }) => {
    const campo = await campoTelefone(page);
    await page.keyboard.type("83993229097");
    await campo.evaluate((e: HTMLInputElement) => e.setSelectionRange(11, 11)); // logo após o hífen
    await page.keyboard.press("Backspace");
    expect(await cursor(campo)).toBe("(83) 9932|-9097");
    await page.keyboard.press("Backspace");
    expect(await cursor(campo)).toBe("(83) 993|9-097");
  });

  test("quantidade inválida sinalizada antes do envio", async ({ page }) => {
    const campo = await campoTelefone(page);
    await page.keyboard.type("93229097");
    await page.getByLabel("Nome completo").fill("Oito Dígitos");
    await page.getByLabel("Valor da consulta (R$)").fill("150");
    let enviados = 0;
    page.on("request", (r) => {
      if (r.method() === "POST" && r.url().endsWith("/api/v1/pacientes")) enviados++;
    });
    await page.getByRole("button", { name: "Cadastrar paciente" }).click();
    await expect(page.getByText(/10 dígitos \(fixo\) ou 11 \(celular\)/)).toBeVisible();
    await expect(campo).toHaveAttribute("aria-invalid", "true");
    expect(enviados).toBe(0);
  });
});
