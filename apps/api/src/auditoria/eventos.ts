/** Tipos de evento gravados em `auditoria.tipo_evento`. */
export const EventoAuditoria = {
  LOGIN_SUCESSO: "LOGIN_SUCESSO",
  LOGIN_FALHA: "LOGIN_FALHA",
  LOGOUT: "LOGOUT",
  LEITURA: "LEITURA",
  ESCRITA: "ESCRITA",
  /** Lista do prontuário aberta; nenhum texto decifrado. */
  EVOLUCAO_LISTADA: "EVOLUCAO_LISTADA",
  /** Texto de uma evolução decifrado — gravado pela criptografia, não por rota. */
  EVOLUCAO_LIDA: "EVOLUCAO_LIDA",
  /** PDF do prontuário gerado; cada versão incluída gera também um `EVOLUCAO_LIDA`. */
  PRONTUARIO_EXPORTADO: "PRONTUARIO_EXPORTADO",
} as const;

export type EventoAuditoria = (typeof EventoAuditoria)[keyof typeof EventoAuditoria];

/** Recursos cujo acesso é auditado. */
export type RecursoAuditado =
  | "USUARIO"
  | "PACIENTE"
  | "ATENDIMENTO"
  | "EVOLUCAO"
  | "RASCUNHO_EVOLUCAO";
