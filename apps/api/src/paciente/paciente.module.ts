import { Module } from "@nestjs/common";
import { PacienteController } from "./paciente.controller";
import { PacienteRepository } from "./paciente.repository";
import { PacienteService } from "./paciente.service";

@Module({
  controllers: [PacienteController],
  providers: [PacienteService, PacienteRepository],
})
export class PacienteModule {}
