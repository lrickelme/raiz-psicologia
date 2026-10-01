import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from "@nestjs/common";
import {
  labelAlteracaoSchema,
  labelEntradaSchema,
  ordemLabelsSchema,
  type Label,
  type LabelAlteracao,
  type LabelComUso,
  type LabelDados,
  type OrdemLabels,
} from "@raiz/shared";
import { ZodValidationPipe } from "../comum/zod-validation.pipe";
import { LabelService } from "./label.service";

/** Sem `@Auditado`: estudos não é dado de paciente (design.md da 04). */
@Controller("labels")
export class LabelController {
  constructor(private readonly labels: LabelService) {}

  @Get()
  listar(): Promise<LabelComUso[]> {
    return this.labels.listar();
  }

  @Post()
  criar(@Body(new ZodValidationPipe(labelEntradaSchema)) dados: LabelDados): Promise<Label> {
    return this.labels.criar(dados);
  }

  // Antes de `:id`, embora o método já as separe: `ordem` não é um id.
  @Put("ordem")
  reordenar(
    @Body(new ZodValidationPipe(ordemLabelsSchema)) dados: OrdemLabels,
  ): Promise<LabelComUso[]> {
    return this.labels.reordenar(dados);
  }

  @Patch(":id")
  alterar(
    @Param("id", ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(labelAlteracaoSchema)) dados: LabelAlteracao,
  ): Promise<Label> {
    return this.labels.alterar(id, dados);
  }

  @Delete(":id")
  @HttpCode(204)
  excluir(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.labels.excluir(id);
  }
}
