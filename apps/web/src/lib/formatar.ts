import { dataLocal } from "@raiz/shared";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const REAL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/**
 * "1225.50" → "R$ 1.225,50". A string decimal vai direto ao `Intl`, que a
 * formata sem passar por `number` (ES2023): dinheiro nunca vira ponto
 * flutuante, nem para exibir.
 */
export function formatarDinheiro(valor: string): string {
  return REAL.format(valor as Intl.StringNumericLiteral);
}

/**
 * "2025-03-12" → "12 mar 2025". Data de calendário não passa por fuso; um
 * instante ISO completo vira a data de São Paulo — cortar a string pegaria o
 * dia em UTC, que às 21h locais já é o seguinte.
 */
export function formatarData(iso: string): string {
  const [ano, mes, dia] = (iso.length > 10 ? dataLocal(iso) : iso).split("-");
  return `${Number(dia)} ${MESES[Number(mes) - 1]} ${ano}`;
}

/** Instante ISO → "28 jun", no dia de São Paulo. Para listas do ano corrente. */
export function formatarDiaMes(iso: string): string {
  return formatarData(iso).split(" ").slice(0, 2).join(" ");
}

/** Idade completa em anos, contando a partir de uma data AAAA-MM-DD. */
export function idade(nascimento: string, hoje = new Date()): number {
  const [ano, mes, dia] = nascimento.split("-").map(Number);
  const fezAniversario =
    hoje.getMonth() + 1 > mes || (hoje.getMonth() + 1 === mes && hoje.getDate() >= dia);
  return hoje.getFullYear() - ano - (fezAniversario ? 0 : 1);
}

/** Iniciais da primeira e da última palavra que começam com letra. */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter((parte) => /^\p{L}/u.test(parte));
  const primeira = partes[0]?.[0] ?? "";
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return `${primeira}${ultima}`.toUpperCase();
}
