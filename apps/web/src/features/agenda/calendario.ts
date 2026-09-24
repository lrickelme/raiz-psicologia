import {
  diaDaSemana,
  fimDoMes,
  inicioDaSemana,
  inicioDoMes,
  minutosDoDia,
  somarDias,
  somarMeses,
  type Atendimento,
  type DataLocal,
  type StatusAtendimento,
} from "@raiz/shared";

export type Visao = "dia" | "semana" | "mes";

export const VISOES: { valor: Visao; rotulo: string }[] = [
  { valor: "dia", rotulo: "Diária" },
  { valor: "semana", rotulo: "Semanal" },
  { valor: "mes", rotulo: "Mensal" },
];

/**
 * Preferências da agenda em cookie, não em localStorage: o servidor as lê e a
 * página já renderiza na visão certa, sem piscar a padrão antes.
 */
export const COOKIE_VISAO = "raiz_agenda_visao";
export const COOKIE_ENCERRADOS = "raiz_agenda_encerrados";

const UM_ANO_S = 365 * 24 * 60 * 60;

export function salvarPreferencia(nome: string, valor: string): void {
  document.cookie = `${nome}=${valor}; path=/; max-age=${UM_ANO_S}; samesite=strict`;
}

export function ehVisao(valor: unknown): valor is Visao {
  return valor === "dia" || valor === "semana" || valor === "mes";
}

/** Grade de horários: 07h às 22h, 58 px por hora (design-ref). */
export const HORA_INICIAL = 7;
export const HORA_FINAL = 22;
export const PX_POR_HORA = 58;
export const PASSO_MIN = 15;

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
export const DIAS_CURTOS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const dia = (d: DataLocal) => Number(d.slice(8, 10));
const mes = (d: DataLocal) => MESES[Number(d.slice(5, 7)) - 1];
const ano = (d: DataLocal) => d.slice(0, 4);

/** Dias exibidos pela visão. O mês ocupa semanas inteiras (seg a dom). */
export function diasVisiveis(visao: Visao, referencia: DataLocal): DataLocal[] {
  if (visao === "dia") return [referencia];
  const primeiro =
    visao === "semana" ? inicioDaSemana(referencia) : inicioDaSemana(inicioDoMes(referencia));
  const total =
    visao === "semana"
      ? 7
      : Math.ceil((diaDaSemana(inicioDoMes(referencia)) + dia(fimDoMes(referencia))) / 7) * 7;
  return Array.from({ length: total }, (_, i) => somarDias(primeiro, i));
}

/**
 * Janela pedida à API: o que está visível mais uma margem (spec agenda,
 * "Carregamento por período"), para navegar ao lado sem esperar.
 */
export function janelaDeBusca(visao: Visao, referencia: DataLocal): { de: DataLocal; ate: DataLocal } {
  const dias = diasVisiveis(visao, referencia);
  const margem = visao === "mes" ? 7 : visao === "semana" ? 7 : 1;
  return { de: somarDias(dias[0], -margem), ate: somarDias(dias[dias.length - 1], margem) };
}

export function navegar(visao: Visao, referencia: DataLocal, sentido: 1 | -1): DataLocal {
  if (visao === "dia") return somarDias(referencia, sentido);
  if (visao === "semana") return somarDias(referencia, 7 * sentido);
  return somarMeses(referencia, sentido);
}

export function titulo(visao: Visao, referencia: DataLocal): string {
  if (visao === "dia") {
    return `${DIAS_CURTOS[diaDaSemana(referencia)]}, ${dia(referencia)} de ${mes(referencia)} ${ano(referencia)}`;
  }
  if (visao === "mes") return `${mes(referencia)} ${ano(referencia)}`.replace(/^./, (c) => c.toUpperCase());
  const [primeiro, , , , , , ultimo] = diasVisiveis("semana", referencia);
  const mesmoMes = primeiro.slice(0, 7) === ultimo.slice(0, 7);
  return mesmoMes
    ? `${dia(primeiro)} – ${dia(ultimo)} de ${mes(ultimo)} ${ano(ultimo)}`
    : `${dia(primeiro)} de ${mes(primeiro)} – ${dia(ultimo)} de ${mes(ultimo)} ${ano(ultimo)}`;
}

/** Mês e ano dos dias visíveis, como a barra do design-ref: "Junho – Julho 2026". */
export function rotuloMeses(dias: DataLocal[]): string {
  const primeiro = dias[0];
  const ultimo = dias[dias.length - 1];
  const nome = (d: DataLocal) => mes(d).replace(/^./, (c) => c.toUpperCase());
  if (primeiro.slice(0, 7) === ultimo.slice(0, 7)) return `${nome(primeiro)} ${ano(primeiro)}`;
  if (ano(primeiro) === ano(ultimo)) return `${nome(primeiro)} – ${nome(ultimo)} ${ano(ultimo)}`;
  return `${nome(primeiro)} ${ano(primeiro)} – ${nome(ultimo)} ${ano(ultimo)}`;
}

export function formatarDiaLongo(data: DataLocal): string {
  return `${dia(data)} de ${mes(data)}`;
}

/** Status que ainda ocupam o horário — o mesmo critério da constraint no banco. */
export const OCUPA: Record<StatusAtendimento, boolean> = {
  AGENDADO: true,
  REALIZADO: true,
  FALTA: true,
  CANCELADO: false,
  REMARCADO: false,
};

/** Atendimento que ocupa algum trecho de [inicio, fim), exceto `excetoId`. */
export function conflitoLocal(
  atendimentos: Atendimento[],
  inicio: Date,
  fim: Date,
  excetoId?: string,
): Atendimento | undefined {
  return atendimentos.find(
    (a) =>
      OCUPA[a.status] &&
      a.id !== excetoId &&
      Date.parse(a.inicio) < fim.getTime() &&
      Date.parse(a.fim) > inicio.getTime(),
  );
}

export type Posicionado = { atendimento: Atendimento; faixa: number; faixas: number };

/**
 * Faixas lado a lado para blocos que se cruzam. Atendimentos ativos nunca se
 * sobrepõem (constraint); isso só acontece com cancelados e remarcados à mostra.
 */
export function emFaixas(atendimentos: Atendimento[]): Posicionado[] {
  const ordenados = [...atendimentos].sort((a, b) => a.inicio.localeCompare(b.inicio));
  const saida: Posicionado[] = [];
  let grupo: Posicionado[] = [];
  let fimDoGrupo = 0;
  const fecharGrupo = () => {
    const faixas = Math.max(1, ...grupo.map((p) => p.faixa + 1));
    grupo.forEach((p) => saida.push({ ...p, faixas }));
    grupo = [];
  };

  for (const atendimento of ordenados) {
    const inicio = Date.parse(atendimento.inicio);
    if (grupo.length && inicio >= fimDoGrupo) fecharGrupo();
    const ocupadas = new Set(
      grupo.filter((p) => Date.parse(p.atendimento.fim) > inicio).map((p) => p.faixa),
    );
    let faixa = 0;
    while (ocupadas.has(faixa)) faixa++;
    grupo.push({ atendimento, faixa, faixas: 1 });
    fimDoGrupo = Math.max(fimDoGrupo, Date.parse(atendimento.fim));
  }
  if (grupo.length) fecharGrupo();
  return saida;
}

/** Posição vertical em px de um instante na grade. */
export function topoPx(instante: string): number {
  return ((minutosDoDia(instante) - HORA_INICIAL * 60) * PX_POR_HORA) / 60;
}

export function arredondarPasso(minutos: number): number {
  return Math.round(minutos / PASSO_MIN) * PASSO_MIN;
}
