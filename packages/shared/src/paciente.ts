import { z } from "zod";

/** Teto de itens por página na listagem (spec pacientes). */
export const TAMANHO_MAXIMO_PAGINA = 50;

export const STATUS_PACIENTE = ["ATIVO", "ARQUIVADO"] as const;
export type StatusPaciente = (typeof STATUS_PACIENTE)[number];

/** Campo opcional de formulário: vazio vira `null`, que no PATCH apaga o valor. */
function opcional<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(
    (valor) => (typeof valor === "string" && valor.trim() === "" ? null : valor),
    schema.nullable().optional(),
  );
}

/**
 * Dinheiro trafega como string decimal, nunca `number` (design.md, "Decimal na
 * fronteira"). Aceita vírgula como separador, porque é o que se digita aqui.
 * Até 8 dígitos inteiros: é o que cabe em `numeric(10,2)`.
 */
export const dinheiroSchema = z
  .string({ required_error: "Informe o valor", invalid_type_error: "Informe o valor" })
  .trim()
  .min(1, "Informe o valor")
  .transform((valor) => valor.replace(",", "."))
  .refine(
    (valor) => /^\d{1,8}(\.\d{1,2})?$/.test(valor),
    "Use um valor não negativo com até duas casas decimais",
  );

const dataIsoSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD")
  .refine((valor) => !Number.isNaN(Date.parse(valor)), "Data inválida");

export const pacienteEntradaSchema = z.object({
  nome: z
    .string({ required_error: "Informe o nome" })
    .trim()
    .min(1, "Informe o nome")
    .max(200, "Nome longo demais"),
  telefone: opcional(z.string().trim().max(30, "Telefone longo demais")),
  email: opcional(z.string().trim().toLowerCase().email("E-mail inválido")),
  nascimento: opcional(
    dataIsoSchema.refine(
      (valor) => valor <= new Date().toISOString().slice(0, 10),
      "Data de nascimento no futuro",
    ),
  ),
  valorConsultaPadrao: dinheiroSchema,
  observacoes: opcional(z.string().trim().max(2000, "Observações longas demais")),
});

/** `POST /api/v1/pacientes`. */
export type PacienteEntrada = z.input<typeof pacienteEntradaSchema>;
export type PacienteDados = z.output<typeof pacienteEntradaSchema>;

/** `PATCH /api/v1/pacientes/:id`: campo ausente fica como está, `null` apaga. */
export const pacienteAlteracaoSchema = pacienteEntradaSchema.partial();
export type PacienteAlteracao = z.output<typeof pacienteAlteracaoSchema>;

/**
 * `POST /api/v1/pacientes/:id/arquivar`. Com atendimentos futuros e sem
 * motivo, a API responde 409 listando-os; com motivo, cancela todos com ele e
 * arquiva (spec pacientes, "Arquivar com agenda futura").
 */
export const arquivamentoSchema = z
  .object({ motivoCancelamento: opcional(z.string().trim().max(2000, "Motivo longo demais")) })
  .default({});
export type Arquivamento = z.output<typeof arquivamentoSchema>;

export const listagemPacientesSchema = z.object({
  busca: z.string().trim().max(200).optional(),
  status: z.enum([...STATUS_PACIENTE, "TODOS"]).default("ATIVO"),
  page: z.coerce.number().int().min(1).default(1),
  // Acima do teto não é erro: a listagem só nunca devolve mais que isso.
  size: z.coerce
    .number()
    .int()
    .min(1)
    .default(20)
    .transform((tamanho) => Math.min(tamanho, TAMANHO_MAXIMO_PAGINA)),
});
export type ListagemPacientes = z.output<typeof listagemPacientesSchema>;

/** Paciente como a API devolve. Datas em ISO, dinheiro em string com 2 casas. */
export type Paciente = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  /** AAAA-MM-DD. */
  nascimento: string | null;
  valorConsultaPadrao: string;
  observacoes: string | null;
  status: StatusPaciente;
  criadoEm: string;
  atualizadoEm: string;
};

export type Pagina<T> = {
  itens: T[];
  total: number;
  page: number;
  size: number;
};

/**
 * Nome comparável para achar homônimos: sem acento, sem caixa, sem espaço
 * duplicado. Mesmo critério da busca no banco (`raiz_normalizar`).
 */
export function normalizarNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}
