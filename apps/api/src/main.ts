import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import fastifyCookie from "@fastify/cookie";
import { AppModule } from "./app.module";
import { ProblemDetailsFilter } from "./comum/problem-details.filter";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    // O Nest só recebe tráfego do BFF do Next (rede interna, sem porta pública),
    // então confiar em X-Forwarded-For é seguro e necessário para que o rate
    // limit de login por IP enxergue o navegador, não o proxy.
    new FastifyAdapter({ trustProxy: true }),
  );

  await app.register(fastifyCookie);

  app.setGlobalPrefix("api/v1");
  app.useGlobalFilters(new ProblemDetailsFilter());

  const port = process.env.PORT ? Number(process.env.PORT) : 3333;
  await app.listen(port, "0.0.0.0");
}

bootstrap();
