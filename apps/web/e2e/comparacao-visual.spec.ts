import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "@playwright/test";
import { cadastrarPaciente, entrar } from "./apoio";

/**
 * Capturas lado a lado com o design-ref, para revisão visual (não compara
 * pixel a pixel: o prontuário carrega texto sob demanda, e a referência o
 * mostra aberto). Roda só com `COMPARACAO_VISUAL=1 pnpm test:e2e`; as
 * imagens vão para `test-results/comparacao-visual/`.
 */
test.skip(!process.env.COMPARACAO_VISUAL, "defina COMPARACAO_VISUAL=1 para gerar as capturas");
test.use({ viewport: { width: 1440, height: 900 } });

const SAIDA = join(__dirname, "../test-results/comparacao-visual");
const REFERENCIA = pathToFileURL(join(__dirname, "../../../design-ref/index.html")).href;

test("prontuário e perfil contra a tela de pacientes do design-ref", async ({ page }) => {
  await page.goto(`${REFERENCIA}#pacientes`);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: join(SAIDA, "referencia-pacientes.png") });

  await entrar(page);
  const paciente = await cadastrarPaciente(page, "Mariana Alves");
  const api = (caminho: string, data: object) => page.request.post(`/api/v1${caminho}`, { data });

  const atendimento = await (
    await api("/atendimentos", {
      pacienteId: paciente.id,
      inicio: "2026-06-30T14:00:00-03:00",
      fim: "2026-06-30T14:50:00-03:00",
    })
  ).json();
  await api(`/atendimentos/${atendimento.id}/realizar`, {});
  const textos = [
    "Primeira aplicação de exercícios de respiração diafragmática. Boa adesão. Relata dificuldade de sono — investigar higiene do sono na próxima sessão.",
    "Continuidade do processo de awareness. Trouxe avanços no reconhecimento de padrões de evitação no ambiente de trabalho. Tarefa: registro diário de sensações corporais.",
  ];
  const primeira = await (await api(`/pacientes/${paciente.id}/evolucoes`, { texto: textos[0] })).json();
  await api(`/pacientes/${paciente.id}/evolucoes`, { texto: textos[1] });
  await api(`/evolucoes/${primeira.id}/retificar`, { texto: `${textos[0]} Combinado diário de sono.` });
  await api(`/pacientes/${paciente.id}/evolucoes`, {
    atendimentoId: atendimento.id,
    texto:
      "Sessão focada em Gestalt-terapia. Paciente relatou melhora na autorregulação emocional ao longo da semana, com episódios de ansiedade menos frequentes. Trabalhamos a técnica da cadeira vazia para o diálogo com a figura paterna.",
  });

  await page.goto(`/pacientes/${paciente.id}/prontuario`);
  await page.getByText("3 registros").waitFor();
  await page.getByRole("button", { name: "Ler evolução" }).first().click();
  await page.getByText("cadeira vazia").waitFor();
  await page.screenshot({ path: join(SAIDA, "prontuario-lista.png") });

  await page.getByRole("button", { name: "Nova evolução" }).click();
  await page.getByLabel("Texto da evolução").fill("Paciente chegou pontualmente. Relata semana difícil no trabalho.");
  await page.getByText(/Rascunho salvo às/).waitFor();
  await page.screenshot({ path: join(SAIDA, "prontuario-editor.png") });
  await page.getByRole("button", { name: "Fechar e continuar depois" }).click();
  await page.reload();
  await page.getByText("Há um rascunho não gravado").waitFor();
  await page.screenshot({ path: join(SAIDA, "prontuario-rascunho-pendente.png") });

  await page.getByRole("button", { name: "Ler evolução" }).first().click();
  await page.getByRole("button", { name: "Retificar" }).click();
  await page.screenshot({ path: join(SAIDA, "prontuario-retificacao.png") });
  await page.getByRole("button", { name: "Cancelar" }).click();

  await page.getByRole("button", { name: "Histórico de versões" }).click();
  await page.getByText("Versão 2 de 2").waitFor();
  await page.screenshot({ path: join(SAIDA, "prontuario-historico.png") });
  await page.keyboard.press("Escape");

  await page.goto(`/pacientes/${paciente.id}`);
  await page.screenshot({ path: join(SAIDA, "perfil-ativo.png") });

  await page.request.delete(`/api/v1/prontuario/rascunho?pacienteId=${paciente.id}`);
  await api(`/pacientes/${paciente.id}/arquivar`, {});
  await page.goto(`/pacientes/${paciente.id}`);
  await page.screenshot({ path: join(SAIDA, "perfil-arquivado.png") });
});
