import { Controller, Get, Query } from "@nestjs/common";
import {
  consultaMensalSchema,
  periodoFinanceiroSchema,
  type ConsultaMensal,
  type PeriodoFinanceiro,
  type Receita,
  type ReceitaMensal,
  type ReceitaPorPaciente,
} from "@raiz/shared";
import { Auditado } from "../auditoria/auditado.decorator";
import { ZodValidationPipe } from "../comum/zod-validation.pipe";
import { FinanceiroService } from "./financeiro.service";

/**
 * Um endpoint por pergunta, não um resumo único: cada painel do dashboard
 * refaz só a sua consulta (design.md, "Um endpoint por pergunta").
 *
 * Só `por-paciente` é auditado: devolve nomes de pacientes. `receita` e
 * `mensal` são agregados sem identidade.
 */
@Controller("financeiro")
export class FinanceiroController {
  constructor(private readonly financeiro: FinanceiroService) {}

  @Get("receita")
  receita(
    @Query(new ZodValidationPipe(periodoFinanceiroSchema)) periodo: PeriodoFinanceiro,
  ): Promise<Receita> {
    return this.financeiro.receita(periodo);
  }

  @Get("mensal")
  mensal(
    @Query(new ZodValidationPipe(consultaMensalSchema)) consulta: ConsultaMensal,
  ): Promise<ReceitaMensal[]> {
    return this.financeiro.mensal(consulta);
  }

  @Get("por-paciente")
  @Auditado("PACIENTE", (linhas: ReceitaPorPaciente[]) => linhas.map((l) => l.paciente.id))
  porPaciente(
    @Query(new ZodValidationPipe(periodoFinanceiroSchema)) periodo: PeriodoFinanceiro,
  ): Promise<ReceitaPorPaciente[]> {
    return this.financeiro.porPaciente(periodo);
  }
}
