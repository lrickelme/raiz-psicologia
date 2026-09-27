import { Body, Controller, Delete, Get, HttpCode, Put, Query, Res } from "@nestjs/common";
import type { FastifyReply } from "fastify";
import {
  chaveRascunhoSchema,
  rascunhoEntradaSchema,
  type ChaveRascunho,
  type RascunhoDados,
  type RascunhoEvolucao,
  type RascunhoSalvo,
} from "@raiz/shared";
import { Auditado } from "../auditoria/auditado.decorator";
import { ZodValidationPipe } from "../comum/zod-validation.pipe";
import { RascunhoService } from "./rascunho.service";

/**
 * `@Auditado` só em leitura e descarte. O `PUT` chega a cada pausa de
 * digitação e grava o texto da própria profissional; auditá-lo encheria a
 * trilha de registros sem valor de evidência. A evolução gravada é auditada.
 */
@Controller("prontuario/rascunho")
export class RascunhoController {
  constructor(private readonly rascunhos: RascunhoService) {}

  @Put()
  salvar(
    @Body(new ZodValidationPipe(rascunhoEntradaSchema)) dados: RascunhoDados,
  ): Promise<RascunhoSalvo> {
    return this.rascunhos.salvar(dados);
  }

  /** 204 quando não há rascunho: ausência é o caso comum, não erro. */
  @Auditado("RASCUNHO_EVOLUCAO")
  @Get()
  async obter(
    @Query(new ZodValidationPipe(chaveRascunhoSchema)) chave: ChaveRascunho,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<RascunhoEvolucao | undefined> {
    const rascunho = await this.rascunhos.obter(chave);
    if (!rascunho) reply.status(204);
    return rascunho ?? undefined;
  }

  @Auditado("RASCUNHO_EVOLUCAO")
  @Delete()
  @HttpCode(204)
  descartar(
    @Query(new ZodValidationPipe(chaveRascunhoSchema)) chave: ChaveRascunho,
  ): Promise<void> {
    return this.rascunhos.descartar(chave);
  }
}
