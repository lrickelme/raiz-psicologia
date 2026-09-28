import { z } from "zod";
import type { StatusAtendimento } from "./atendimento";
import { DATA_LOCAL, diasEntre } from "./calendario";
import type { StatusPaciente } from "./paciente";

/** Maior série de `GET /financeiro/mensal`. */
export const MESES_MAXIMOS = 24;

/**
 * `GET /financeiro/receita` e `/financeiro/por-paciente`. Intervalo
 * obrigatório: `de` e `ate` são datas de São Paulo, inclusivas, como em
 * `GET /atendimentos`. Sem teto de dias — a apuração é agregada no banco.
 */
export const periodoFinanceiroSchema = z
  .object({
    de: z.string({ required_error: "Informe o início do período" }).regex(DATA_LOCAL, "Use AAAA-MM-DD"),
    ate: z.string({ required_error: "Informe o fim do período" }).regex(DATA_LOCAL, "Use AAAA-MM-DD"),
  })
  .refine(({ de, ate }) => diasEntre(de, ate) >= 0, {
    path: ["ate"],
    message: "O fim do período é anterior ao início",
  });
export type PeriodoFinanceiro = z.output<typeof periodoFinanceiroSchema>;

/** `GET /financeiro/mensal`. */
export const consultaMensalSchema = z.object({
  meses: z.coerce
    .number({ invalid_type_error: "Informe um número de meses" })
    .int("Informe um número inteiro de meses")
    .min(1, "Informe ao menos um mês")
    .max(MESES_MAXIMOS, `No máximo ${MESES_MAXIMOS} meses`)
    .default(12),
});
export type ConsultaMensal = z.output<typeof consultaMensalSchema>;

/*
 * Respostas. Dinheiro sempre como string decimal com duas casas, nunca
 * `number` (design.md da 01, "Decimal na fronteira").
 */

/** Resposta de `GET /financeiro/receita`. Os três valores nunca são somados num só. */
export type Receita = {
  /** Cobráveis, não dispensados, com início no período. */
  realizada: string;
  /**
   * `AGENDADO` do mês corrente, no período, que ainda não terminaram. `null`
   * quando o período não alcança o mês corrente: previsão não é projeção
   * (spec financeiro).
   */
  prevista: string | null;
  /**
   * `AGENDADO` do período, de qualquer mês, cujo horário já terminou: ainda
   * devem entrar, mas são pendência operacional, não previsão.
   */
  pendentes: { quantidade: number; valor: string };
};

/** Um mês da série de `GET /financeiro/mensal`, em ordem cronológica. */
export type ReceitaMensal = {
  /** AAAA-MM, em São Paulo. */
  mes: string;
  realizada: string;
};

/** Uma linha de `GET /financeiro/por-paciente`. */
export type ReceitaPorPaciente = {
  paciente: { id: string; nome: string; status: StatusPaciente };
  total: string;
  /** Todos os status, inclusive os que não somam ao total (remarcações). */
  contagem: Record<StatusAtendimento, number>;
};
