import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Tudo menos `texto`. Consulta que não pede a coluna não decifra nada e, por
 * isso, não gera `EVOLUCAO_LIDA` — é o que mantém a lista e a gravação fora
 * da trilha de leitura.
 */
export const selecaoResumo = {
  id: true,
  pacienteId: true,
  atendimentoId: true,
  registradoEm: true,
  retificaDeId: true,
  vigente: true,
} satisfies Prisma.EvolucaoSelect;

export type EvolucaoResumoDb = Prisma.EvolucaoGetPayload<{ select: typeof selecaoResumo }>;

@Injectable()
export class ProntuarioRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Todas as versões do paciente, sem texto: a lista precisa das originais para datar as vigentes. */
  listarVersoes(pacienteId: string): Promise<EvolucaoResumoDb[]> {
    return this.prisma.evolucao.findMany({ where: { pacienteId }, select: selecaoResumo });
  }

  /**
   * Ids da cadeia de retificação que contém `id`, da versão original à
   * vigente. Sobe até a raiz e desce pela ordem dos elos, em vez de ordenar
   * por data: a ordem é a da cadeia, sem depender de relógio. SQL cru e sem
   * `texto`, então nada é decifrado aqui.
   */
  async cadeia(id: string): Promise<string[]> {
    const linhas = await this.prisma.$queryRaw<{ id: string }[]>`
      WITH RECURSIVE anteriores AS (
        SELECT id, retifica_de_id FROM evolucao WHERE id = ${id}::uuid
        UNION ALL
        SELECT e.id, e.retifica_de_id
          FROM evolucao e JOIN anteriores a ON e.id = a.retifica_de_id
      ),
      cadeia AS (
        SELECT id, 0 AS ordem FROM anteriores WHERE retifica_de_id IS NULL
        UNION ALL
        SELECT e.id, c.ordem + 1
          FROM evolucao e JOIN cadeia c ON e.retifica_de_id = c.id
      )
      SELECT id::text FROM cadeia ORDER BY ordem`;
    return linhas.map((linha) => linha.id);
  }

  /** Decifra: cada versão devolvida gera um `EVOLUCAO_LIDA`. */
  abrirVarias(ids: string[]) {
    return this.prisma.evolucao.findMany({
      where: { id: { in: ids } },
      select: { ...selecaoResumo, texto: true },
    });
  }

  /** Decifra o texto: cada chamada com resultado gera um `EVOLUCAO_LIDA`. */
  abrir(id: string) {
    return this.prisma.evolucao.findUnique({
      where: { id },
      select: { ...selecaoResumo, texto: true },
    });
  }
}
