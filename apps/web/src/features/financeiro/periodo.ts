import { DATA_LOCAL, inicioDoMes, somarDias, somarMeses, type DataLocal } from "@raiz/shared";

export const TIPOS_PERIODO = ["mes", "trimestre", "ano"] as const;
export type TipoPeriodo = (typeof TIPOS_PERIODO)[number];

/** Período do filtro: `ref` é sempre o primeiro dia dele. */
export type Periodo = { tipo: TipoPeriodo; ref: DataLocal };

const MESES_DO_TIPO: Record<TipoPeriodo, number> = { mes: 1, trimestre: 3, ano: 12 };

const NOMES_MES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const ABREV_MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Alinha uma data ao início do mês, trimestre ou ano que a contém. */
export function periodo(tipo: TipoPeriodo, data: DataLocal): Periodo {
  const [ano, mes] = data.split("-").map(Number);
  if (tipo === "ano") return { tipo, ref: `${ano}-01-01` };
  if (tipo === "trimestre") {
    const primeiro = mes - ((mes - 1) % 3);
    return { tipo, ref: `${ano}-${String(primeiro).padStart(2, "0")}-01` };
  }
  return { tipo, ref: inicioDoMes(data) };
}

/** O filtro ao abrir o dashboard: o mês corrente. */
export const periodoPadrao = (hoje: DataLocal) => periodo("mes", hoje);

export function ehPadrao(p: Periodo, hoje: DataLocal): boolean {
  const padrao = periodoPadrao(hoje);
  return p.tipo === padrao.tipo && p.ref === padrao.ref;
}

/** Datas `de` e `ate`, inclusivas, como a API recebe. */
export function intervalo({ tipo, ref }: Periodo): { de: DataLocal; ate: DataLocal } {
  return { de: ref, ate: somarDias(somarMeses(ref, MESES_DO_TIPO[tipo]), -1) };
}

export function deslocar({ tipo, ref }: Periodo, passos: number): Periodo {
  return { tipo, ref: somarMeses(ref, passos * MESES_DO_TIPO[tipo]) };
}

export function rotulo({ tipo, ref }: Periodo): string {
  const [ano, mes] = ref.split("-").map(Number);
  if (tipo === "ano") return String(ano);
  if (tipo === "trimestre") return `${Math.ceil(mes / 3)}º trimestre de ${ano}`;
  return `${NOMES_MES[mes - 1]} de ${ano}`;
}

/** "2026-09" → "set/26". */
export function rotuloMesCurto(mes: string): string {
  const [ano, m] = mes.split("-");
  return `${ABREV_MES[Number(m) - 1]}/${ano.slice(2)}`;
}

/** "2026-09" → "setembro de 2026". */
export function rotuloMesLongo(mes: string): string {
  const [ano, m] = mes.split("-");
  return `${NOMES_MES[Number(m) - 1]} de ${ano}`;
}

/** Primeiro e último mês (AAAA-MM) que o período alcança. */
export function mesesDoPeriodo(p: Periodo): { primeiro: string; ultimo: string } {
  const { de, ate } = intervalo(p);
  return { primeiro: de.slice(0, 7), ultimo: ate.slice(0, 7) };
}

/** Lê `?periodo=&ref=`; o que não for válido cai no padrão. */
export function lerDaUrl(params: URLSearchParams, hoje: DataLocal): Periodo {
  const tipo = params.get("periodo");
  const ref = params.get("ref");
  if (!TIPOS_PERIODO.includes(tipo as TipoPeriodo)) return periodoPadrao(hoje);
  return periodo(tipo as TipoPeriodo, ref && DATA_LOCAL.test(ref) ? ref : hoje);
}

export function paraUrl({ tipo, ref }: Periodo): string {
  return `?periodo=${tipo}&ref=${ref}`;
}
