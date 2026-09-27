import { z } from "zod";

/** Fixo com DDD tem 10 dígitos; celular, 11 (spec pacientes, "Telefone normalizado"). */
export const DIGITOS_TELEFONE = [10, 11] as const;
const MAXIMO = 11;

export function soDigitos(texto: string): string {
  return texto.replace(/\D/g, "");
}

/**
 * Telefone como o banco guarda: só dígitos, sem prefixo de país. O `55` só é
 * descartado quando sobram 12 ou 13 dígitos — `(55) 99999-8888` é DDD 55
 * (Santa Maria, RS), número nacional de 11 dígitos (design.md, "Telefone").
 * A regra é a mesma da migration `telefone_digitos`.
 */
export function normalizarTelefone(texto: string): string {
  const digitos = soDigitos(texto);
  return (digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55")
    ? digitos.slice(2)
    : digitos;
}

export function telefoneValido(digitos: string): boolean {
  return (DIGITOS_TELEFONE as readonly number[]).includes(digitos.length);
}

/**
 * Máscara progressiva, para o campo em digitação: `(83) 3221-4567` até o 10º
 * dígito, `(83) 99322-9097` a partir do 11º.
 */
export function mascararTelefone(digitos: string): string {
  if (!digitos) return "";
  const ddd = digitos.slice(0, 2);
  const numero = digitos.slice(2);
  if (!numero) return `(${ddd}`;
  const corte = digitos.length === MAXIMO ? 5 : 4;
  const inicio = numero.slice(0, corte);
  const fim = numero.slice(corte);
  return `(${ddd}) ${inicio}${fim ? `-${fim}` : ""}`;
}

/**
 * Exibição de telefone gravado. Registro legado com quantidade inválida
 * (mantido pela migration para não perder dado) aparece como está, em vez de
 * ganhar uma máscara que sugeriria um número que ele não é.
 */
export function formatarTelefone(digitos: string | null): string | null {
  if (!digitos) return null;
  return telefoneValido(digitos) ? mascararTelefone(digitos) : digitos;
}

/** Tipos de `InputEvent.inputType` que trazem texto de fora, não digitação. */
const COLAGEM = new Set(["insertFromPaste", "insertFromDrop", "insertReplacementText"]);

export type EdicaoTelefone = {
  /** Valor bruto do campo logo após a edição do navegador. */
  valor: string;
  /** `selectionStart` logo após a edição. */
  cursor: number;
  /** Dígitos antes da edição. */
  anteriores: string;
  /** `InputEvent.inputType`, quando disponível. */
  tipo?: string;
};

/**
 * Traduz uma edição do navegador sobre o texto mascarado em dígitos e posição
 * de cursor. O cursor é tratado como "quantos dígitos há à sua esquerda", o
 * que o mantém depois do mesmo dígito quando a máscara muda de forma.
 *
 * - Apagar um caractere da máscara apaga o dígito vizinho: backspace sempre
 *   remove um dígito.
 * - Colagem é normalizada (descarta `+55`, separadores).
 * - Digitar além de 11 dígitos é ignorado, sem truncar o que já estava.
 */
export function editarTelefone({ valor, cursor, anteriores, tipo }: EdicaoTelefone): {
  digitos: string;
  exibicao: string;
  cursor: number;
} {
  let digitos = soDigitos(valor);
  let antes = soDigitos(valor.slice(0, cursor)).length;

  if (tipo?.startsWith("delete") && digitos === anteriores) {
    if (tipo === "deleteContentBackward" && antes > 0) {
      digitos = digitos.slice(0, antes - 1) + digitos.slice(antes);
      antes -= 1;
    } else if (tipo === "deleteContentForward") {
      digitos = digitos.slice(0, antes) + digitos.slice(antes + 1);
    }
  } else if (tipo && COLAGEM.has(tipo)) {
    const normalizados = normalizarTelefone(digitos);
    antes = Math.max(0, antes - (digitos.length - normalizados.length));
    digitos = normalizados.slice(0, MAXIMO);
  } else if (digitos.length > MAXIMO) {
    // Os dígitos a mais entraram à esquerda do cursor; ele volta para onde estava.
    antes = Math.max(0, antes - (digitos.length - anteriores.length));
    digitos = anteriores;
  }

  antes = Math.min(antes, digitos.length);
  const exibicao = mascararTelefone(digitos);
  return { digitos, exibicao, cursor: posicaoAposDigitos(exibicao, antes) };
}

/** Índice logo depois do n-ésimo dígito; com n = 0, antes do primeiro. */
function posicaoAposDigitos(exibicao: string, n: number): number {
  let vistos = 0;
  for (let i = 0; i < exibicao.length; i++) {
    if (!/\d/.test(exibicao[i])) continue;
    if (vistos === n) return i;
    vistos += 1;
    if (vistos === n) return i + 1;
  }
  return exibicao.length;
}

/** Telefone de formulário: aceita qualquer formato, entrega só dígitos. */
export const telefoneSchema = z
  .string({ invalid_type_error: "Telefone inválido" })
  .transform(normalizarTelefone)
  .refine(telefoneValido, "Informe DDD e número: 10 dígitos (fixo) ou 11 (celular)");
