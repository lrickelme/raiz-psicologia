import { AsyncLocalStorage } from "node:async_hooks";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";

type ContextoRequisicao = { ip: string };

const armazenamento = new AsyncLocalStorage<ContextoRequisicao>();

/**
 * Deixa a origem da requisição ao alcance de quem não recebe o `request` —
 * a auditoria de leitura, que acontece dentro do Prisma. `preHandler` e não
 * `onRequest`: o parsing do corpo roda em callbacks do socket, que perderiam
 * o contexto aberto antes dele.
 */
export function registrarContextoDaRequisicao(app: NestFastifyApplication): void {
  app
    .getHttpAdapter()
    .getInstance()
    .addHook("preHandler", (request, _reply, done) => {
      armazenamento.run({ ip: request.ip }, done);
    });
}

/** `undefined` fora de requisição HTTP (seed, scripts). */
export function ipDaRequisicao(): string | undefined {
  return armazenamento.getStore()?.ip;
}
