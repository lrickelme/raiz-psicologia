import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // O esbuild padrão do Vitest não emite `emitDecoratorMetadata`, e sem ela a
  // injeção de dependência do Nest recebe `undefined` nos construtores.
  plugins: [swc.vite({ module: { type: "es6" } })],
  test: {
    include: ["src/**/*.spec.ts"],
    // Piso menor que o padrão de produção para a suíte não ficar lenta. Os
    // testes afirmam contra o valor configurado, não contra um número fixo,
    // então essa troca também prova que o piso vem da config.
    env: {
      RAIZ_LOGIN_PISO_MS: "250",
      // Chave fixa só de teste; nunca usada fora da suíte.
      RAIZ_CHAVE_CRIPTOGRAFIA: "dGVzdGUtdGVzdGUtdGVzdGUtdGVzdGUtdGVzdGUtMzI=",
    },
  },
});
