import type { Type } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import fastifyCookie from "@fastify/cookie";
import { AppModule } from "./app.module";
import { ProblemDetailsFilter } from "./comum/problem-details.filter";

/**
 * Monta a aplicação como em produção. Usada pelo `main` e pelos testes, que
 * podem passar um módulo que importa o `AppModule` e acrescenta controllers.
 */
export async function criarApp(modulo: Type = AppModule): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    modulo,
    // O Nest só recebe tráfego do BFF do Next (rede interna, sem porta pública),
    // então confiar em X-Forwarded-For é seguro e necessário para que o rate
    // limit de login por IP enxergue o navegador, não o proxy.
    new FastifyAdapter({ trustProxy: true }),
    { logger: process.env.NODE_ENV === "test" ? false : undefined },
  );

  await app.register(fastifyCookie);

  app.setGlobalPrefix("api/v1");
  app.useGlobalFilters(new ProblemDetailsFilter());

  return app;
}
