import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { hojeLocal, inicioDoMes, instanteLocal, somarDias, somarMeses } from "@raiz/shared";
import { cadastrarPaciente, entrar } from "./apoio";

const API = join(__dirname, "../../api");

/**
 * Dois anos de agenda cheia — 2010 e 2011, longe das datas que os outros
 * testes usam — semeados por SQL: pela API seriam milhares de requisições.
 * Pacientes arquivados, para não aparecerem nas listas dos outros testes; a
 * receita por paciente os inclui, como a spec pede.
 */
const CARGA = `
INSERT INTO paciente (id, nome, valor_consulta_padrao, status, atualizado_em)
SELECT gen_random_uuid(), 'Carga e2e ' || lpad(i::text, 2, '0'), 150, 'ARQUIVADO', now()
  FROM generate_series(1, 40) i;

WITH ids AS (
  SELECT array_agg(id ORDER BY nome) AS a FROM paciente WHERE nome LIKE 'Carga e2e %'
), horarios AS (
  SELECT (d::date + make_interval(hours => 8 + s))::timestamp AT TIME ZONE 'America/Sao_Paulo' AS t,
         row_number() OVER () AS n
    FROM generate_series(date '2010-01-01', date '2011-12-31', interval '1 day') d,
         generate_series(0, 9) s
)
INSERT INTO atendimento (id, paciente_id, inicio, fim, status, valor, encerrado_em, cobravel, atualizado_em)
SELECT gen_random_uuid(), ids.a[1 + n % 40], t, t + interval '50 minutes', 'REALIZADO', 150,
       t + interval '50 minutes', true, now()
  FROM horarios, ids;

ANALYZE atendimento;
`;

const cartao = (page: Page, nome: string) => page.getByRole("region", { name: nome });

test.beforeEach(async ({ page }) => {
  await entrar(page);
});

test.describe("financeiro", () => {
  test("filtro de trimestre sobre dois anos de histórico responde abaixo de 2 s", async ({ page }) => {
    execFileSync("npx", ["prisma", "db", "execute", "--stdin", "--url", process.env.E2E_DATABASE_URL!], {
      cwd: API,
      input: CARGA,
      stdio: ["pipe", "ignore", "inherit"],
    });

    await page.goto("/financeiro?periodo=trimestre&ref=2011-07-01");
    // 3º trimestre de 2011: 92 dias × 10 atendimentos × R$ 150.
    await expect(cartao(page, "Receita realizada")).toContainText(/138\.000,00/);
    await expect(page.getByText("40 pacientes", { exact: true })).toBeVisible();

    const inicio = Date.now();
    await page.getByRole("button", { name: "Período anterior" }).click();
    // 2º trimestre: 91 dias. Cartão e tabela precisam refletir o novo período.
    await expect(cartao(page, "Receita realizada")).toContainText(/136\.500,00/);
    await expect(page.getByRole("heading", { name: /2º trimestre de 2011/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /Carga e2e/ }).first()).toBeVisible();
    expect(Date.now() - inicio).toBeLessThan(2000);

    await expect(page).toHaveURL(/periodo=trimestre&ref=2011-04-01/);
  });

  test("painéis por período: vazio sem atendimento; série mensal declara que não segue o filtro", async ({ page }) => {
    await page.goto("/financeiro");
    await expect(page.getByRole("heading", { name: "Últimos 12 meses" })).toBeVisible();
    await expect(page.getByText("não segue o filtro de período")).toHaveCount(0);

    await page.goto("/financeiro?periodo=ano&ref=2005-01-01");
    await expect(cartao(page, "Receita realizada")).toContainText("Nenhum atendimento no período");
    await expect(cartao(page, "Receita prevista")).toContainText("Só o mês corrente tem previsão");
    await expect(page.getByText("Nenhuma receita no período.")).toBeVisible();
    await expect(page.getByText("Nenhum atendimento no período.")).toBeVisible();
    // O comparativo continua lá, avisando que mostra a série completa.
    await expect(page.getByText(/Este painel mostra a série completa e não segue o filtro de período/)).toBeVisible();
  });

  test("previsão, pendência e realizada separadas; voltar do navegador volta ao período", async ({ page }) => {
    const paciente = await cadastrarPaciente(page, "Helena Prado");
    const mes = inicioDoMes(hojeLocal());
    const criar = async (inicio: Date) => {
      const resposta = await page.request.post("/api/v1/atendimentos", {
        data: {
          pacienteId: paciente.id,
          inicio: inicio.toISOString(),
          fim: new Date(inicio.getTime() + 50 * 60_000).toISOString(),
        },
      });
      expect(resposta.status()).toBe(201);
      return resposta.json();
    };
    // Mês passado: um realizado e um que ficou sem encerramento.
    const anterior = somarMeses(mes, -1);
    const realizado = await criar(instanteLocal(anterior, 6 * 60));
    await page.request.post(`/api/v1/atendimentos/${realizado.id}/realizar`, { data: {} });
    await criar(instanteLocal(anterior, 7 * 60));

    await page.goto("/financeiro");
    await page.getByRole("button", { name: "Período anterior" }).click();
    await expect(page).toHaveURL(new RegExp(`ref=${anterior}`));
    await expect(page.getByRole("row", { name: /Helena Prado/ })).toContainText(/150,00/);
    // Escala do eixo pode abreviar; a tabela de valores por mês traz o exato.
    await page.getByText("Ver valores por mês").click();
    const valoresPorMes = page.getByRole("table", { name: /Receita realizada nos últimos 12 meses/ });
    await expect(valoresPorMes.getByRole("cell").first()).toHaveText(/^R\$\s[\d.]+,\d{2}$/);
    // Nenhum cinza padrão do Recharts sobrevive nos gráficos: só tokens.
    await expect(page.locator('svg [fill="#808080"]')).toHaveCount(0);
    await expect(cartao(page, "Pendentes de encerramento")).toContainText(/não (foi|foram) encerrados?/);
    await expect(cartao(page, "Receita prevista")).toContainText("—");

    await page.goBack();
    await expect(page).toHaveURL(/\/financeiro$/);
    await expect(page.getByRole("button", { name: "Mês atual" })).toHaveCount(0);
  });

  test("histórico do paciente mostra a dispensa com o motivo, e a reversão preservando-o", async ({ page }) => {
    const paciente = await cadastrarPaciente(page, "Inês Barros");
    const a = await (
      await page.request.post("/api/v1/atendimentos", {
        data: { pacienteId: paciente.id, inicio: "2026-02-02T09:00:00-03:00", fim: "2026-02-02T09:50:00-03:00" },
      })
    ).json();
    await page.request.post(`/api/v1/atendimentos/${a.id}/realizar`, { data: {} });
    await page.request.post(`/api/v1/atendimentos/${a.id}/dispensar-cobranca`, {
      data: { motivo: "Paciente em luto" },
    });

    await page.goto(`/pacientes/${paciente.id}`);
    await expect(page.getByText("Cobrável, com cobrança dispensada:")).toBeVisible();
    await expect(page.getByText("Paciente em luto")).toBeVisible();

    await page.request.post(`/api/v1/atendimentos/${a.id}/reverter-dispensa`, { data: {} });
    await page.reload();
    await expect(page.getByText("Cobrável, com cobrança dispensada:")).toHaveCount(0);
    await expect(page.getByText(/Dispensa de cobrança revertida/)).toBeVisible();
    await expect(page.getByText("Paciente em luto")).toBeVisible();
  });

  test("dispensar e reverter pela interface, do histórico e da agenda; não cobrável não oferece", async ({ page, context }) => {
    const paciente = await cadastrarPaciente(page, "Lúcia Rocha");
    const criar = async (inicio: Date) =>
      (
        await page.request.post("/api/v1/atendimentos", {
          data: {
            pacienteId: paciente.id,
            inicio: inicio.toISOString(),
            fim: new Date(inicio.getTime() + 50 * 60_000).toISOString(),
          },
        })
      ).json();
    // Há uma semana, às 10h: passado, e na semana anterior da agenda.
    const semanaPassada = somarDias(hojeLocal(), -7);
    const realizado = await criar(instanteLocal(semanaPassada, 10 * 60));
    await page.request.post(`/api/v1/atendimentos/${realizado.id}/realizar`, { data: {} });
    // Cancelado com antecedência: não cobrável.
    const cancelado = await criar(instanteLocal(somarDias(hojeLocal(), 30), 10 * 60));
    await page.request.post(`/api/v1/atendimentos/${cancelado.id}/cancelar`, { data: { motivo: "Viagem." } });

    // Histórico do paciente.
    await page.goto(`/pacientes/${paciente.id}`);
    await expect(page.getByRole("button", { name: "Dispensar cobrança" })).toHaveCount(1);
    await page.getByRole("button", { name: "Dispensar cobrança" }).click();
    const modal = page.getByRole("dialog", { name: "Dispensar cobrança" });
    await expect(modal).toContainText(/150,00/);
    await expect(modal).toContainText("Atendimento realizado: sempre cobrável.");
    await modal.getByLabel("Motivo da dispensa").fill("Paciente em luto");
    await modal.getByRole("button", { name: "Dispensar cobrança" }).click();
    await expect(modal).toBeHidden();
    await expect(page.getByText("Cobrável, com cobrança dispensada:")).toBeVisible();

    // Detalhe na agenda, semana anterior, com encerrados à vista.
    await context.addCookies([
      { name: "raiz_agenda_encerrados", value: "1", url: page.url() },
      { name: "raiz_agenda_visao", value: "semana", url: page.url() },
    ]);
    await page.goto("/agenda");
    await page.getByRole("button", { name: "Período anterior" }).click();
    await page.getByRole("button", { name: /Lúcia Rocha/ }).first().click();
    const detalhe = page.getByRole("dialog");
    await detalhe.getByRole("button", { name: "Ver dispensa de cobrança" }).click();
    await expect(detalhe).toContainText("Paciente em luto");
    await detalhe.getByRole("button", { name: "Reverter dispensa" }).click();
    await expect(detalhe).toBeHidden();

    await page.goto(`/pacientes/${paciente.id}`);
    await expect(page.getByText(/Dispensa de cobrança revertida/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Dispensar cobrança" })).toHaveCount(1);
  });

  test("rota do financeiro e chamadas do BFF saem sem cache", async ({ page }) => {
    const pagina = await page.goto("/financeiro");
    expect(pagina?.headers()["cache-control"]).toContain("no-store");

    for (const caminho of [
      "/financeiro/receita?de=2026-09-01&ate=2026-09-30",
      "/financeiro/mensal",
      "/financeiro/por-paciente?de=2026-09-01&ate=2026-09-30",
    ]) {
      const resposta = await page.request.get(`/api/v1${caminho}`);
      expect(resposta.status()).toBe(200);
      expect(resposta.headers()["cache-control"]).toBe("private, no-store");
    }
  });
});
