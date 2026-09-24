import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Paciente as PacienteDb, Prisma } from "@prisma/client";
import type {
  Arquivamento,
  AtendimentosPendentes,
  ListagemPacientes,
  Pagina,
  Paciente,
  PacienteAlteracao,
  PacienteDados,
} from "@raiz/shared";
import { AuditoriaService } from "../auditoria/auditoria.service";
import { EventoAuditoria } from "../auditoria/eventos";
import { dinheiroDaApi, dinheiroParaApi } from "../comum/dinheiro";
import { PrismaService } from "../prisma/prisma.service";
import { PacienteRepository } from "./paciente.repository";

/** Registro do banco no formato da API: dinheiro em string, datas em ISO. */
export function paraApi(paciente: PacienteDb): Paciente {
  return {
    id: paciente.id,
    nome: paciente.nome,
    telefone: paciente.telefone,
    email: paciente.email,
    nascimento: paciente.nascimento?.toISOString().slice(0, 10) ?? null,
    valorConsultaPadrao: dinheiroParaApi(paciente.valorConsultaPadrao),
    observacoes: paciente.observacoes,
    status: paciente.status,
    criadoEm: paciente.criadoEm.toISOString(),
    atualizadoEm: paciente.atualizadoEm.toISOString(),
  };
}

/** Converte a entrada validada nos tipos do Prisma; `undefined` não altera. */
function paraBanco(dados: PacienteAlteracao): Prisma.PacienteUpdateInput {
  const { nascimento, valorConsultaPadrao, ...resto } = dados;
  return {
    ...resto,
    ...(nascimento !== undefined && {
      nascimento: nascimento === null ? null : new Date(`${nascimento}T00:00:00Z`),
    }),
    ...(valorConsultaPadrao !== undefined && {
      valorConsultaPadrao: dinheiroDaApi(valorConsultaPadrao),
    }),
  };
}

const NAO_ENCONTRADO = {
  error: "Paciente não encontrado",
  message: "Nenhum paciente com esse identificador",
};

@Injectable()
export class PacienteService {
  constructor(
    private readonly repositorio: PacienteRepository,
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(filtro: ListagemPacientes): Promise<Pagina<Paciente>> {
    const { itens, total } = await this.repositorio.listar(filtro);
    return { itens: itens.map(paraApi), total, page: filtro.page, size: filtro.size };
  }

  async obter(id: string): Promise<Paciente> {
    return paraApi(await this.existente(id));
  }

  async criar(dados: PacienteDados): Promise<Paciente> {
    return paraApi(
      await this.repositorio.criar(paraBanco(dados) as Prisma.PacienteCreateInput),
    );
  }

  async alterar(id: string, dados: PacienteAlteracao): Promise<Paciente> {
    await this.existente(id);
    return paraApi(await this.repositorio.alterar(id, paraBanco(dados)));
  }

  /**
   * Tira o paciente da listagem padrão e das opções de agendamento; perfil e
   * histórico continuam acessíveis. Com atendimentos futuros, exige
   * confirmação: sem `motivoCancelamento`, responde 409 listando-os; com ele,
   * cancela todos e arquiva, numa transação só (spec pacientes).
   *
   * A escrita do motivo em cada atendimento entra na trilha aqui: ela acontece
   * numa rota de paciente, e o interceptor só registraria o paciente.
   */
  async arquivar(id: string, { motivoCancelamento }: Arquivamento, ip: string): Promise<Paciente> {
    await this.existente(id);

    const { paciente, cancelados } = await this.prisma.$transaction(async (tx) => {
      const pendentes = await tx.atendimento.findMany({
        where: { pacienteId: id, status: "AGENDADO", inicio: { gt: new Date() } },
        select: { id: true, inicio: true, fim: true },
        orderBy: { inicio: "asc" },
      });
      if (pendentes.length && !motivoCancelamento) {
        const corpo: AtendimentosPendentes = {
          pendentes: pendentes.map((a) => ({
            id: a.id,
            inicio: a.inicio.toISOString(),
            fim: a.fim.toISOString(),
          })),
        };
        throw new ConflictException({
          error: "Atendimentos futuros",
          message: "O paciente tem atendimentos agendados; confirme o cancelamento informando o motivo",
          ...corpo,
        });
      }

      const ids = pendentes.map((a) => a.id);
      if (ids.length) {
        await tx.atendimento.updateMany({
          where: { id: { in: ids }, status: "AGENDADO" },
          data: { status: "CANCELADO", motivo: motivoCancelamento },
        });
      }
      const arquivado = await tx.paciente.update({
        where: { id },
        data: { status: "ARQUIVADO" },
      });
      return { paciente: arquivado, cancelados: ids };
    });

    for (const atendimentoId of cancelados) {
      await this.auditoria.registrar({
        tipoEvento: EventoAuditoria.ESCRITA,
        ip,
        recursoTipo: "ATENDIMENTO",
        recursoId: atendimentoId,
        detalhe: { operacao: "cancelamento por arquivamento do paciente", pacienteId: id },
      });
    }
    return paraApi(paciente);
  }

  /** O valor de consulta não é tocado: reativar preserva o anterior (spec). */
  async reativar(id: string): Promise<Paciente> {
    await this.existente(id);
    return paraApi(await this.repositorio.alterar(id, { status: "ATIVO" }));
  }

  private async existente(id: string): Promise<PacienteDb> {
    const paciente = await this.repositorio.obter(id);
    if (!paciente) throw new NotFoundException(NAO_ENCONTRADO);
    return paciente;
  }
}
