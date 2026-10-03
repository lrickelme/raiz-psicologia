import { defineConfig } from "vitest/config";

// Só os testes unitários de `src`; os de `e2e/` são do Playwright.
export default defineConfig({
  test: { include: ["src/**/*.test.ts"] },
});
