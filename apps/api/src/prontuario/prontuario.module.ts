import { Module } from "@nestjs/common";
import { ExportacaoService } from "./pdf/exportacao.service";
import { ProntuarioController } from "./prontuario.controller";
import { ProntuarioRepository } from "./prontuario.repository";
import { ProntuarioService } from "./prontuario.service";
import { RascunhoController } from "./rascunho.controller";
import { RascunhoService } from "./rascunho.service";

@Module({
  controllers: [ProntuarioController, RascunhoController],
  providers: [ProntuarioService, ProntuarioRepository, RascunhoService, ExportacaoService],
})
export class ProntuarioModule {}
