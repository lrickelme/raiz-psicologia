import { Module } from "@nestjs/common";
// Valida a configuração na subida, antes de qualquer módulo precisar dela.
import "./comum/config";
import { AtendimentoModule } from "./atendimento/atendimento.module";
import { AuditoriaModule } from "./auditoria/auditoria.module";
import { AuthModule } from "./auth/auth.module";
import { EstudosModule } from "./estudos/estudos.module";
import { FinanceiroModule } from "./financeiro/financeiro.module";
import { PacienteModule } from "./paciente/paciente.module";
import { ProntuarioModule } from "./prontuario/prontuario.module";
import { HealthController } from "./health/health.controller";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    PrismaModule,
    AuditoriaModule,
    AuthModule,
    PacienteModule,
    AtendimentoModule,
    ProntuarioModule,
    FinanceiroModule,
    EstudosModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
