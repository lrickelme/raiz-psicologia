"use client";

import { useSyncExternalStore } from "react";

/**
 * Papéis de cor dos gráficos → custom properties do `@theme` (globals.css).
 * O SVG do Recharts recebe cor como valor, então os tokens são lidos em
 * runtime; nenhum hex é repetido no JSX (design.md, "Frontend").
 */
const PAPEIS = {
  barra: "--color-raiz-musgo-claro",
  outros: "--color-raiz-bege",
  faixa: "--color-raiz-sand",
  eixo: "--color-raiz-texto-terciario",
  texto: "--color-raiz-marrom",
  grade: "--color-raiz-borda",
  cursor: "--color-raiz-areia",
} as const;

export type CoresGrafico = Record<keyof typeof PAPEIS, string>;

let lidas: CoresGrafico | null = null;

/** Lidas uma vez: os tokens não mudam com a página aberta. */
function ler(): CoresGrafico {
  if (!lidas) {
    const estilo = getComputedStyle(document.documentElement);
    lidas = Object.fromEntries(
      Object.entries(PAPEIS).map(([papel, variavel]) => [papel, estilo.getPropertyValue(variavel).trim()]),
    ) as CoresGrafico;
  }
  return lidas;
}

const semAssinatura = () => () => {};

/** `null` no servidor, que não tem folha de estilo computada. */
export function useCoresGrafico(): CoresGrafico | null {
  return useSyncExternalStore(semAssinatura, ler, () => null);
}
