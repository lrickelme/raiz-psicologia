import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { ChaveRascunho, RascunhoDados, RascunhoEvolucao, RascunhoSalvo } from "@raiz/shared";
import { PrismaService } from "../prisma/prisma.service";
import { ProntuarioService } from "./prontuario.service";

function onde({ pacienteId, atendimentoId }: ChaveRascunho) {
  return { pacienteId, atendimentoId: atendimentoId ?? null };
}

/** Outro salvamento criou (P2002) ou a gravação da evolução apagou (P2025) o rascunho no meio. */
function corrida(erro: unknown): boolean {
  return (
    erro instanceof Prisma.PrismaClientKnownRequestError &&
    (erro.code === "P2002" || erro.code === "P2025")
  );
}

/**
 * Texto em edição guardado no servidor, cifrado pela mesma extensão da
 * evolução (design.md, "Rascunho no servidor, nunca no navegador"). Não é
 * registro clínico: é sobrescrito a cada salvamento e apagado quando a
 * evolução é gravada ou quando a profissional o descarta.
 */
@Injectable()
export class RascunhoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly prontuario: ProntuarioService,
  ) {}

  /**
   * Upsert pela chave (paciente, atendimento). Não usa `upsert` do Prisma: ele
   * não aceita `null` na chave composta, e o rascunho avulso tem
   * `atendimentoId` nulo. A unicidade do banco (`NULLS NOT DISTINCT`) decide
   * a corrida entre dois primeiros salvamentos; o perdedor tenta de novo.
   */
  async salvar({ texto, ...chave }: RascunhoDados): Promise<RascunhoSalvo> {
    await this.prontuario.validarDestino(chave);
    const where = onde(chave);
    const select = { id: true, atualizadoEm: true } as const;

    for (let tentativa = 0; ; tentativa++) {
      try {
        const existente = await this.prisma.rascunhoEvolucao.findFirst({ where, select });
        const salvo = existente
          ? await this.prisma.rascunhoEvolucao.update({
              where: { id: existente.id },
              data: { texto },
              select,
            })
          : await this.prisma.rascunhoEvolucao.create({ data: { ...where, texto }, select });
        return { id: salvo.id, atualizadoEm: salvo.atualizadoEm.toISOString() };
      } catch (erro) {
        if (tentativa === 0 && corrida(erro)) continue;
        throw erro;
      }
    }
  }

  async obter(chave: ChaveRascunho): Promise<RascunhoEvolucao | null> {
    const rascunho = await this.prisma.rascunhoEvolucao.findFirst({ where: onde(chave) });
    return (
      rascunho && {
        id: rascunho.id,
        pacienteId: rascunho.pacienteId,
        atendimentoId: rascunho.atendimentoId,
        texto: rascunho.texto,
        atualizadoEm: rascunho.atualizadoEm.toISOString(),
      }
    );
  }

  async descartar(chave: ChaveRascunho): Promise<void> {
    await this.prisma.rascunhoEvolucao.deleteMany({ where: onde(chave) });
  }
}
