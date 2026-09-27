import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  StreamableFile,
} from "@nestjs/common";
import type { FastifyReply } from "fastify";
import type { FastifyRequest } from "fastify";
import {
  evolucaoEntradaSchema,
  retificacaoSchema,
  type Evolucao,
  type EvolucaoDados,
  type EvolucaoListada,
  type EvolucaoResumo,
  type ResumoProntuario,
  type Retificacao,
} from "@raiz/shared";
import { Auditado } from "../auditoria/auditado.decorator";
import type { SessaoComUsuario } from "../auth/sessao.store";
import { SessaoDaRequisicao } from "../auth/requisicao-autenticada";
import { ZodValidationPipe } from "../comum/zod-validation.pipe";
import { ExportacaoService } from "./pdf/exportacao.service";
import { ProntuarioService } from "./prontuario.service";

/**
 * Leituras não levam `@Auditado`: o acesso por rota diria só "a lista foi
 * aberta" ou "algo foi lido", e a trilha aqui é por evolução —
 * `EVOLUCAO_LISTADA` no serviço, `EVOLUCAO_LIDA` na decifragem. A escrita
 * leva, com o parâmetro chamado `pacienteId` para que o interceptor registre
 * o id da evolução criada, e não o do paciente. Na retificação, `:id` é a
 * versão anterior e o interceptor registra também a nova (`criadoId`).
 *
 * Não há PATCH nem DELETE em `/evolucoes/:id` (design.md): a ausência é a
 * garantia, e o banco recusa as duas operações de qualquer forma.
 */
@Controller()
export class ProntuarioController {
  constructor(
    private readonly prontuario: ProntuarioService,
    private readonly exportacao: ExportacaoService,
  ) {}

  @Get("pacientes/:pacienteId/evolucoes")
  listar(
    @Param("pacienteId", ParseUUIDPipe) pacienteId: string,
    @Req() request: FastifyRequest,
  ): Promise<EvolucaoListada[]> {
    return this.prontuario.listar(pacienteId, request.ip);
  }

  /**
   * Metadados do prontuário para o perfil: contagem, data mais recente e,
   * para arquivado, a elegibilidade. Sem texto. `:id` para que o interceptor
   * registre o acesso como leitura do paciente.
   */
  @Auditado("PACIENTE")
  @Get("pacientes/:id/prontuario/resumo")
  resumo(@Param("id", ParseUUIDPipe) id: string): Promise<ResumoProntuario> {
    return this.prontuario.resumo(id);
  }

  @Auditado("EVOLUCAO")
  @Post("pacientes/:pacienteId/evolucoes")
  criar(
    @Param("pacienteId", ParseUUIDPipe) pacienteId: string,
    @Body(new ZodValidationPipe(evolucaoEntradaSchema)) dados: EvolucaoDados,
  ): Promise<EvolucaoResumo> {
    return this.prontuario.criar(pacienteId, dados);
  }

  /**
   * Download do prontuário completo. O navegador o recebe pelo BFF do Next
   * (`/api/[...path]`), nunca da API diretamente; `no-store` impede que o
   * arquivo fique em cache.
   */
  @Get("pacientes/:pacienteId/prontuario.pdf")
  async exportar(
    @Param("pacienteId", ParseUUIDPipe) pacienteId: string,
    @SessaoDaRequisicao() sessao: SessaoComUsuario,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<StreamableFile> {
    const { pdf, nomeArquivo } = await this.exportacao.exportar(
      pacienteId,
      sessao.usuario.nome,
      request.ip,
    );
    reply.header("Cache-Control", "no-store");
    return new StreamableFile(pdf, {
      type: "application/pdf",
      disposition: `attachment; filename="${nomeArquivo}"`,
    });
  }

  @Get("evolucoes/:id")
  abrir(@Param("id", ParseUUIDPipe) id: string): Promise<Evolucao> {
    return this.prontuario.abrir(id);
  }

  @Get("evolucoes/:id/historico")
  historico(@Param("id", ParseUUIDPipe) id: string): Promise<Evolucao[]> {
    return this.prontuario.historico(id);
  }

  /** 201 com a versão nova; a anterior é alcançável por `retificaDeId`. */
  @Auditado("EVOLUCAO")
  @Post("evolucoes/:id/retificar")
  retificar(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(retificacaoSchema)) dados: Retificacao,
  ): Promise<EvolucaoResumo> {
    return this.prontuario.retificar(id, dados);
  }
}
