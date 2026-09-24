import { horaLocal, instanteLocal, minutosDoDia, type DataLocal } from "@raiz/shared";

export function paraMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

export function paraHora(minutos: number): string {
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

/** "14:00–14:50", sempre em São Paulo, qualquer que seja o fuso do navegador. */
export function faixaHoraria(inicio: string, fim: string): string {
  return `${horaLocal(inicio)}–${horaLocal(fim)}`;
}

export function instanteIso(data: DataLocal, hora: string): string {
  return instanteLocal(data, paraMinutos(hora)).toISOString();
}

export function duracaoMin(inicio: string, fim: string): number {
  return (Date.parse(fim) - Date.parse(inicio)) / 60_000;
}

export { minutosDoDia };
