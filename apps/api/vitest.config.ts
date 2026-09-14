import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.spec.ts"],
    // Piso menor que o padrão de produção para a suíte não ficar lenta. Os
    // testes afirmam contra o valor configurado, não contra um número fixo,
    // então essa troca também prova que o piso vem da config.
    env: { RAIZ_LOGIN_PISO_MS: "250" },
  },
});
