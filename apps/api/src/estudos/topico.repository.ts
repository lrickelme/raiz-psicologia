import { Injectable } from "@nestjs/common";
import { Prisma, type StatusTopico } from "@prisma/client";
import { CONCLUIDOS_NO_QUADRO } from "@raiz/shared";
import { PrismaService } from "../prisma/prisma.service";

export const incluirLabel = { label: true } satisfies Prisma.TopicoEstudoInclude;

export type TopicoComLabel = Prisma.TopicoEstudoGetPayload<{ include: typeof incluirLabel }>;

/** Mais recentes primeiro; o índice parcial `topico_estudo_concluidos_idx` cobre. */
const ORDEM_CONCLUIDOS: Prisma.TopicoEstudoOrderByWithRelationInput[] = [
  { concluidoEm: "desc" },
  { id: "desc" },
];

@Injectable()
export class TopicoRepository {
  constructor(private readonly prisma: PrismaService) {}

  obter(id: string): Promise<TopicoComLabel | null> {
    return this.prisma.topicoEstudo.findUnique({ where: { id }, include: incluirLabel });
  }

  criar(dados: Prisma.TopicoEstudoUncheckedCreateInput): Promise<TopicoComLabel> {
    return this.prisma.topicoEstudo.create({ data: dados, include: incluirLabel });
  }

  alterar(id: string, dados: Prisma.TopicoEstudoUncheckedUpdateInput): Promise<TopicoComLabel> {
    return this.prisma.topicoEstudo.update({ where: { id }, data: dados, include: incluirLabel });
  }

  labelExiste(id: string): Promise<boolean> {
    return this.prisma.labelPrioridade
      .count({ where: { id } })
      .then((quantidade) => quantidade > 0);
  }

  /**
   * Coluna pendente, ordenada no SQL: ordem da label e, no mesmo nível, mais
   * antigos primeiro. O LEFT JOIN da relação deixa `ordem` nulo para tópico sem
   * label, e no Postgres `ASC` já põe nulos por último — o Prisma não aceita
   * `nulls` em campo obrigatório do outro lado de relação opcional.
   */
  pendentes(status: Exclude<StatusTopico, "CONCLUIDO">): Promise<TopicoComLabel[]> {
    return this.prisma.topicoEstudo.findMany({
      where: { status },
      include: incluirLabel,
      orderBy: [{ label: { ordem: "asc" } }, { criadoEm: "asc" }, { id: "asc" }],
    });
  }

  concluidosRecentes(): Promise<TopicoComLabel[]> {
    return this.prisma.topicoEstudo.findMany({
      where: { status: "CONCLUIDO" },
      include: incluirLabel,
      orderBy: ORDEM_CONCLUIDOS,
      take: CONCLUIDOS_NO_QUADRO,
    });
  }

  contarConcluidos(intervalo?: { inicio: Date; fim: Date }): Promise<number> {
    return this.prisma.topicoEstudo.count({
      where: {
        status: "CONCLUIDO",
        ...(intervalo && { concluidoEm: { gte: intervalo.inicio, lt: intervalo.fim } }),
      },
    });
  }

  concluidos(pagina: number, tamanho: number): Promise<TopicoComLabel[]> {
    return this.prisma.topicoEstudo.findMany({
      where: { status: "CONCLUIDO" },
      include: incluirLabel,
      orderBy: ORDEM_CONCLUIDOS,
      skip: (pagina - 1) * tamanho,
      take: tamanho,
    });
  }
}
