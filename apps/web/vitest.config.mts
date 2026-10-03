import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Só os testes unitários de `src`; os de `e2e/` são do Playwright.
export default defineConfig({
  test: { include: ["src/**/*.test.ts"] },
  // O fonte do `@raiz/shared`, não o `dist/`: a suíte não pode depender de um
  // build manual nem passar contra um build desatualizado.
  resolve: {
    alias: { "@raiz/shared": fileURLToPath(new URL("../../packages/shared/src/index.ts", import.meta.url)) },
  },
});
