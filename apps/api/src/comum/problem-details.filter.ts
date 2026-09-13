import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";

/**
 * Todo erro da API vira `application/problem+json` (RFC 7807), inclusive os
 * não tratados — nunca vaza stack trace ou formato ad-hoc para o cliente.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const { status, title, detail, extra } = this.toProblem(exception);

    reply
      .status(status)
      .header("Content-Type", "application/problem+json")
      .send({
        type: "about:blank",
        title,
        status,
        detail,
        instance: request.url,
        ...extra,
      });
  }

  private toProblem(exception: unknown): {
    status: number;
    title: string;
    detail?: string;
    extra?: Record<string, unknown>;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === "string") {
        return { status, title: exception.name, detail: response };
      }

      const { message, error, statusCode: _statusCode, ...rest } =
        response as Record<string, unknown>;

      return {
        status,
        title: typeof error === "string" ? error : exception.name,
        detail: Array.isArray(message)
          ? message.join("; ")
          : typeof message === "string"
            ? message
            : undefined,
        extra: rest,
      };
    }

    // Exceção não mapeada: nunca expor detalhe interno ao cliente.
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      title: "Erro interno",
    };
  }
}
