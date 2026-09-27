import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { carregarGuardaProntuarioAnos } from "./config";

describe("GUARDA_PRONTUARIO_ANOS", () => {
  it("usa 20 anos quando não configurado", () => {
    expect(carregarGuardaProntuarioAnos({})).toBe(20);
    expect(carregarGuardaProntuarioAnos({ GUARDA_PRONTUARIO_ANOS: " " })).toBe(20);
  });

  it("aceita o mínimo de 5 e valores acima de 20", () => {
    expect(carregarGuardaProntuarioAnos({ GUARDA_PRONTUARIO_ANOS: "5" })).toBe(5);
    expect(carregarGuardaProntuarioAnos({ GUARDA_PRONTUARIO_ANOS: "25" })).toBe(25);
  });

  it.each(["4", "0", "-20", "7.5", "vinte"])("recusa %j", (valor) => {
    expect(() => carregarGuardaProntuarioAnos({ GUARDA_PRONTUARIO_ANOS: valor })).toThrow(
      /GUARDA_PRONTUARIO_ANOS deve ser um inteiro de no mínimo 5/,
    );
  });

  it("com prazo abaixo de 5, a API não sobe", async () => {
    const anterior = process.env.GUARDA_PRONTUARIO_ANOS;
    process.env.GUARDA_PRONTUARIO_ANOS = "4";
    vi.resetModules();
    try {
      await expect(import("../app.module")).rejects.toThrow(/GUARDA_PRONTUARIO_ANOS/);
    } finally {
      if (anterior === undefined) delete process.env.GUARDA_PRONTUARIO_ANOS;
      else process.env.GUARDA_PRONTUARIO_ANOS = anterior;
      vi.resetModules();
    }
  });
});
