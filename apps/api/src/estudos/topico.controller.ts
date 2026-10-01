import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from "@nestjs/common";
import {
  historicoConcluidosSchema,
  topicoAlteracaoSchema,
  topicoEntradaSchema,
  transicaoTopicoSchema,
  type HistoricoConcluidos,
  type PaginaConcluidos,
  type QuadroEstudos,
  type Topico,
  type TopicoAlteracao,
  type TopicoDados,
  type TransicaoTopico,
} from "@raiz/shared";
import { ZodValidationPipe } from "../comum/zod-validation.pipe";
import { TopicoService } from "./topico.service";

/**
 * Sem `@Auditado`: estudos não é dado de paciente (design.md da 04). Não há
 * DELETE: tópico não é excluído (spec estudos).
 */
@Controller()
export class TopicoController {
  constructor(private readonly topicos: TopicoService) {}

  @Get("estudos/quadro")
  quadro(): Promise<QuadroEstudos> {
    return this.topicos.quadro();
  }

  @Get("topicos/concluidos")
  historico(
    @Query(new ZodValidationPipe(historicoConcluidosSchema)) consulta: HistoricoConcluidos,
  ): Promise<PaginaConcluidos> {
    return this.topicos.historico(consulta);
  }

  @Post("topicos")
  criar(@Body(new ZodValidationPipe(topicoEntradaSchema)) dados: TopicoDados): Promise<Topico> {
    return this.topicos.criar(dados);
  }

  @Patch("topicos/:id")
  alterar(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(topicoAlteracaoSchema)) dados: TopicoAlteracao,
  ): Promise<Topico> {
    return this.topicos.alterar(id, dados);
  }

  @Post("topicos/:id/mover")
  @HttpCode(200)
  mover(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(transicaoTopicoSchema)) dados: TransicaoTopico,
  ): Promise<Topico> {
    return this.topicos.mover(id, dados);
  }
}
