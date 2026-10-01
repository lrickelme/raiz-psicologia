import { Module } from "@nestjs/common";
import { LabelController } from "./label.controller";
import { LabelRepository } from "./label.repository";
import { LabelService } from "./label.service";
import { TopicoController } from "./topico.controller";
import { TopicoRepository } from "./topico.repository";
import { TopicoService } from "./topico.service";

@Module({
  controllers: [LabelController, TopicoController],
  providers: [LabelService, LabelRepository, TopicoService, TopicoRepository],
})
export class EstudosModule {}
