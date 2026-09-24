const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "225.50" → "R$ 225,50". Opera na string: dinheiro nunca passa por `number`. */
export function formatarDinheiro(valor: string): string {
  const [inteiro, centavos = ""] = valor.split(".");
  const comMilhar = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${comMilhar},${centavos.padEnd(2, "0")}`;
}

/** "2025-03-12" (ou ISO completo) → "12 mar 2025", sem passar pelo fuso. */
export function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${Number(dia)} ${MESES[Number(mes) - 1]} ${ano}`;
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
