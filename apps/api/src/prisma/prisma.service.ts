import {
  INestApplication,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { CAMPOS_CRIPTOGRAFADOS } from "../comum/criptografia/campos";
import { carregarChave } from "../comum/criptografia/cifra";
import { criptografiaDeColuna } from "../comum/criptografia/extensao";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super();
    // Extensão só de `query` não altera os tipos do cliente, então o objeto
    // estendido pode ocupar o lugar da instância sem mudar quem injeta
    // PrismaService. `carregarChave` lança sem a chave: a API não sobe.
    return this.$extends(
      criptografiaDeColuna(CAMPOS_CRIPTOGRAFADOS, carregarChave()),
    ) as this;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async enableShutdownHooks(app: INestApplication) {
    process.on("beforeExit", () => {
      void app.close();
    });
  }
}
