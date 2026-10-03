import type { CorLabel } from "@raiz/shared";

/**
 * Papel de cor da label → par de classes do `@theme` (globals.css). O banco
 * guarda só o papel; trocar a identidade visual é mudar este mapa ou os
 * tokens, sem migrar dados. As classes ficam escritas por inteiro para o
 * Tailwind encontrá-las, e o teste de contraste as lê de volta como tokens.
 *
 * Divergência deliberada do design-ref: lá "Média" é âmbar sólido com texto
 * branco (3,25:1). Aqui o âmbar usa o par suave (design.md, "Paleta").
 */
export const CORES_LABEL_ESTILO: Record<CorLabel, { nome: string; fundo: string; texto: string }> = {
  VINHO: { nome: "Vinho", fundo: "bg-raiz-vinho", texto: "text-raiz-sobre-pill" },
  AMBAR: { nome: "Âmbar", fundo: "bg-raiz-ambar-suave", texto: "text-raiz-ambar-escuro" },
  MUSGO: { nome: "Musgo", fundo: "bg-raiz-musgo", texto: "text-raiz-sobre-pill" },
  MUSGO_SUAVE: { nome: "Musgo suave", fundo: "bg-raiz-musgo-suave", texto: "text-raiz-musgo-escuro" },
  MARROM: { nome: "Marrom", fundo: "bg-raiz-marrom", texto: "text-raiz-sobre-pill" },
  BEGE: { nome: "Bege", fundo: "bg-raiz-bege", texto: "text-raiz-marrom" },
};

export function classesLabel(cor: CorLabel): string {
  const { fundo, texto } = CORES_LABEL_ESTILO[cor];
  return `${fundo} ${texto}`;
}
