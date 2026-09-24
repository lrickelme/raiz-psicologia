import { SetMetadata } from "@nestjs/common";
import type { RecursoAuditado } from "./eventos";

export const RECURSO_AUDITADO = "recursoAuditado";

/**
 * Marca um controller (ou um handler) cujo acesso entra na trilha. Aplicado na
 * classe, cobre também os métodos que forem criados depois — é isso que evita
 * o esquecimento que a chamada manual nos serviços provocaria.
 */
export const Auditado = (recurso: RecursoAuditado) =>
  SetMetadata(RECURSO_AUDITADO, recurso);
