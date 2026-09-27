import { expect, type Page } from "@playwright/test";
import type { Paciente } from "@raiz/shared";
import { CREDENCIAL } from "./ambiente";

export async function entrar(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(CREDENCIAL.email);
  await page.getByLabel("Senha").fill(CREDENCIAL.senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

/** Cadastra pelo BFF, com a sessão do navegador. */
export async function cadastrarPaciente(page: Page, nome = "Mariana Alves"): Promise<Paciente> {
  const resposta = await page.request.post("/api/v1/pacientes", {
    data: { nome, valorConsultaPadrao: "150", telefone: "83993229097" },
  });
  expect(resposta.status()).toBe(201);
  return resposta.json();
}

/** Rascunho no servidor, pela mesma sessão; `null` se não houver. */
export async function rascunhoNoServidor(page: Page, pacienteId: string): Promise<string | null> {
  const resposta = await page.request.get(`/api/v1/prontuario/rascunho?pacienteId=${pacienteId}`);
  if (resposta.status() === 204) return null;
  expect(resposta.status()).toBe(200);
  return (await resposta.json()).texto;
}

export async function abrirEditor(page: Page, pacienteId: string) {
  await page.goto(`/pacientes/${pacienteId}/prontuario`);
  await page.getByRole("button", { name: "Nova evolução" }).click();
  return page.getByLabel("Texto da evolução");
}

export async function reautenticar(page: Page): Promise<void> {
  const modal = page.getByRole("dialog", { name: "Sua sessão expirou" });
  await modal.getByLabel("E-mail").fill(CREDENCIAL.email);
  await modal.getByLabel("Senha").fill(CREDENCIAL.senha);
  await modal.getByRole("button", { name: "Entrar e continuar" }).click();
  await expect(modal).toBeHidden();
}
