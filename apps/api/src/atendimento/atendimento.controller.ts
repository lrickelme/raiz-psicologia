import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import {
  atendimentoEntradaSchema,
  consultaAtendimentosSchema,
  encerramentoSchema,
  remarcacaoSchema,
  type Atendimento,
  type AtendimentoDados,
  type ConsultaAtendimentos,
  type Encerramento,
  type Remarcacao,
} from "@raiz/shared";
import { Auditado } from "../auditoria/auditado.decorator";
import { ZodValidationPipe } from "../comum/zod-validation.pipe";
import { AtendimentoService } from "./atendimento.service";

/**
 * Não há PATCH: remarcar cria um recurso novo e encerra o antigo (design.md,
 * "Endpoints"). O corpo é validado antes do estado, então encerrar sem motivo
 * responde 422 sem tocar o atendimento.
 */
@Auditado("ATENDIMENTO")
@Controller("atendimentos")
export class AtendimentoController {
  constructor(private readonly atendimentos: AtendimentoService) {}

  @Get()
  listar(
    @Query(new ZodValidationPipe(consultaAtendimentosSchema)) consulta: ConsultaAtendimentos,
  ): Promise<Atendimento[]> {
    return this.atendimentos.listar(consulta);
  }

  @Post()
  criar(
    @Body(new ZodValidationPipe(atendimentoEntradaSchema)) dados: AtendimentoDados,
  ): Promise<Atendimento> {
    return this.atendimentos.criar(dados);
  }

  @Post(":id/realizar")
  @HttpCode(200)
  realizar(@Param("id", ParseUUIDPipe) id: string): Promise<Atendimento> {
    return this.atendimentos.realizar(id);
  }

  @Post(":id/cancelar")
  @HttpCode(200)
  cancelar(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(encerramentoSchema)) { motivo }: Encerramento,
  ): Promise<Atendimento> {
    return this.atendimentos.cancelar(id, motivo);
  }

  @Post(":id/falta")
  @HttpCode(200)
  falta(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(encerramentoSchema)) { motivo }: Encerramento,
  ): Promise<Atendimento> {
    return this.atendimentos.falta(id, motivo);
  }

  /** 201 com o atendimento novo; o original é alcançável por `remarcadoDeId`. */
  @Post(":id/remarcar")
  remarcar(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(remarcacaoSchema)) dados: Remarcacao,
  ): Promise<Atendimento> {
    return this.atendimentos.remarcar(id, dados);
  }
}
