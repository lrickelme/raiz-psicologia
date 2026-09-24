import { Injectable } from "@nestjs/common";
import { Prisma, type Paciente } from "@prisma/client";
import type { ListagemPacientes } from "@raiz/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PacienteRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Busca paginada. A condição fica em SQL porque usa as funções indexadas da
   * migration `paciente` (`raiz_normalizar`, `raiz_digitos`), que o Prisma não
   * sabe expressar; o SQL devolve só os ids da página, e os registros vêm pelo
   * Prisma para que o `Decimal` e as datas cheguem já tipados.
   */
  async listar({ busca, status, page, size }: ListagemPacientes): Promise<{
    itens: Paciente[];
    total: number;
  }> {
    const condicoes: Prisma.Sql[] = [];
    if (status !== "TODOS") {
      condicoes.push(Prisma.sql`status = ${status}::"StatusPaciente"`);
    }
    if (busca) {
      const digitos = busca.replace(/\D/g, "");
      condicoes.push(
        digitos
          ? Prisma.sql`(raiz_normalizar(nome) LIKE '%' || raiz_normalizar(${busca}) || '%'
               OR raiz_digitos(telefone) LIKE '%' || ${digitos} || '%')`
          : Prisma.sql`raiz_normalizar(nome) LIKE '%' || raiz_normalizar(${busca}) || '%'`,
      );
    }
    const where = condicoes.length
      ? Prisma.sql`WHERE ${Prisma.join(condicoes, " AND ")}`
      : Prisma.empty;

    const linhas = await this.prisma.$queryRaw<{ id: string; total: bigint }[]>`
      SELECT id, count(*) OVER () AS total
      FROM paciente
      ${where}
      ORDER BY raiz_normalizar(nome), id
      LIMIT ${size} OFFSET ${(page - 1) * size}`;

    const ids = linhas.map((linha) => linha.id);
    const registros = await this.prisma.paciente.findMany({ where: { id: { in: ids } } });
    const porId = new Map(registros.map((registro) => [registro.id, registro]));

    return {
      itens: ids.map((id) => porId.get(id)!),
      // Página além do fim não traz linha nenhuma, nem o total: recontar.
      total: linhas.length
        ? Number(linhas[0].total)
        : page > 1
          ? await this.contar(where)
          : 0,
    };
  }

  private async contar(where: Prisma.Sql): Promise<number> {
    const [{ total }] = await this.prisma.$queryRaw<{ total: bigint }[]>`
      SELECT count(*) AS total FROM paciente ${where}`;
    return Number(total);
  }

  obter(id: string): Promise<Paciente | null> {
    return this.prisma.paciente.findUnique({ where: { id } });
  }

  criar(dados: Prisma.PacienteCreateInput): Promise<Paciente> {
    return this.prisma.paciente.create({ data: dados });
  }

  alterar(id: string, dados: Prisma.PacienteUpdateInput): Promise<Paciente> {
    return this.prisma.paciente.update({ where: { id }, data: dados });
  }
}
