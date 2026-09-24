import { z } from "zod";
import { DATA_LOCAL, diasEntre } from "./calendario";
import { dinheiroSchema } from "./paciente";

export const STATUS_ATENDIMENTO = [
  "AGENDADO",
  "REALIZADO",
  "CANCELADO",
  "REMARCADO",
  "FALTA",
] as const;
export type StatusAtendimento = (typeof STATUS_ATENDIMENTO)[number];

export const DURACAO_MINIMA_MIN = 15;
export const DURACAO_MAXIMA_MIN = 12 * 60;
export const DURACAO_PADRAO_MIN = 50;
/** Maior janela de `GET /atendimentos` sem `pacienteId`: seis semanas de mês e margem. */
export const JANELA_MAXIMA_DIAS = 62;

/** Instante ISO-8601 com offset explícito (project.md). */
const instanteSchema = z
  .string({ required_error: "Informe o horário" })
  .datetime({ offset: true, message: "Use data e hora ISO-8601 com fuso" });

const motivoSchema = z
  .string({ required_error: "Informe o motivo", invalid_type_error: "Informe o motivo" })
  .trim()
  .min(1, "Informe o motivo")
  .max(2000, "Motivo longo demais");

function duracaoMin(inicio: string, fim: string): number {
  return (Date.parse(fim) - Date.parse(inicio)) / 60_000;
}

/** `POST /api/v1/atendimentos`. Sem `valor`, herda o do paciente. */
export const atendimentoEntradaSchema = z
  .object({
    pacienteId: z.string({ required_error: "Escolha o paciente" }).uuid("Escolha o paciente"),
    inicio: instanteSchema,
    fim: instanteSchema,
    valor: dinheiroSchema.optional(),
  })
  .superRefine(({ inicio, fim }, ctx) => {
    const duracao = duracaoMin(inicio, fim);
    if (duracao <= 0) {
      ctx.addIssue({ code: "custom", path: ["fim"], message: "O término deve ser depois do início" });
    } else if (duracao < DURACAO_MINIMA_MIN) {
      ctx.addIssue({ code: "custom", path: ["fim"], message: `Duração mínima de ${DURACAO_MINIMA_MIN} minutos` });
    } else if (duracao > DURACAO_MAXIMA_MIN) {
      ctx.addIssue({ code: "custom", path: ["fim"], message: "Duração máxima de 12 horas" });
    }
  });
export type AtendimentoEntrada = z.input<typeof atendimentoEntradaSchema>;
export type AtendimentoDados = z.output<typeof atendimentoEntradaSchema>;

/** Cancelar e marcar falta. */
export const encerramentoSchema = z.object({ motivo: motivoSchema });
export type Encerramento = z.output<typeof encerramentoSchema>;

/**
 * Remarcar preserva a duração do original (spec agenda): o novo término é
 * calculado. `fim`, se vier, precisa bater com ela.
 */
export const remarcacaoSchema = z.object({
  inicio: instanteSchema,
  fim: instanteSchema.optional(),
  motivo: motivoSchema,
});
export type Remarcacao = z.output<typeof remarcacaoSchema>;

/**
 * `GET /api/v1/atendimentos`. `de` e `ate` são datas de calendário de São
 * Paulo, inclusivas: quem resolve o fuso é a API, não o cliente.
 */
export const consultaAtendimentosSchema = z
  .object({
    de: z.string().regex(DATA_LOCAL, "Use AAAA-MM-DD").optional(),
    ate: z.string().regex(DATA_LOCAL, "Use AAAA-MM-DD").optional(),
    pacienteId: z.string().uuid().optional(),
  })
  .superRefine(({ de, ate, pacienteId }, ctx) => {
    if (!de !== !ate) {
      ctx.addIssue({ code: "custom", path: [de ? "ate" : "de"], message: "Informe o início e o fim do intervalo" });
      return;
    }
    if (!de || !ate) {
      if (!pacienteId) {
        ctx.addIssue({ code: "custom", path: ["de"], message: "Informe o intervalo ou o paciente" });
      }
      return;
    }
    const dias = diasEntre(de, ate);
    if (dias < 0) {
      ctx.addIssue({ code: "custom", path: ["ate"], message: "O fim do intervalo é anterior ao início" });
    } else if (!pacienteId && dias >= JANELA_MAXIMA_DIAS) {
      ctx.addIssue({ code: "custom", path: ["ate"], message: `Intervalo de no máximo ${JANELA_MAXIMA_DIAS} dias` });
    }
  });
export type ConsultaAtendimentos = z.output<typeof consultaAtendimentosSchema>;

/** Atendimento como a API devolve. */
export type Atendimento = {
  id: string;
  paciente: { id: string; nome: string };
  inicio: string;
  fim: string;
  status: StatusAtendimento;
  valor: string;
  /**
   * Dado clínico. Só vem na consulta por paciente (histórico) e nas respostas
   * das operações que o gravam; a grade do calendário não o recebe.
   */
  motivo?: string | null;
  remarcadoDeId: string | null;
  remarcadoParaId: string | null;
};

/** Corpo do 409 de sobreposição. */
export type ConflitoDeHorario = {
  conflitante: { id: string; inicio: string; fim: string; paciente: string };
  proximoHorarioLivre: { inicio: string; fim: string };
};

/** Corpo do 409 de arquivar paciente com atendimentos futuros. */
export type AtendimentosPendentes = {
  pendentes: { id: string; inicio: string; fim: string }[];
};
