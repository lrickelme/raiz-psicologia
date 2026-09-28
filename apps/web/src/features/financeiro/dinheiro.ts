// `BigInt(…)`, não literal `100n`: o tsconfig do web mira ES2017.
const CEM = BigInt(100);
const ZERO = BigInt(0);

/** "150.5" → 15050. Aceita o formato que a API devolve: dígitos, ponto, até duas casas. */
function centavos(valor: string): bigint {
  const [inteiro, fracao = ""] = valor.split(".");
  return BigInt(inteiro) * CEM + BigInt(fracao.padEnd(2, "0").slice(0, 2));
}

/**
 * Soma exata de valores em string, em centavos inteiros — para o total de
 * "outros" no gráfico por paciente (design.md, "Frontend"). Nunca `number`.
 */
export function somarDinheiro(valores: string[]): string {
  const total = valores.reduce((soma, valor) => soma + centavos(valor), ZERO);
  return `${total / CEM}.${String(total % CEM).padStart(2, "0")}`;
}

export const ehZero = (valor: string) => centavos(valor) === ZERO;
