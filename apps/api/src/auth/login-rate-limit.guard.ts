import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { TentativasLogin } from "./tentativas-login";

/** Responde 429 antes de avaliar a senha quando o IP esgotou as tentativas. */
@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  constructor(private readonly tentativas: TentativasLogin) {}

  canActivate(contexto: ExecutionContext): boolean {
    const http = contexto.switchToHttp();
    const restanteMs = this.tentativas.bloqueadoPor(
      http.getRequest<FastifyRequest>().ip,
    );
    if (restanteMs <= 0) return true;

    const segundos = Math.ceil(restanteMs / 1000);
    http.getResponse<FastifyReply>().header("Retry-After", String(segundos));
    throw new HttpException(
      {
        error: "Muitas tentativas",
        message: `Aguarde ${segundos} segundos antes de tentar novamente`,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
