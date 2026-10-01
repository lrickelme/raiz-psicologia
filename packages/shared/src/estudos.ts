import { z } from "zod";
import type { Pagina } from "./paciente";

export const STATUS_TOPICO = ["A_ESTUDAR", "EM_ESTUDO", "CONCLUIDO"] as const;
export type StatusTopico = (typeof STATUS_TOPICO)[number];

/**
 * Paleta fechada (spec estudos, "Paleta fechada de cores"). O banco guarda o
 * papel; o par de fundo e texto de cada um vive só no front.
 */
export const CORES_LABEL = ["VINHO", "AMBAR", "MUSGO", "MUSGO_SUAVE", "MARROM", "BEGE"] as const;
export type CorLabel = (typeof CORES_LABEL)[number];

/** Concluídos que a coluna do quadro mostra; o resto fica no histórico. */
export const CONCLUIDOS_NO_QUADRO = 5;

/*
 * Tópico de estudo.
 */

export const topicoEntradaSchema = z.object({
  titulo: z
    .string({ required_error: "Informe o título", invalid_type_error: "Informe o título" })
    .trim()
    .min(1, "Informe o título")
    .max(200, "Título longo demais"),
  // Vazio vira `null`, que no PATCH apaga a descrição.
  descricao: z.preprocess(
    (valor) => (typeof valor === "string" && valor.trim() === "" ? null : valor),
    z.string().trim().max(2000, "Descrição longa demais").nullable().optional(),
  ),
  /** `null` é "Sem prioridade". */
  labelId: z.string().uuid("Label inválida").nullish(),
});

/** `POST /api/v1/topicos`. Status não entra: todo tópico nasce `A_ESTUDAR`. */
export type TopicoEntrada = z.input<typeof topicoEntradaSchema>;
export type TopicoDados = z.output<typeof topicoEntradaSchema>;

/**
 * `PATCH /api/v1/topicos/:id`: campo ausente fica como está, `null` apaga.
 * Status fica de fora (descartado se vier): o único caminho de transição é
 * `POST /topicos/:id/mover`.
 */
export const topicoAlteracaoSchema = topicoEntradaSchema.partial();
export type TopicoAlteracao = z.output<typeof topicoAlteracaoSchema>;

/**
 * `POST /api/v1/topicos/:id/mover`. Só o destino: o instante de conclusão é do
 * servidor, e um `concluidoEm` no corpo é descartado.
 */
export const transicaoTopicoSchema = z.object({
  status: z.enum(STATUS_TOPICO, {
    errorMap: () => ({ message: "Estado inválido" }),
  }),
});
export type TransicaoTopico = z.output<typeof transicaoTopicoSchema>;

/** `GET /api/v1/topicos/concluidos?pagina=`. Tamanho fixo em `TAMANHO_MAXIMO_PAGINA`. */
export const historicoConcluidosSchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
});
export type HistoricoConcluidos = z.output<typeof historicoConcluidosSchema>;

/*
 * Label de prioridade.
 */

export const labelEntradaSchema = z.object({
  nome: z
    .string({ required_error: "Informe o nome", invalid_type_error: "Informe o nome" })
    .trim()
    .min(1, "Informe o nome")
    .max(30, "Nome longo demais"),
  cor: z.enum(CORES_LABEL, {
    errorMap: () => ({ message: "Escolha uma cor da paleta" }),
  }),
});

/** `POST /api/v1/labels`. A ordem não entra: a nova label vai para o fim. */
export type LabelEntrada = z.input<typeof labelEntradaSchema>;
export type LabelDados = z.output<typeof labelEntradaSchema>;

/** `PATCH /api/v1/labels/:id`: nome e cor. */
export const labelAlteracaoSchema = labelEntradaSchema.partial();
export type LabelAlteracao = z.output<typeof labelAlteracaoSchema>;

/**
 * `PUT /api/v1/labels/ordem`: todos os ids, na nova ordem. Um conjunto
 * diferente do atual (lista desatualizada) responde 409.
 */
export const ordemLabelsSchema = z.object({
  ids: z.array(z.string().uuid("Label inválida"), {
    required_error: "Informe a ordem das labels",
    invalid_type_error: "Informe a ordem das labels",
  }),
});
export type OrdemLabels = z.output<typeof ordemLabelsSchema>;

/*
 * Respostas.
 */

export type Label = {
  id: string;
  nome: string;
  cor: CorLabel;
  /** 1 é a mais prioritária. */
  ordem: number;
};

/** Item de `GET /labels`: quantos tópicos, de qualquer estado, usam a label. */
export type LabelComUso = Label & { emUso: number };

/** Corpo do 409 de `DELETE /labels/:id` com a label em uso. */
export type LabelEmUso = { topicos: number };

export type Topico = {
  id: string;
  titulo: string;
  descricao: string | null;
  label: Label | null;
  status: StatusTopico;
  /** Instante ISO; presente se, e somente se, `CONCLUIDO`. */
  concluidoEm: string | null;
  criadoEm: string;
  atualizadoEm: string;
};

/** Resposta de `GET /estudos/quadro`. */
export type QuadroEstudos = {
  /** Por ordem da label (sem label por último) e, no mesmo nível, mais antigos primeiro. */
  aEstudar: Topico[];
  emEstudo: Topico[];
  /** Os `CONCLUIDOS_NO_QUADRO` mais recentes. */
  concluidos: Topico[];
  totalConcluidos: number;
  /** `aEstudar` + `emEstudo`. */
  pendentes: number;
  /** Concluídos no mês corrente de São Paulo. */
  concluidosNoMes: number;
};

/** Resposta de `GET /topicos/concluidos`, do mais recente para o mais antigo. */
export type PaginaConcluidos = Pagina<Topico>;
