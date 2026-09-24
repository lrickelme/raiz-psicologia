import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import {
  arquivamentoSchema,
  listagemPacientesSchema,
  pacienteAlteracaoSchema,
  pacienteEntradaSchema,
  type Arquivamento,
  type ListagemPacientes,
  type Pagina,
  type Paciente,
  type PacienteAlteracao,
  type PacienteDados,
} from "@raiz/shared";
import { Auditado } from "../auditoria/auditado.decorator";
import { ZodValidationPipe } from "../comum/zod-validation.pipe";
import { PacienteService } from "./paciente.service";

/** Não há DELETE: paciente só é arquivado (spec pacientes). */
@Auditado("PACIENTE")
@Controller("pacientes")
export class PacienteController {
  constructor(private readonly pacientes: PacienteService) {}

  @Get()
  listar(
    @Query(new ZodValidationPipe(listagemPacientesSchema)) filtro: ListagemPacientes,
  ): Promise<Pagina<Paciente>> {
    return this.pacientes.listar(filtro);
  }

  @Post()
  criar(
    @Body(new ZodValidationPipe(pacienteEntradaSchema)) dados: PacienteDados,
  ): Promise<Paciente> {
    return this.pacientes.criar(dados);
  }

  @Get(":id")
  obter(@Param("id", ParseUUIDPipe) id: string): Promise<Paciente> {
    return this.pacientes.obter(id);
  }

  @Patch(":id")
  alterar(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(pacienteAlteracaoSchema)) dados: PacienteAlteracao,
  ): Promise<Paciente> {
    return this.pacientes.alterar(id, dados);
  }

  @Post(":id/arquivar")
  @HttpCode(200)
  arquivar(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(arquivamentoSchema)) dados: Arquivamento,
    @Req() request: FastifyRequest,
  ): Promise<Paciente> {
    return this.pacientes.arquivar(id, dados, request.ip);
  }

  @Post(":id/reativar")
  @HttpCode(200)
  reativar(@Param("id", ParseUUIDPipe) id: string): Promise<Paciente> {
    return this.pacientes.reativar(id);
  }
}
