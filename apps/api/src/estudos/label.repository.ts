import { Injectable } from "@nestjs/common";
import { Prisma, type LabelPrioridade } from "@prisma/client";
import type { LabelAlteracao, LabelDados } from "@raiz/shared";
import { PrismaService } from "../prisma/prisma.service";

export type LabelComContagem = LabelPrioridade & { _count: { topicos: number } };

/** Nome repetido: o índice `label_prioridade_nome_unico`. */
export function ehNomeRepetido(erro: unknown): boolean {
  return erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2002";
}

/** FK `topico_estudo.label_id` (`ON DELETE RESTRICT`, ou label inexistente na gravação). */
export function ehViolacaoDeLabel(erro: unknown): boolean {
  return erro instanceof Prisma.PrismaClientKnownRequestError && erro.code === "P2003";
}

/**
 * Serializa as operações que mexem na sequência de ordens (criar, reordenar,
 * excluir). Sem `UNIQUE (ordem)` no banco, é este lock que impede duas
 * transações de lerem o mesmo máximo ou renumerarem por cima uma da outra.
 */
async function travarOrdem(tx: Prisma.TransactionClient): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('label_prioridade.ordem'))`;
}

@Injectable()
export class LabelRepository {
  constructor(private readonly prisma: PrismaService) {}

  listar(): Promise<LabelComContagem[]> {
    return this.prisma.labelPrioridade.findMany({
      include: { _count: { select: { topicos: true } } },
      orderBy: { ordem: "asc" },
    });
  }

  obter(id: string): Promise<LabelPrioridade | null> {
    return this.prisma.labelPrioridade.findUnique({ where: { id } });
  }

  /** Entra no fim: `ordem = max + 1`. */
  criar(dados: LabelDados): Promise<LabelPrioridade> {
    return this.prisma.$transaction(async (tx) => {
      await travarOrdem(tx);
      const { _max } = await tx.labelPrioridade.aggregate({ _max: { ordem: true } });
      return tx.labelPrioridade.create({ data: { ...dados, ordem: (_max.ordem ?? 0) + 1 } });
    });
  }

  alterar(id: string, dados: LabelAlteracao): Promise<LabelPrioridade> {
    return this.prisma.labelPrioridade.update({ where: { id }, data: dados });
  }

  /**
   * Reescreve a ordem de 1 a n na sequência de `ids`. Devolve `false`, sem
   * gravar nada, se `ids` não for exatamente o conjunto atual de labels.
   */
  reordenar(ids: string[]): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      await travarOrdem(tx);
      const atuais = new Set(
        (await tx.labelPrioridade.findMany({ select: { id: true } })).map((l) => l.id),
      );
      const recebidos = new Set(ids);
      const mesmoConjunto =
        ids.length === atuais.size &&
        recebidos.size === atuais.size &&
        ids.every((id) => atuais.has(id));
      if (!mesmoConjunto) return false;

      for (const [indice, id] of ids.entries()) {
        await tx.labelPrioridade.update({ where: { id }, data: { ordem: indice + 1 } });
      }
      return true;
    });
  }

  contarTopicos(labelId: string): Promise<number> {
    return this.prisma.topicoEstudo.count({ where: { labelId } });
  }

  /**
   * Exclui e fecha o buraco na ordem, na mesma transação. Com tópico associado,
   * a FK recusa o DELETE (P2003) e nada muda.
   */
  excluir(id: string): Promise<void> {
    return this.prisma.$transaction(async (tx) => {
      await travarOrdem(tx);
      const { ordem } = await tx.labelPrioridade.delete({ where: { id } });
      await tx.labelPrioridade.updateMany({
        where: { ordem: { gt: ordem } },
        data: { ordem: { decrement: 1 } },
      });
    });
  }
}
