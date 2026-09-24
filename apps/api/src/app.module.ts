import { Module } from "@nestjs/common";
import { AtendimentoModule } from "./atendimento/atendimento.module";
import { AuditoriaModule } from "./auditoria/auditoria.module";
import { AuthModule } from "./auth/auth.module";
import { PacienteModule } from "./paciente/paciente.module";
import { HealthController } from "./health/health.controller";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [PrismaModule, AuditoriaModule, AuthModule, PacienteModule, AtendimentoModule],
  controllers: [HealthController],
})
export class AppModule {}
