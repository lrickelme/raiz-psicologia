import { applyDecorators, SetMetadata } from "@nestjs/common";
import type { RecursoAuditado } from "./eventos";

export const RECURSO_AUDITADO = "recursoAuditado";
export const IDS_AUDITADOS = "idsAuditados";

/** Ids dos recursos na resposta, quando não estão em `id` no topo de cada item. */
export type ExtratorDeIds = (corpo: unknown) => string[];

/**
 * Marca um controller (ou um handler) cujo acesso entra na trilha. Aplicado na
 * classe, cobre também os métodos que forem criados depois — é isso que evita
 * o esquecimento que a chamada manual nos serviços provocaria.
 */
export const Auditado = <T>(recurso: RecursoAuditado, extrairIds?: (corpo: T) => string[]) =>
  applyDecorators(
    SetMetadata(RECURSO_AUDITADO, recurso),
    ...(extrairIds ? [SetMetadata(IDS_AUDITADOS, extrairIds)] : []),
  );
