import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import type {
  ChaveRascunho,
  Evolucao,
  EvolucaoDados,
  EvolucaoListada,
  EvolucaoResumo,
  ResumoProntuario,
  Retificacao,
} from "@raiz/shared";
import { hojeLocal } from "@raiz/shared";
import { AuditoriaService } from "../auditoria/auditoria.service";
import { GUARDA_PRONTUARIO_ANOS } from "../comum/config";
import { dataDeElegibilidade } from "../comum/guarda/guarda";
import { EventoAuditoria } from "../auditoria/eventos";
import { PrismaService } from "../prisma/prisma.service";
import {
  ProntuarioRepository,
  selecaoResumo,
  type EvolucaoResumoDb,
} from "./prontuario.repository";

function paraApi(evolucao: EvolucaoResumoDb): EvolucaoResumo {
  return {
    id: evolucao.id,
    pacienteId: evolucao.pacienteId,
    atendimentoId: evolucao.atendimentoId,
    registradoEm: evolucao.registradoEm.toISOString(),
    retificaDeId: evolucao.retificaDeId,
    vigente: evolucao.vigente,
  };
}

const PACIENTE_NAO_ENCONTRADO = {
  error: "Paciente não encontrado",
  message: "Nenhum paciente com esse identificador",
};

const EVOLUCAO_NAO_ENCONTRADA = {
  error: "Evolução não encontrada",
  message: "Nenhuma evolução com esse identificador",
};

const PACIENTE_ARQUIVADO = {
  error: "Paciente arquivado",
  message: "Paciente arquivado não recebe nova evolução; reative-o para registrar",
};

function jaRetificada(): ConflictException {
  return new ConflictException({
    error: "Evolução já retificada",
    message: "Só a versão vigente pode ser retificada; abra o histórico para ver a atual",
  });
}

function atendimentoInvalido(mensagem: string): UnprocessableEntityException {
  return new UnprocessableEntityException({
    error: "Dados inválidos",
    message: mensagem,
    campos: [{ caminho: "atendimentoId", mensagem }],
  });
}

@Injectable()
export class ProntuarioService {
  constructor(
    private readonly repositorio: ProntuarioRepository,
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Lista sem texto e registra um `EVOLUCAO_LISTADA` com a quantidade. O
   * texto de cada uma é pedido à parte, quando a profissional o abre.
   */
  async listar(pacienteId: string, ip: string): Promise<EvolucaoListada[]> {
    await this.paciente(pacienteId);
    const versoes = await this.repositorio.listarVersoes(pacienteId);
    const porId = new Map(versoes.map((v) => [v.id, v]));
    const original = (versao: EvolucaoResumoDb): EvolucaoResumoDb => {
      let atual = versao;
      while (atual.retificaDeId) atual = porId.get(atual.retificaDeId)!;
      return atual;
    };
    // Só as pontas das cadeias; versões retificadas ficam no histórico.
    const evolucoes = versoes
      .filter((v) => v.vigente)
      .map((v) => ({ ...paraApi(v), originalmenteEm: original(v).registradoEm.toISOString() }))
      .sort(
        (a, b) =>
          b.originalmenteEm.localeCompare(a.originalmenteEm) || b.id.localeCompare(a.id),
      );
    await this.auditoria.registrar({
      tipoEvento: EventoAuditoria.EVOLUCAO_LISTADA,
      ip,
      recursoTipo: "PACIENTE",
      recursoId: pacienteId,
      detalhe: { quantidade: evolucoes.length },
    });
    return evolucoes;
  }

  /**
   * Contagem e data da evolução mais recente, e, para paciente arquivado, a
   * data de elegibilidade para descarte com o prazo que a originou. Nenhum
   * texto é lido. A data é calculada a cada consulta, nunca persistida: ela
   * depende de um prazo configurável (design.md, "Modelo de dados").
   *
   * Último registro é o mais recente entre as versões de evolução e os
   * atendimentos realizados ou com falta; sem nenhum deles, o cadastro.
   */
  async resumo(pacienteId: string): Promise<ResumoProntuario> {
    const paciente = await this.prisma.paciente.findUnique({
      where: { id: pacienteId },
      select: { status: true, nascimento: true, criadoEm: true },
    });
    if (!paciente) throw new NotFoundException(PACIENTE_NAO_ENCONTRADO);

    const [evolucoes, ultimaVigente, ultimaVersao, ultimoAtendimento] = await Promise.all([
      this.prisma.evolucao.count({ where: { pacienteId, vigente: true } }),
      this.prisma.evolucao.findFirst({
        where: { pacienteId, vigente: true },
        orderBy: { registradoEm: "desc" },
        select: { registradoEm: true },
      }),
      this.prisma.evolucao.aggregate({ where: { pacienteId }, _max: { registradoEm: true } }),
      this.prisma.atendimento.aggregate({
        where: { pacienteId, status: { in: ["REALIZADO", "FALTA"] } },
        _max: { inicio: true },
      }),
    ]);

    let guarda: ResumoProntuario["guarda"] = null;
    if (paciente.status === "ARQUIVADO") {
      const candidatos = [ultimaVersao._max.registradoEm, ultimoAtendimento._max.inicio].filter(
        (data): data is Date => data !== null,
      );
      const ultimoRegistro = candidatos.length
        ? new Date(Math.max(...candidatos.map((d) => d.getTime())))
        : paciente.criadoEm;
      const elegivelEm = dataDeElegibilidade(
        ultimoRegistro,
        paciente.nascimento,
        GUARDA_PRONTUARIO_ANOS,
      );
      guarda = {
        prazoAnos: GUARDA_PRONTUARIO_ANOS,
        ultimoRegistroEm: ultimoRegistro.toISOString(),
        elegivelEm,
        elegivel: elegivelEm <= hojeLocal(),
      };
    }

    return {
      evolucoes,
      ultimaEvolucaoEm: ultimaVigente?.registradoEm.toISOString() ?? null,
      guarda,
    };
  }

  /**
   * Data e hora vêm do banco (`registrado_em DEFAULT now()`). A resposta não
   * traz o texto: devolvê-lo decifraria o que acabou de ser escrito e poria
   * na trilha uma leitura que não aconteceu. O rascunho correspondente é
   * apagado na mesma transação: gravada a evolução, ele não reaparece.
   */
  async criar(pacienteId: string, { texto, atendimentoId }: EvolucaoDados): Promise<EvolucaoResumo> {
    const chave = { pacienteId, atendimentoId: atendimentoId ?? null };
    await this.validarDestino(chave);

    const criada = await this.prisma.$transaction(async (tx) => {
      const evolucao = await tx.evolucao.create({
        data: { ...chave, texto },
        select: selecaoResumo,
      });
      await tx.rascunhoEvolucao.deleteMany({ where: chave });
      return evolucao;
    });
    return paraApi(criada);
  }

  /**
   * Onde uma evolução (ou o rascunho dela) pode ser escrita: paciente ativo e,
   * se houver atendimento, um `REALIZADO` do mesmo paciente.
   */
  async validarDestino({ pacienteId, atendimentoId }: ChaveRascunho): Promise<void> {
    const paciente = await this.paciente(pacienteId);
    if (paciente.status !== "ATIVO") throw new ConflictException(PACIENTE_ARQUIVADO);
    if (!atendimentoId) return;

    const atendimento = await this.prisma.atendimento.findUnique({
      where: { id: atendimentoId },
      select: { pacienteId: true, status: true },
    });
    if (!atendimento || atendimento.pacienteId !== pacienteId) {
      throw atendimentoInvalido("Atendimento não encontrado para este paciente");
    }
    if (atendimento.status !== "REALIZADO") {
      throw atendimentoInvalido("Só atendimento realizado recebe evolução");
    }
  }

  async abrir(id: string): Promise<Evolucao> {
    const evolucao = await this.repositorio.abrir(id);
    if (!evolucao) throw new NotFoundException(EVOLUCAO_NAO_ENCONTRADA);
    return { ...paraApi(evolucao), texto: evolucao.texto };
  }

  /**
   * Encerra a versão vigente e cria a nova apontando para ela, numa transação
   * (design.md, "Retificação encadeada, igual à remarcação"). O UPDATE só
   * acontece se a versão ainda for vigente: duas retificações simultâneas não
   * produzem dois sucessores. A anterior não é tocada em mais nada — o banco
   * recusa qualquer outra alteração.
   */
  async retificar(id: string, { texto }: Retificacao): Promise<EvolucaoResumo> {
    const anterior = await this.prisma.evolucao.findUnique({
      where: { id },
      select: { pacienteId: true, atendimentoId: true, vigente: true },
    });
    if (!anterior) throw new NotFoundException(EVOLUCAO_NAO_ENCONTRADA);
    if (!anterior.vigente) throw jaRetificada();
    const paciente = await this.paciente(anterior.pacienteId);
    if (paciente.status !== "ATIVO") throw new ConflictException(PACIENTE_ARQUIVADO);

    const nova = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.evolucao.updateMany({
        where: { id, vigente: true },
        data: { vigente: false },
      });
      if (!count) throw jaRetificada();

      return tx.evolucao.create({
        data: {
          pacienteId: anterior.pacienteId,
          atendimentoId: anterior.atendimentoId,
          texto,
          retificaDeId: id,
        },
        select: selecaoResumo,
      });
    });
    return paraApi(nova);
  }

  /**
   * Todas as versões da cadeia que contém `id`, da original à vigente, com
   * texto — cada uma entra na trilha como `EVOLUCAO_LIDA`.
   */
  async historico(id: string): Promise<Evolucao[]> {
    const ids = await this.repositorio.cadeia(id);
    if (!ids.length) throw new NotFoundException(EVOLUCAO_NAO_ENCONTRADA);

    const versoes = new Map(
      (await this.repositorio.abrirVarias(ids)).map((versao) => [versao.id, versao]),
    );
    return ids.map((versaoId) => {
      const versao = versoes.get(versaoId)!;
      return { ...paraApi(versao), texto: versao.texto };
    });
  }

  private async paciente(id: string) {
    const paciente = await this.prisma.paciente.findUnique({
      where: { id },
      select: { status: true },
    });
    if (!paciente) throw new NotFoundException(PACIENTE_NAO_ENCONTRADO);
    return paciente;
  }
}
