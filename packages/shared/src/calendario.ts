import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

/**
 * Fuso das regras de calendário (project.md). Nunca o do processo: ele varia
 * por ambiente, e "hoje" calculado com ele erra na virada do dia.
 */
export const FUSO = "America/Sao_Paulo";

/** Data de calendário AAAA-MM-DD, sem hora nem fuso. */
export type DataLocal = string;

export const DATA_LOCAL = /^\d{4}-\d{2}-\d{2}$/;

/** Data de hoje em São Paulo. */
export function hojeLocal(agora: Date = new Date()): DataLocal {
  return formatInTimeZone(agora, FUSO, "yyyy-MM-dd");
}

/** Data em São Paulo de um instante. */
export function dataLocal(instante: Date | string): DataLocal {
  return formatInTimeZone(instante, FUSO, "yyyy-MM-dd");
}

/** "HH:mm" em São Paulo de um instante. */
export function horaLocal(instante: Date | string): string {
  return formatInTimeZone(instante, FUSO, "HH:mm");
}

/** Minutos desde a meia-noite de São Paulo. */
export function minutosDoDia(instante: Date | string): number {
  const [h, m] = horaLocal(instante).split(":").map(Number);
  return h * 60 + m;
}

/** Instante de uma data + hora locais de São Paulo. */
export function instanteLocal(data: DataLocal, minutos = 0): Date {
  const h = String(Math.floor(minutos / 60)).padStart(2, "0");
  const m = String(minutos % 60).padStart(2, "0");
  return fromZonedTime(`${data}T${h}:${m}:00`, FUSO);
}

/** Aritmética de calendário pura, em UTC, sem fuso nem horário de verão. */
function comoUtc(data: DataLocal): Date {
  const [a, m, d] = data.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}

function deUtc(data: Date): DataLocal {
  return data.toISOString().slice(0, 10);
}

export function somarDias(data: DataLocal, dias: number): DataLocal {
  const d = comoUtc(data);
  d.setUTCDate(d.getUTCDate() + dias);
  return deUtc(d);
}

export function somarMeses(data: DataLocal, meses: number): DataLocal {
  const d = comoUtc(data);
  const dia = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + meses);
  const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dia, ultimo));
  return deUtc(d);
}

/** 0 = segunda … 6 = domingo. A semana da agenda começa na segunda (design-ref). */
export function diaDaSemana(data: DataLocal): number {
  return (comoUtc(data).getUTCDay() + 6) % 7;
}

export function inicioDaSemana(data: DataLocal): DataLocal {
  return somarDias(data, -diaDaSemana(data));
}

export function inicioDoMes(data: DataLocal): DataLocal {
  return `${data.slice(0, 7)}-01`;
}

export function fimDoMes(data: DataLocal): DataLocal {
  return somarDias(somarMeses(inicioDoMes(data), 1), -1);
}

/** Dias entre duas datas (b − a). */
export function diasEntre(a: DataLocal, b: DataLocal): number {
  return Math.round((comoUtc(b).getTime() - comoUtc(a).getTime()) / 86_400_000);
}

/**
 * Instantes que delimitam os dias `de`..`ate` (inclusive) em São Paulo:
 * [meia-noite de `de`, meia-noite do dia seguinte a `ate`).
 */
export function intervaloDosDias(de: DataLocal, ate: DataLocal): { inicio: Date; fim: Date } {
  return { inicio: instanteLocal(de), fim: instanteLocal(somarDias(ate, 1)) };
}
