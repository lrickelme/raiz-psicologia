import { horaLocal } from "@raiz/shared";
import { formatarData } from "@/lib/formatar";

/** Instante → "12 mar 2026", no fuso da clínica. */
export function dia(instante: string): string {
  return formatarData(instante);
}

/** Instante → "12 mar 2026, 14:00". */
export function quando(instante: string): string {
  return `${dia(instante)}, ${horaLocal(instante)}`;
}
