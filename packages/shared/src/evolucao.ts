import { z } from "zod";

/** Folga ampla para texto clínico longo; o teto só impede payload abusivo. */
export const TEXTO_EVOLUCAO_MAX = 50_000;

/**
 * Texto livre da evolução (spec prontuario). Só espaços é texto em branco;
 * fora isso, o conteúdo é gravado exatamente como digitado.
 */
export const textoEvolucaoSchema = z
  .string({ required_error: "Escreva a evolução", invalid_type_error: "Escreva a evolução" })
  .max(TEXTO_EVOLUCAO_MAX, "Texto longo demais")
  .refine((texto) => texto.trim().length > 0, "Escreva a evolução");

/**
 * `POST /api/v1/pacientes/:id/evolucoes`. Data e hora não entram: são do
 * servidor, e um campo extra no corpo é descartado.
 */
export const evolucaoEntradaSchema = z.object({
  texto: textoEvolucaoSchema,
  atendimentoId: z.string().uuid("Atendimento inválido").nullish(),
});
export type EvolucaoEntrada = z.input<typeof evolucaoEntradaSchema>;
export type EvolucaoDados = z.output<typeof evolucaoEntradaSchema>;

/**
 * `POST /api/v1/evolucoes/:id/retificar`. Paciente e atendimento vêm da
 * versão retificada; data e hora, do servidor.
 */
export const retificacaoSchema = z.object({ texto: textoEvolucaoSchema });
export type Retificacao = z.output<typeof retificacaoSchema>;

/** Evolução sem o texto, como a lista do prontuário devolve. */
export type EvolucaoResumo = {
  id: string;
  pacienteId: string;
  atendimentoId: string | null;
  registradoEm: string;
  /** Versão anterior, quando esta é uma retificação. */
  retificaDeId: string | null;
  vigente: boolean;
};

/**
 * Item da lista do prontuário: a versão vigente de cada evolução, com a data
 * da versão original — é por ela que a lista se ordena, para que retificar
 * uma evolução antiga não a traga para o topo.
 */
export type EvolucaoListada = EvolucaoResumo & { originalmenteEm: string };

/** O que o perfil mostra do prontuário, sem abrir texto nenhum. */
export type ResumoProntuario = {
  evolucoes: number;
  ultimaEvolucaoEm: string | null;
  /** Só para paciente arquivado (spec prontuario, "Prazo de guarda configurável"). */
  guarda: {
    prazoAnos: number;
    /** Instante do último registro, de onde a contagem parte. */
    ultimoRegistroEm: string;
    /** Data de calendário AAAA-MM-DD. */
    elegivelEm: string;
    /** A data já passou; nada é apagado por isso. */
    elegivel: boolean;
  } | null;
};

/** Evolução aberta: cada uma entregue assim gera um `EVOLUCAO_LIDA`. */
export type Evolucao = EvolucaoResumo & { texto: string };

const uuidOpcional = (mensagem: string) =>
  z.preprocess(
    (valor) => (valor === "" ? null : valor),
    z.string().uuid(mensagem).nullish(),
  );

/**
 * Identifica o rascunho: um por paciente e atendimento, e um avulso (sem
 * atendimento) por paciente. Query de `GET` e `DELETE /prontuario/rascunho`.
 */
export const chaveRascunhoSchema = z.object({
  pacienteId: z.string({ required_error: "Informe o paciente" }).uuid("Paciente inválido"),
  atendimentoId: uuidOpcional("Atendimento inválido"),
});
export type ChaveRascunho = z.output<typeof chaveRascunhoSchema>;

/**
 * `PUT /api/v1/prontuario/rascunho`. Texto vazio é aceito: é o estado de quem
 * apagou tudo para recomeçar, e o rascunho só some ao gravar ou descartar.
 */
export const rascunhoEntradaSchema = chaveRascunhoSchema.extend({
  texto: z
    .string({ required_error: "Informe o texto", invalid_type_error: "Informe o texto" })
    .max(TEXTO_EVOLUCAO_MAX, "Texto longo demais"),
});
export type RascunhoEntrada = z.input<typeof rascunhoEntradaSchema>;
export type RascunhoDados = z.output<typeof rascunhoEntradaSchema>;

/** Resposta do `PUT`: o suficiente para o indicador de "rascunho salvo". */
export type RascunhoSalvo = { id: string; atualizadoEm: string };

export type RascunhoEvolucao = RascunhoSalvo & {
  pacienteId: string;
  atendimentoId: string | null;
  texto: string;
};
