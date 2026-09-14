import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyReply } from "fastify";
import { COOKIE_SESSAO, OPCOES_COOKIE } from "./auth.constantes";
import { PUBLICO } from "./publico.decorator";
import type { RequisicaoAutenticada } from "./requisicao-autenticada";
import { SessaoStore } from "./sessao.store";

const NAO_AUTENTICADO = {
  error: "Não autenticado",
  message: "Faça login para continuar",
};

/**
 * Guard global: toda rota exige sessão válida, salvo as marcadas com
 * `@Publico()`. Sem cookie, responde 401 antes de tocar o banco.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessoes: SessaoStore,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const publico = this.reflector.getAllAndOverride<boolean>(PUBLICO, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (publico) return true;

    const http = contexto.switchToHttp();
    const request = http.getRequest<RequisicaoAutenticada>();
    const token = request.cookies[COOKIE_SESSAO];
    if (!token) throw new UnauthorizedException(NAO_AUTENTICADO);

    const sessao = await this.sessoes.validarERenovar(token);
    if (!sessao) {
      http.getResponse<FastifyReply>().clearCookie(COOKIE_SESSAO, OPCOES_COOKIE);
      throw new UnauthorizedException(NAO_AUTENTICADO);
    }

    request.sessao = sessao;
    return true;
  }
}
