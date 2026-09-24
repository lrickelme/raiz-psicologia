/** Tipos de evento gravados em `auditoria.tipo_evento`. */
export const EventoAuditoria = {
  LOGIN_SUCESSO: "LOGIN_SUCESSO",
  LOGIN_FALHA: "LOGIN_FALHA",
  LOGOUT: "LOGOUT",
  LEITURA: "LEITURA",
  ESCRITA: "ESCRITA",
} as const;

export type EventoAuditoria = (typeof EventoAuditoria)[keyof typeof EventoAuditoria];

/** Recursos cujo acesso é auditado. */
export type RecursoAuditado = "USUARIO" | "PACIENTE" | "ATENDIMENTO";
