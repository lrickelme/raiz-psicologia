import { defineConfig, devices } from "@playwright/test";
import { URL_WEB } from "./e2e/ambiente";

/**
 * Testes ponta a ponta do web: navegador real contra Next e API reais, sobre
 * um Postgres descartável (e2e/preparar-ambiente.ts). Nada toca o banco de
 * desenvolvimento — evolução é imutável, e teste nenhum deve deixar rastro lá.
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/preparar-ambiente.ts",
  // Um único ambiente compartilhado; os testes criam pacientes próprios.
  workers: 1,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: URL_WEB,
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
});
