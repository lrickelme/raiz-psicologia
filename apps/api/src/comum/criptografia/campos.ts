import type { Prisma } from "@prisma/client";

export type CamposCriptografados = Partial<Record<Prisma.ModelName, readonly string[]>>;

/**
 * Colunas com dado clínico, cifradas em repouso (project.md, restrições
 * regulatórias).
 */
export const CAMPOS_CRIPTOGRAFADOS: CamposCriptografados = {
  Atendimento: ["motivo"],
  Evolucao: ["texto"],
  RascunhoEvolucao: ["texto"],
};
