import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { LabelPrioridade } from "@prisma/client";
import type {
  Label,
  LabelAlteracao,
  LabelComUso,
  LabelDados,
  LabelEmUso,
  OrdemLabels,
} from "@raiz/shared";
import { ehNomeRepetido, ehViolacaoDeLabel, LabelRepository } from "./label.repository";

export function labelParaApi({ id, nome, cor, ordem }: LabelPrioridade): Label {
  return { id, nome, cor, ordem };
}

const NAO_ENCONTRADA = {
  error: "Label não encontrada",
  message: "Nenhuma label com esse identificador",
};

const NOME_REPETIDO = {
  error: "Nome repetido",
  message: "Já existe uma label com esse nome",
};

function emUso(topicos: number): ConflictException {
  const corpo: LabelEmUso = { topicos };
  return new ConflictException({
    error: "Label em uso",
    message: "Troque a prioridade dos tópicos que usam esta label antes de excluí-la",
    ...corpo,
  });
}

/** Sem `@Auditado`: label não é dado de paciente (design.md da 04). */
@Injectable()
export class LabelService {
  constructor(private readonly repositorio: LabelRepository) {}

  async listar(): Promise<LabelComUso[]> {
    return (await this.repositorio.listar()).map((label) => ({
      ...labelParaApi(label),
      emUso: label._count.topicos,
    }));
  }

  async criar(dados: LabelDados): Promise<Label> {
    try {
      return labelParaApi(await this.repositorio.criar(dados));
    } catch (erro) {
      if (ehNomeRepetido(erro)) throw new ConflictException(NOME_REPETIDO);
      throw erro;
    }
  }

  async alterar(id: string, dados: LabelAlteracao): Promise<Label> {
    await this.existente(id);
    try {
      return labelParaApi(await this.repositorio.alterar(id, dados));
    } catch (erro) {
      if (ehNomeRepetido(erro)) throw new ConflictException(NOME_REPETIDO);
      throw erro;
    }
  }

  async reordenar({ ids }: OrdemLabels): Promise<LabelComUso[]> {
    if (!(await this.repositorio.reordenar(ids))) {
      throw new ConflictException({
        error: "Ordem desatualizada",
        message: "As labels mudaram desde que a lista foi aberta; recarregue e tente de novo",
      });
    }
    return this.listar();
  }

  /**
   * A contagem prévia só monta a resposta com a quantidade. Quem garante o
   * bloqueio é a FK: um tópico associado depois da contagem faz o DELETE
   * falhar, e a resposta é o mesmo 409 (spec estudos, "Corrida com associação").
   */
  async excluir(id: string): Promise<void> {
    await this.existente(id);
    const topicos = await this.repositorio.contarTopicos(id);
    if (topicos > 0) throw emUso(topicos);
    try {
      await this.repositorio.excluir(id);
    } catch (erro) {
      if (ehViolacaoDeLabel(erro)) throw emUso(await this.repositorio.contarTopicos(id));
      throw erro;
    }
  }

  private async existente(id: string): Promise<LabelPrioridade> {
    const label = await this.repositorio.obter(id);
    if (!label) throw new NotFoundException(NAO_ENCONTRADA);
    return label;
  }
}
