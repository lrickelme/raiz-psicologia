import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";
import { mergeMap, type Observable } from "rxjs";
import { RECURSO_AUDITADO } from "./auditado.decorator";
import { AuditoriaService } from "./auditoria.service";
import { EventoAuditoria, type RecursoAuditado } from "./eventos";

type ComId = { id: string };

function temId(valor: unknown): valor is ComId {
  return (
    typeof valor === "object" &&
    valor !== null &&
    typeof (valor as { id?: unknown }).id === "string"
  );
}

/** Ids dos recursos de uma coleção: o próprio array ou o primeiro array do objeto. */
function idsDaColecao(corpo: unknown): string[] | undefined {
  const lista = Array.isArray(corpo)
    ? corpo
    : typeof corpo === "object" && corpo !== null
      ? Object.values(corpo).find(Array.isArray)
      : undefined;
  return lista?.filter(temId).map((item) => item.id);
}

/**
 * Grava na trilha todo acesso bem-sucedido a controller marcado com
 * `@Auditado()`. A resposta só sai depois do registro gravado: se a trilha
 * falhar, a requisição falha junto, em vez de entregar dado sem rastro.
 *
 * Recusas (401, 404, 422) não entram: nelas nenhum dado foi entregue nem
 * alterado. Os eventos de login são gravados pelo `AuthService`.
 */
@Injectable()
export class AuditoriaInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditoria: AuditoriaService,
  ) {}

  intercept(contexto: ExecutionContext, next: CallHandler): Observable<unknown> {
    const recursoTipo = this.reflector.getAllAndOverride<RecursoAuditado>(
      RECURSO_AUDITADO,
      [contexto.getHandler(), contexto.getClass()],
    );
    if (!recursoTipo) return next.handle();

    const request = contexto
      .switchToHttp()
      .getRequest<FastifyRequest<{ Params: { id?: string } }>>();

    return next.handle().pipe(
      mergeMap(async (corpo) => {
        const idDoCorpo = temId(corpo) ? corpo.id : undefined;
        const recursoId = request.params.id ?? idDoCorpo;
        const ids = recursoId ? undefined : idsDaColecao(corpo);
        // Operação sobre um recurso que cria outro (remarcar): os dois ids.
        const criadoId = idDoCorpo !== recursoId ? idDoCorpo : undefined;

        await this.auditoria.registrar({
          tipoEvento:
            request.method === "GET"
              ? EventoAuditoria.LEITURA
              : EventoAuditoria.ESCRITA,
          ip: request.ip,
          recursoTipo,
          recursoId,
          detalhe: {
            metodo: request.method,
            rota: request.routeOptions.url ?? request.url,
            ...(ids && { ids }),
            ...(criadoId && { criadoId }),
          },
        });
        return corpo;
      }),
    );
  }
}
