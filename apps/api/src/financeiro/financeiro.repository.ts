import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { DataLocal, StatusAtendimento, StatusPaciente } from "@raiz/shared";
import { PrismaService } from "../prisma/prisma.service";

type Intervalo = { inicio: Date; fim: Date };

/**
 * O predicado do índice parcial `atendimento_receita_idx`, escrito igual a ele
 * para o planejador usá-lo. Cobrabilidade e valor lidos como congelados: a
 * regra vigente nunca entra aqui (spec financeiro, "Receita realizada").
 */
const naReceita = { cobravel: true, cobrancaDispensada: false } satisfies Prisma.AtendimentoWhereInput;

/** Instante como `timestamptz` explícito: `Date` cru chegaria como `timestamp` sem fuso. */
const instante = (data: Date) => Prisma.sql`${data.toISOString()}::timestamptz`;

export type LinhaPorPaciente = {
  id: string;
  nome: string;
  status: StatusPaciente;
  total: Prisma.Decimal;
} & Record<StatusAtendimento, number>;

/**
 * Agregações da receita, sempre no banco (spec financeiro, "Cálculo agregado
 * no banco"): o que trafega cresce com meses ou pacientes, nunca com
 * atendimentos. Não usa o repositório de `atendimento` — as perguntas são
 * outras (design.md, "Arquitetura").
 */
@Injectable()
export class FinanceiroRepository {
  constructor(private readonly prisma: PrismaService) {}

  async realizada({ inicio, fim }: Intervalo): Promise<Prisma.Decimal> {
    const { _sum } = await this.prisma.atendimento.aggregate({
      where: { ...naReceita, inicio: { gte: inicio, lt: fim } },
      _sum: { valor: true },
    });
    return _sum.valor ?? new Prisma.Decimal(0);
  }

  /** `AGENDADO` com início no intervalo que ainda não terminaram em `agora`. */
  async prevista({ inicio, fim }: Intervalo, agora: Date): Promise<Prisma.Decimal> {
    const { _sum } = await this.prisma.atendimento.aggregate({
      where: { status: "AGENDADO", inicio: { gte: inicio, lt: fim }, fim: { gte: agora } },
      _sum: { valor: true },
    });
    return _sum.valor ?? new Prisma.Decimal(0);
  }

  /** `AGENDADO` com início no intervalo cujo horário terminou antes de `agora`. */
  async pendentes({ inicio, fim }: Intervalo, agora: Date) {
    const { _count, _sum } = await this.prisma.atendimento.aggregate({
      where: { status: "AGENDADO", inicio: { gte: inicio, lt: fim }, fim: { lt: agora } },
      _count: true,
      _sum: { valor: true },
    });
    return { quantidade: _count, valor: _sum.valor ?? new Prisma.Decimal(0) };
  }

  async primeiroInicio(): Promise<Date | null> {
    const { _min } = await this.prisma.atendimento.aggregate({ _min: { inicio: true } });
    return _min.inicio;
  }

  /**
   * Receita realizada mês a mês, de `de` a `ate` (primeiros dias de mês,
   * inclusivos). A série vem do `generate_series`, então mês sem receita
   * aparece com zero em vez de sumir.
   */
  mensal(de: DataLocal, ate: DataLocal) {
    return this.prisma.$queryRaw<{ mes: string; realizada: Prisma.Decimal }[]>`
      SELECT to_char(m.mes, 'YYYY-MM') AS mes, COALESCE(sum(a.valor), 0) AS realizada
        FROM generate_series(${de}::date, ${ate}::date, interval '1 month') AS m(mes)
        LEFT JOIN atendimento a
          ON a.cobravel = true AND a.cobranca_dispensada = false
         AND a.inicio >= (m.mes AT TIME ZONE 'America/Sao_Paulo')
         AND a.inicio < ((m.mes + interval '1 month') AT TIME ZONE 'America/Sao_Paulo')
       GROUP BY m.mes
       ORDER BY m.mes`;
  }

  /**
   * Total e contagem por status de cada paciente com atendimento no período,
   * arquivados inclusive. Remarcações contam sem somar ao total.
   */
  porPaciente({ inicio, fim }: Intervalo) {
    return this.prisma.$queryRaw<LinhaPorPaciente[]>`
      SELECT p.id, p.nome, p.status::text AS status,
             COALESCE(sum(a.valor) FILTER (
               WHERE a.cobravel = true AND a.cobranca_dispensada = false), 0) AS total,
             count(*) FILTER (WHERE a.status = 'AGENDADO')::int  AS "AGENDADO",
             count(*) FILTER (WHERE a.status = 'REALIZADO')::int AS "REALIZADO",
             count(*) FILTER (WHERE a.status = 'CANCELADO')::int AS "CANCELADO",
             count(*) FILTER (WHERE a.status = 'REMARCADO')::int AS "REMARCADO",
             count(*) FILTER (WHERE a.status = 'FALTA')::int     AS "FALTA"
        FROM atendimento a
        JOIN paciente p ON p.id = a.paciente_id
       WHERE a.inicio >= ${instante(inicio)} AND a.inicio < ${instante(fim)}
       GROUP BY p.id
       ORDER BY total DESC, p.nome, p.id`;
  }
}
