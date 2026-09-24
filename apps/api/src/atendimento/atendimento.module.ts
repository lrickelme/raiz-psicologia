import { Module } from "@nestjs/common";
import { AtendimentoController } from "./atendimento.controller";
import { AtendimentoRepository } from "./atendimento.repository";
import { AtendimentoService } from "./atendimento.service";

@Module({
  controllers: [AtendimentoController],
  providers: [AtendimentoService, AtendimentoRepository],
})
export class AtendimentoModule {}
