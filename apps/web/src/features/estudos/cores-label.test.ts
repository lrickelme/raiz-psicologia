import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CORES_LABEL } from "@raiz/shared";
import { describe, expect, it } from "vitest";
import { CORES_LABEL_ESTILO } from "./cores-label";

/**
 * Lê os tokens do `globals.css`, e não uma cópia deles: mudar um token que
 * derrube um par abaixo de AA quebra este teste, e não a acessibilidade em
 * produção (design.md, "Paleta").
 */
const css = readFileSync(join(__dirname, "../../app/globals.css"), "utf8");

function token(classe: string): string {
  const nome = classe.replace(/^(bg|text)-/, "");
  const valor = css.match(new RegExp(`--color-${nome}:\\s*(#[0-9a-f]{6})\\s*;`, "i"))?.[1];
  if (!valor) throw new Error(`token --color-${nome} ausente ou fora do formato #rrggbb`);
  return valor;
}

/** Luminância relativa da WCAG 2.x. */
function luminancia(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const canal = parseInt(hex.slice(i, i + 2), 16) / 255;
    return canal <= 0.03928 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: string, b: string): number {
  const [clara, escura] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (clara + 0.05) / (escura + 0.05);
}

describe("paleta de labels", () => {
  it("cobre todos os papéis do contrato", () => {
    expect(Object.keys(CORES_LABEL_ESTILO).sort()).toEqual([...CORES_LABEL].sort());
  });

  it.each(CORES_LABEL)("%s tem contraste de pelo menos 4,5:1", (cor) => {
    const { fundo, texto } = CORES_LABEL_ESTILO[cor];
    expect(contraste(token(fundo), token(texto))).toBeGreaterThanOrEqual(4.5);
  });

  it("o cálculo reproduz a referência (âmbar sólido com branco reprova)", () => {
    expect(contraste(token("bg-raiz-ambar"), token("text-raiz-sobre-pill"))).toBeCloseTo(3.25, 1);
  });
});
