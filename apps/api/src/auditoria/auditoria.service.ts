import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { EventoAuditoria, RecursoAuditado } from "./eventos";

export type RegistroAuditoria = {
  tipoEvento: EventoAuditoria;
  ip: string;
  recursoTipo?: RecursoAuditado;
  recursoId?: string;
  detalhe?: Prisma.InputJsonObject;
};

/**
 * Único ponto de escrita da trilha. Não há método de leitura, alteração nem
 * remoção: a trilha só cresce, e o banco recusa o resto (migration
 * `auditoria`).
 */
@Injectable()
export class AuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  async registrar(registro: RegistroAuditoria): Promise<void> {
    await this.prisma.auditoria.create({ data: registro });
  }
}
