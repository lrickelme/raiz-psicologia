import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  HEADER_SESSAO_EXPIRA,
  loginSchema,
  type LoginInput,
  type SessaoCorrente,
} from "@raiz/shared";
import type { FastifyReply, FastifyRequest } from "fastify";
import { AuditoriaService } from "../auditoria/auditoria.service";
import { EventoAuditoria } from "../auditoria/eventos";
import { ZodValidationPipe } from "../comum/zod-validation.pipe";
import { COOKIE_SESSAO, OPCOES_COOKIE } from "./auth.constantes";
import { AuthService } from "./auth.service";
import { LoginRateLimitGuard } from "./login-rate-limit.guard";
import { Publico } from "./publico.decorator";
import { SessaoDaRequisicao } from "./requisicao-autenticada";
import { SessaoStore, type SessaoComUsuario } from "./sessao.store";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessoes: SessaoStore,
    private readonly auditoria: AuditoriaService,
  ) {}

  @Publico()
  @UseGuards(LoginRateLimitGuard)
  @Post("login")
  @HttpCode(204)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dados: LoginInput,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    const token = await this.auth.login(dados, request.ip);
    reply.setCookie(COOKIE_SESSAO, token, OPCOES_COOKIE);
  }

  @Post("logout")
  @HttpCode(204)
  async logout(
    @Req() request: FastifyRequest,
    @SessaoDaRequisicao() sessao: SessaoComUsuario,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    const token = request.cookies[COOKIE_SESSAO];
    if (token) await this.sessoes.destruir(token);
    await this.auditoria.registrar({
      tipoEvento: EventoAuditoria.LOGOUT,
      ip: request.ip,
      recursoTipo: "USUARIO",
      recursoId: sessao.usuario.id,
    });
    // O guard anunciou a renovação antes de a sessão ser destruída aqui.
    reply.removeHeader(HEADER_SESSAO_EXPIRA);
    reply.clearCookie(COOKIE_SESSAO, OPCOES_COOKIE);
  }

  @Get("sessao")
  sessao(@SessaoDaRequisicao() sessao: SessaoComUsuario): SessaoCorrente {
    const { id, nome, email } = sessao.usuario;
    return { usuario: { id, nome, email }, expiraEm: sessao.expiraEm.toISOString() };
  }
}
