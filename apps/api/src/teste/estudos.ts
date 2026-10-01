import type { PrismaService } from "../prisma/prisma.service";

/** Ids das labels iniciais, fixados pela migration `estudos`. */
export const LABELS_INICIAIS = {
  alta: "0199a000-0000-7000-8000-000000000001",
  media: "0199a000-0000-7000-8000-000000000002",
  baixa: "0199a000-0000-7000-8000-000000000003",
} as const;

/** Volta ao estado recém-migrado: sem tópicos, só Alta, Média e Baixa. */
export async function reiniciarEstudos(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe("TRUNCATE topico_estudo, label_prioridade");
  await prisma.$executeRaw`
    INSERT INTO label_prioridade (id, nome, cor, ordem, atualizado_em) VALUES
      (${LABELS_INICIAIS.alta}::uuid, 'Alta', 'VINHO', 1, now()),
      (${LABELS_INICIAIS.media}::uuid, 'Média', 'AMBAR', 2, now()),
      (${LABELS_INICIAIS.baixa}::uuid, 'Baixa', 'MUSGO', 3, now())`;
}
