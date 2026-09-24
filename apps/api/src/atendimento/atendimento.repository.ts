import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { DURACAO_MAXIMA_MIN, intervaloDosDias, type ConsultaAtendimentos } from "@raiz/shared";
import { PrismaService } from "../prisma/prisma.service";

/** Status que ainda ocupam o horário — espelha o WHERE da constraint EXCLUDE. */
export const STATUS_QUE_OCUPAM = ["AGENDADO", "REALIZADO", "FALTA"] as const;

export const incluirRelacoes = {
  paciente: { select: { id: true, nome: true } },
  remarcadoPara: { select: { id: true } },
} satisfies Prisma.AtendimentoInclude;

export type AtendimentoComRelacoes = Prisma.AtendimentoGetPayload<{
  include: typeof incluirRelacoes;
}>;

/** Sobreposição com [inicio, fim), limitando `inicio` por baixo para usar o índice. */
export function sobrepoe(inicio: Date, fim: Date): Prisma.AtendimentoWhereInput {
  return {
    inicio: { lt: fim, gt: new Date(inicio.getTime() - DURACAO_MAXIMA_MIN * 60_000) },
    fim: { gt: inicio },
  };
}

/** Violação da constraint `atendimento_sem_sobreposicao` (SQLSTATE 23P01). */
export function ehSobreposicao(erro: unknown): boolean {
  // O Prisma não mapeia 23P01 para um código próprio: o SQLSTATE e o nome da
  // constraint só aparecem na mensagem do erro desconhecido.
  return (
    erro instanceof Prisma.PrismaClientUnknownRequestError &&
    erro.message.includes("23P01") &&
    erro.message.includes("atendimento_sem_sobreposicao")
  );
}

@Injectable()
export class AtendimentoRepository {
  constructor(private readonly prisma: PrismaService) {}

  listar({ de, ate, pacienteId }: ConsultaAtendimentos): Promise<AtendimentoComRelacoes[]> {
    const intervalo = de && ate ? intervaloDosDias(de, ate) : undefined;
    return this.prisma.atendimento.findMany({
      where: {
        ...(pacienteId && { pacienteId }),
        ...(intervalo && sobrepoe(intervalo.inicio, intervalo.fim)),
      },
      include: incluirRelacoes,
      orderBy: [{ inicio: "asc" }, { id: "asc" }],
    });
  }

  obter(id: string): Promise<AtendimentoComRelacoes | null> {
    return this.prisma.atendimento.findUnique({ where: { id }, include: incluirRelacoes });
  }

  /** Atendimentos que ocupam algum trecho de [inicio, fim), exceto `excetoId`. */
  ocupando(inicio: Date, fim: Date, excetoId?: string) {
    return this.prisma.atendimento.findMany({
      where: {
        ...sobrepoe(inicio, fim),
        status: { in: [...STATUS_QUE_OCUPAM] },
        ...(excetoId && { id: { not: excetoId } }),
      },
      include: { paciente: { select: { nome: true } } },
      orderBy: { inicio: "asc" },
    });
  }
}
