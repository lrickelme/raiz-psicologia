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
import { loginSchema, type LoginInput, type SessaoCorrente } from "@raiz/shared";
import type { FastifyReply, FastifyRequest } from "fastify";
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
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    const token = request.cookies[COOKIE_SESSAO];
    if (token) await this.sessoes.destruir(token);
    reply.clearCookie(COOKIE_SESSAO, OPCOES_COOKIE);
  }

  @Get("sessao")
  sessao(@SessaoDaRequisicao() sessao: SessaoComUsuario): SessaoCorrente {
    const { id, nome, email } = sessao.usuario;
    return { usuario: { id, nome, email }, expiraEm: sessao.expiraEm.toISOString() };
  }
}
