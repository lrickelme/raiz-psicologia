import type { Prisma } from "@prisma/client";

export type CamposCriptografados = Partial<Record<Prisma.ModelName, readonly string[]>>;

/**
 * Colunas com dado clínico, cifradas em repouso (project.md, restrições
 * regulatórias). A evolução do prontuário entra aqui na change 02.
 */
export const CAMPOS_CRIPTOGRAFADOS: CamposCriptografados = {
  Atendimento: ["motivo"],
};
