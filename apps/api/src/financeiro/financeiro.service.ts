import { Injectable } from "@nestjs/common";
import {
  STATUS_ATENDIMENTO,
  dataLocal,
  fimDoMes,
  hojeLocal,
  inicioDoMes,
  intervaloDosDias,
  somarMeses,
  type ConsultaMensal,
  type PeriodoFinanceiro,
  type Receita,
  type ReceitaMensal,
  type ReceitaPorPaciente,
} from "@raiz/shared";
import { dinheiroParaApi } from "../comum/dinheiro";
import { FinanceiroRepository } from "./financeiro.repository";

const maior = (a: string, b: string) => (a > b ? a : b);
const menor = (a: string, b: string) => (a < b ? a : b);

/**
 * Traduz as agregações para a API. `Prisma.Decimal` até a borda: a única
 * conversão é para string, em `dinheiroParaApi`.
 */
@Injectable()
export class FinanceiroService {
  constructor(private readonly repositorio: FinanceiroRepository) {}

  /**
   * `AGENDADO` se divide pelo término: ainda por terminar é previsão, só no
   * trecho do período dentro do mês corrente (spec financeiro, "Receita
   * prevista do mês"); já terminado é pendente de encerramento, em qualquer
   * mês do período ("Atendimentos pendentes de encerramento").
   */
  async receita({ de, ate }: PeriodoFinanceiro): Promise<Receita> {
    const agora = new Date();
    const hoje = hojeLocal(agora);
    const periodo = intervaloDosDias(de, ate);
    const dePrevista = maior(de, inicioDoMes(hoje));
    const atePrevista = menor(ate, fimDoMes(hoje));

    const [realizada, prevista, pendentes] = await Promise.all([
      this.repositorio.realizada(periodo),
      dePrevista <= atePrevista
        ? this.repositorio.prevista(intervaloDosDias(dePrevista, atePrevista), agora)
        : null,
      this.repositorio.pendentes(periodo, agora),
    ]);
    return {
      realizada: dinheiroParaApi(realizada),
      prevista: prevista && dinheiroParaApi(prevista),
      pendentes: { quantidade: pendentes.quantidade, valor: dinheiroParaApi(pendentes.valor) },
    };
  }

  /**
   * Os `meses` mais recentes até o corrente, sem começar antes do mês do
   * primeiro atendimento (spec financeiro, "Histórico curto").
   */
  async mensal({ meses }: ConsultaMensal): Promise<ReceitaMensal[]> {
    const primeiro = await this.repositorio.primeiroInicio();
    if (!primeiro) return [];

    const ate = inicioDoMes(hojeLocal());
    const de = maior(somarMeses(ate, -(meses - 1)), inicioDoMes(dataLocal(primeiro)));
    if (de > ate) return [];

    const serie = await this.repositorio.mensal(de, ate);
    return serie.map(({ mes, realizada }) => ({ mes, realizada: dinheiroParaApi(realizada) }));
  }

  async porPaciente({ de, ate }: PeriodoFinanceiro): Promise<ReceitaPorPaciente[]> {
    const linhas = await this.repositorio.porPaciente(intervaloDosDias(de, ate));
    return linhas.map((linha) => ({
      paciente: { id: linha.id, nome: linha.nome, status: linha.status },
      total: dinheiroParaApi(linha.total),
      contagem: Object.fromEntries(
        STATUS_ATENDIMENTO.map((status) => [status, linha[status]]),
      ) as ReceitaPorPaciente["contagem"],
    }));
  }
}
