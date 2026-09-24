import "reflect-metadata";
import { criarApp } from "./app.factory";

async function bootstrap() {
  const app = await criarApp();
  const port = process.env.PORT ? Number(process.env.PORT) : 3333;
  await app.listen(port, "0.0.0.0");
}

bootstrap();
