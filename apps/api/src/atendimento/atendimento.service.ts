import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type {
  Atendimento,
  AtendimentoDados,
  ConflitoDeHorario,
  ConsultaAtendimentos,
  Remarcacao,
  StatusAtendimento,
} from "@raiz/shared";
import { encerramento } from "../comum/cobranca/cobranca";
import { dinheiroDaApi, dinheiroParaApi } from "../comum/dinheiro";
import { PrismaService } from "../prisma/prisma.service";
import {
  AtendimentoRepository,
  ehSobreposicao,
  incluirRelacoes,
  type AtendimentoComRelacoes,
} from "./atendimento.repository";

export function paraApi(
  atendimento: AtendimentoComRelacoes,
  { comMotivo }: { comMotivo: boolean },
): Atendimento {
  return {
    id: atendimento.id,
    paciente: atendimento.paciente,
    inicio: atendimento.inicio.toISOString(),
    fim: atendimento.fim.toISOString(),
    status: atendimento.status,
    valor: dinheiroParaApi(atendimento.valor),
    ...(comMotivo && { motivo: atendimento.motivo }),
    remarcadoDeId: atendimento.remarcadoDeId,
    remarcadoParaId: atendimento.remarcadoPara?.id ?? null,
    cobravel: atendimento.cobravel,
    cobrancaDispensada: atendimento.cobrancaDispensada,
    ...(comMotivo && { motivoDispensa: atendimento.motivoDispensa }),
  };
}

/** 422 no formato do ZodValidationPipe, para a interface marcar o campo. */
function campoInvalido(caminho: string, mensagem: string): UnprocessableEntityException {
  return new UnprocessableEntityException({
    error: "Dados inválidos",
    message: mensagem,
    campos: [{ caminho, mensagem }],
  });
}

const ROTULO: Record<StatusAtendimento, string> = {
  AGENDADO: "agendado",
  REALIZADO: "realizado",
  CANCELADO: "cancelado",
  REMARCADO: "remarcado",
  FALTA: "marcado como falta",
};

function jaEncerrado(status: StatusAtendimento): ConflictException {
  return new ConflictException({
    error: "Atendimento encerrado",
    message: `O atendimento já foi ${ROTULO[status]}; só um atendimento agendado pode mudar de situação`,
  });
}

function naoDispensavel(atendimento: AtendimentoComRelacoes): ConflictException {
  const message =
    atendimento.cobravel === null
      ? atendimento.status === "AGENDADO"
        ? "O atendimento ainda está agendado; a cobrança só é decidida no encerramento"
        : "A cobrabilidade deste atendimento ainda não foi decidida"
      : atendimento.cobravel
        ? "A cobrança deste atendimento já foi dispensada"
        : "O atendimento não é cobrável; não há cobrança a dispensar";
  return new ConflictException({ error: "Cobrança não dispensável", message });
}

@Injectable()
export class AtendimentoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repositorio: AtendimentoRepository,
  ) {}

  /** O motivo só vai na consulta por paciente — o histórico que o exibe. */
  async listar(consulta: ConsultaAtendimentos): Promise<Atendimento[]> {
    const atendimentos = await this.repositorio.listar(consulta);
    return atendimentos.map((a) => paraApi(a, { comMotivo: Boolean(consulta.pacienteId) }));
  }

  async obter(id: string): Promise<Atendimento> {
    return paraApi(await this.existente(id), { comMotivo: true });
  }

  async criar({ pacienteId, inicio, fim, valor }: AtendimentoDados): Promise<Atendimento> {
    const paciente = await this.prisma.paciente.findUnique({ where: { id: pacienteId } });
    if (!paciente) throw campoInvalido("pacienteId", "Paciente não encontrado");
    if (paciente.status !== "ATIVO") {
      throw campoInvalido("pacienteId", "Paciente arquivado não recebe novos agendamentos");
    }

    const intervalo = { inicio: new Date(inicio), fim: new Date(fim) };
    try {
      const criado = await this.prisma.atendimento.create({
        data: {
          pacienteId,
          ...intervalo,
          // Congelado aqui: reajuste posterior do paciente não retroage.
          valor: valor ? dinheiroDaApi(valor) : paciente.valorConsultaPadrao,
        },
        include: incluirRelacoes,
      });
      return paraApi(criado, { comMotivo: true });
    } catch (erro) {
      if (ehSobreposicao(erro)) throw await this.conflito(intervalo.inicio, intervalo.fim);
      throw erro;
    }
  }

  async realizar(id: string): Promise<Atendimento> {
    const atendimento = await this.agendado(id);
    if (atendimento.fim > new Date()) {
      throw new UnprocessableEntityException({
        error: "Atendimento em andamento",
        message: "Só é possível marcar como realizado depois do horário de término",
      });
    }
    return this.transicionar(id, encerramento(atendimento.inicio, "REALIZADO"));
  }

  async cancelar(id: string, motivo: string): Promise<Atendimento> {
    const atendimento = await this.agendado(id);
    return this.transicionar(id, { ...encerramento(atendimento.inicio, "CANCELADO"), motivo });
  }

  async falta(id: string, motivo: string): Promise<Atendimento> {
    const atendimento = await this.agendado(id);
    if (atendimento.inicio > new Date()) {
      throw new UnprocessableEntityException({
        error: "Atendimento ainda não começou",
        message: "Só é possível registrar falta depois do horário de início",
      });
    }
    return this.transicionar(id, { ...encerramento(atendimento.inicio, "FALTA"), motivo });
  }

  /**
   * Encerra o original como REMARCADO e cria o substituto, numa transação só
   * (design.md, "Remarcação encadeada"). O substituto herda paciente, duração e
   * valor congelado. Se o novo horário colidir, nada muda.
   */
  async remarcar(id: string, { inicio, fim, motivo }: Remarcacao): Promise<Atendimento> {
    const original = await this.agendado(id);
    const duracaoMs = original.fim.getTime() - original.inicio.getTime();
    const novoInicio = new Date(inicio);
    const novoFim = new Date(novoInicio.getTime() + duracaoMs);
    if (fim && Date.parse(fim) !== novoFim.getTime()) {
      throw campoInvalido("fim", "A remarcação preserva a duração do atendimento original");
    }

    try {
      const novo = await this.prisma.$transaction(async (tx) => {
        const { count } = await tx.atendimento.updateMany({
          where: { id, status: "AGENDADO" },
          data: { ...encerramento(original.inicio, "REMARCADO"), motivo },
        });
        // Outra requisição encerrou o original entre a leitura e aqui.
        if (!count) throw jaEncerrado((await this.existente(id)).status);

        return tx.atendimento.create({
          data: {
            pacienteId: original.pacienteId,
            inicio: novoInicio,
            fim: novoFim,
            valor: original.valor,
            remarcadoDeId: id,
          },
          include: incluirRelacoes,
        });
      });
      return paraApi(novo, { comMotivo: true });
    } catch (erro) {
      if (ehSobreposicao(erro)) throw await this.conflito(novoInicio, novoFim, id);
      throw erro;
    }
  }

  /**
   * Tira da receita um atendimento cobrável, sem apagar a cobrabilidade
   * (design.md, "Dispensa não apaga a cobrabilidade"). A condição no UPDATE
   * recusa o que não é cobrável, ainda não decidido ou já dispensado.
   */
  async dispensarCobranca(id: string, motivo: string): Promise<Atendimento> {
    const { count } = await this.prisma.atendimento.updateMany({
      where: { id, cobravel: true, cobrancaDispensada: false },
      data: { cobrancaDispensada: true, motivoDispensa: motivo },
    });
    const atual = await this.existente(id);
    if (!count) throw naoDispensavel(atual);
    return paraApi(atual, { comMotivo: true });
  }

  /**
   * Devolve à receita. O motivo fica na coluna como o da última dispensa:
   * apagá-lo seria edição destrutiva. Dispensa e reversão ficam na trilha,
   * sem o texto — `detalhe` não é cifrado.
   */
  async reverterDispensa(id: string): Promise<Atendimento> {
    const { count } = await this.prisma.atendimento.updateMany({
      where: { id, cobrancaDispensada: true },
      data: { cobrancaDispensada: false },
    });
    const atual = await this.existente(id);
    if (!count) {
      throw new ConflictException({
        error: "Cobrança não dispensada",
        message: "Não há dispensa de cobrança a reverter neste atendimento",
      });
    }
    return paraApi(atual, { comMotivo: true });
  }

  /**
   * Muda o status só se ele ainda for AGENDADO: a condição no UPDATE fecha a
   * corrida entre duas transições simultâneas do mesmo atendimento. O
   * instante do encerramento e a cobrabilidade vão no mesmo UPDATE.
   */
  private async transicionar(
    id: string,
    dados: Prisma.AtendimentoUpdateManyMutationInput,
  ): Promise<Atendimento> {
    const { count } = await this.prisma.atendimento.updateMany({
      where: { id, status: "AGENDADO" },
      data: dados,
    });
    const atual = await this.existente(id);
    if (!count) throw jaEncerrado(atual.status);
    return paraApi(atual, { comMotivo: true });
  }

  private async agendado(id: string): Promise<AtendimentoComRelacoes> {
    const atendimento = await this.existente(id);
    if (atendimento.status !== "AGENDADO") throw jaEncerrado(atendimento.status);
    return atendimento;
  }

  private async existente(id: string): Promise<AtendimentoComRelacoes> {
    const atendimento = await this.repositorio.obter(id);
    if (!atendimento) {
      throw new NotFoundException({
        error: "Atendimento não encontrado",
        message: "Nenhum atendimento com esse identificador",
      });
    }
    return atendimento;
  }

  /**
   * 409 com o atendimento conflitante e o próximo horário livre de mesma
   * duração a partir do pedido (spec agenda, "Conflito de horário").
   */
  private async conflito(inicio: Date, fim: Date, excetoId?: string): Promise<ConflictException> {
    const duracaoMs = fim.getTime() - inicio.getTime();
    const [primeiro] = await this.repositorio.ocupando(inicio, fim, excetoId);

    let livre = inicio;
    // Empurra o início para o fim de cada bloqueio até sobrar uma janela.
    for (let tentativas = 0; tentativas < 100; tentativas++) {
      const fimLivre = new Date(livre.getTime() + duracaoMs);
      const [bloqueio] = await this.repositorio.ocupando(livre, fimLivre, excetoId);
      if (!bloqueio) break;
      livre = bloqueio.fim;
    }

    const corpo: ConflitoDeHorario = {
      conflitante: primeiro && {
        id: primeiro.id,
        inicio: primeiro.inicio.toISOString(),
        fim: primeiro.fim.toISOString(),
        paciente: primeiro.paciente.nome,
      },
      proximoHorarioLivre: {
        inicio: livre.toISOString(),
        fim: new Date(livre.getTime() + duracaoMs).toISOString(),
      },
    };
    return new ConflictException({
      error: "Conflito de horário",
      message: "Já existe atendimento nesse horário",
      ...corpo,
    });
  }
}
