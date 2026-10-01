import { Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import {
  fimDoMes,
  hojeLocal,
  inicioDoMes,
  intervaloDosDias,
  TAMANHO_MAXIMO_PAGINA,
  type HistoricoConcluidos,
  type PaginaConcluidos,
  type QuadroEstudos,
  type Topico,
  type TopicoAlteracao,
  type TopicoDados,
  type TransicaoTopico,
} from "@raiz/shared";
import { ehViolacaoDeLabel } from "./label.repository";
import { labelParaApi } from "./label.service";
import { TopicoRepository, type TopicoComLabel } from "./topico.repository";

export function topicoParaApi(topico: TopicoComLabel): Topico {
  return {
    id: topico.id,
    titulo: topico.titulo,
    descricao: topico.descricao,
    label: topico.label && labelParaApi(topico.label),
    status: topico.status,
    concluidoEm: topico.concluidoEm?.toISOString() ?? null,
    criadoEm: topico.criadoEm.toISOString(),
    atualizadoEm: topico.atualizadoEm.toISOString(),
  };
}

const NAO_ENCONTRADO = {
  error: "Tópico não encontrado",
  message: "Nenhum tópico com esse identificador",
};

/** Mesmo formato do `ZodValidationPipe`, para a interface tratar igual. */
const labelInexistente = () =>
  new UnprocessableEntityException({
    error: "Dados inválidos",
    message: "Um ou mais campos não passaram na validação",
    campos: [{ caminho: "labelId", mensagem: "Label não encontrada" }],
  });

/**
 * Sem `@Auditado` nem cifra: tópico de estudo não é dado de paciente (design.md
 * da 04). Não há exclusão: a conclusão encerra o ciclo.
 */
@Injectable()
export class TopicoService {
  constructor(private readonly repositorio: TopicoRepository) {}

  /** Sempre em `A_ESTUDAR`, pelo default do banco. */
  async criar({ titulo, descricao, labelId }: TopicoDados): Promise<Topico> {
    await this.exigirLabel(labelId);
    return topicoParaApi(
      await this.gravando(() =>
        this.repositorio.criar({ titulo, descricao: descricao ?? null, labelId: labelId ?? null }),
      ),
    );
  }

  async alterar(id: string, dados: TopicoAlteracao): Promise<Topico> {
    await this.existente(id);
    await this.exigirLabel(dados.labelId);
    return topicoParaApi(await this.gravando(() => this.repositorio.alterar(id, dados)));
  }

  /**
   * Única porta de mudança de estado. Concluir grava o instante do servidor;
   * sair de `CONCLUIDO` o limpa; o mesmo estado não regrava nada.
   */
  async mover(id: string, { status }: TransicaoTopico): Promise<Topico> {
    const atual = await this.existente(id);
    if (atual.status === status) return topicoParaApi(atual);
    return topicoParaApi(
      await this.repositorio.alterar(id, {
        status,
        concluidoEm: status === "CONCLUIDO" ? new Date() : null,
      }),
    );
  }

  /** "Este mês" é o de São Paulo, nunca o do processo nem o da sessão do Postgres. */
  async quadro(): Promise<QuadroEstudos> {
    const hoje = hojeLocal();
    const mes = intervaloDosDias(inicioDoMes(hoje), fimDoMes(hoje));
    const [aEstudar, emEstudo, concluidos, totalConcluidos, concluidosNoMes] = await Promise.all([
      this.repositorio.pendentes("A_ESTUDAR"),
      this.repositorio.pendentes("EM_ESTUDO"),
      this.repositorio.concluidosRecentes(),
      this.repositorio.contarConcluidos(),
      this.repositorio.contarConcluidos(mes),
    ]);
    return {
      aEstudar: aEstudar.map(topicoParaApi),
      emEstudo: emEstudo.map(topicoParaApi),
      concluidos: concluidos.map(topicoParaApi),
      totalConcluidos,
      pendentes: aEstudar.length + emEstudo.length,
      concluidosNoMes,
    };
  }

  async historico({ pagina }: HistoricoConcluidos): Promise<PaginaConcluidos> {
    const [itens, total] = await Promise.all([
      this.repositorio.concluidos(pagina, TAMANHO_MAXIMO_PAGINA),
      this.repositorio.contarConcluidos(),
    ]);
    return { itens: itens.map(topicoParaApi), total, page: pagina, size: TAMANHO_MAXIMO_PAGINA };
  }

  /** A verificação prévia dá a mensagem; a FK cobre a label excluída no meio. */
  private async exigirLabel(labelId: string | null | undefined): Promise<void> {
    if (labelId && !(await this.repositorio.labelExiste(labelId))) throw labelInexistente();
  }

  private async gravando(gravar: () => Promise<TopicoComLabel>): Promise<TopicoComLabel> {
    try {
      return await gravar();
    } catch (erro) {
      if (ehViolacaoDeLabel(erro)) throw labelInexistente();
      throw erro;
    }
  }

  private async existente(id: string): Promise<TopicoComLabel> {
    const topico = await this.repositorio.obter(id);
    if (!topico) throw new NotFoundException(NAO_ENCONTRADO);
    return topico;
  }
}
