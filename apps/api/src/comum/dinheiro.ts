import { Prisma } from "@prisma/client";

/**
 * Dinheiro na fronteira da API (design.md, "Decimal na fronteira"). Sai como
 * string com duas casas — `Decimal` serializado direto perderia o zero final e
 * `number` perderia centavos — e entra como string já validada pelo schema.
 */
export function dinheiroParaApi(valor: Prisma.Decimal): string {
  return valor.toFixed(2);
}

export function dinheiroDaApi(valor: string): Prisma.Decimal {
  return new Prisma.Decimal(valor);
}
