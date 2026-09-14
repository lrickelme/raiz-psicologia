import {
  createParamDecorator,
  type ExecutionContext,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import type { SessaoComUsuario } from "./sessao.store";

export type RequisicaoAutenticada = FastifyRequest & {
  sessao: SessaoComUsuario;
};

/** Sessão validada pelo AuthGuard. Só faz sentido em rota não pública. */
export const SessaoDaRequisicao = createParamDecorator(
  (_dados: unknown, contexto: ExecutionContext): SessaoComUsuario =>
    contexto.switchToHttp().getRequest<RequisicaoAutenticada>().sessao,
);
