import { createHash, randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { SESSAO_INATIVIDADE_MS } from "./auth.constantes";

export type SessaoComUsuario = Prisma.SessaoGetPayload<{
  include: { usuario: true };
}>;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function novaExpiracao(): Date {
  return new Date(Date.now() + SESSAO_INATIVIDADE_MS);
}

@Injectable()
export class SessaoStore {
  constructor(private readonly prisma: PrismaService) {}

  /** Cria a sessão e devolve o token em claro, que vai só para o cookie. */
  async criar(usuarioId: string): Promise<string> {
    const token = randomBytes(32).toString("base64url");
    await this.prisma.sessao.create({
      data: { usuarioId, tokenHash: hashToken(token), expiraEm: novaExpiracao() },
    });
    return token;
  }

  /**
   * Devolve a sessão já renovada, ou `null` se o token é desconhecido ou
   * expirou — nesse caso o registro é removido, como pede a spec.
   */
  async validarERenovar(token: string): Promise<SessaoComUsuario | null> {
    const sessao = await this.prisma.sessao.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { usuario: true },
    });
    if (!sessao) return null;

    if (sessao.expiraEm <= new Date()) {
      await this.prisma.sessao.deleteMany({ where: { id: sessao.id } });
      return null;
    }

    return this.prisma.sessao.update({
      where: { id: sessao.id },
      data: { expiraEm: novaExpiracao() },
      include: { usuario: true },
    });
  }

  async destruir(token: string): Promise<void> {
    await this.prisma.sessao.deleteMany({
      where: { tokenHash: hashToken(token) },
    });
  }

  async limparExpiradas(): Promise<void> {
    await this.prisma.sessao.deleteMany({
      where: { expiraEm: { lte: new Date() } },
    });
  }
}
