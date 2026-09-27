import { Injectable, NotFoundException } from "@nestjs/common";
import { hojeLocal } from "@raiz/shared";
import { AuditoriaService } from "../../auditoria/auditoria.service";
import { EventoAuditoria } from "../../auditoria/eventos";
import { PrismaService } from "../../prisma/prisma.service";
import { gerarProntuarioPdf, type VersaoPdf } from "./prontuario-pdf";

type VersaoCarregada = VersaoPdf & { id: string; retificaDeId: string | null };

/** Cadeias de retificação, da original à vigente, em ordem cronológica das originais. */
export function montarCadeias(versoes: VersaoCarregada[]): VersaoPdf[][] {
  const sucessora = new Map(
    versoes.filter((v) => v.retificaDeId).map((v) => [v.retificaDeId!, v]),
  );
  return versoes
    .filter((v) => !v.retificaDeId)
    .sort((a, b) => a.registradoEm.getTime() - b.registradoEm.getTime())
    .map((original) => {
      const cadeia: VersaoPdf[] = [];
      for (let atual: VersaoCarregada | undefined = original; atual; atual = sucessora.get(atual.id)) {
        cadeia.push(atual);
      }
      return cadeia;
    });
}

function nomeDeArquivo(nome: string): string {
  const slug = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `prontuario-${slug || "paciente"}-${hojeLocal()}.pdf`;
}

@Injectable()
export class ExportacaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  /**
   * Gera o PDF do prontuário completo. Cada versão de evolução é decifrada
   * pela extensão e entra na trilha como `EVOLUCAO_LIDA` sem tratamento
   * próprio (design.md, "Auditoria no ponto de decifragem"); a exportação em
   * si é registrada depois de o documento existir. Paciente arquivado também
   * exporta: o prontuário continua legível.
   */
  async exportar(
    pacienteId: string,
    profissional: string,
    ip: string,
  ): Promise<{ pdf: Buffer; nomeArquivo: string }> {
    const paciente = await this.prisma.paciente.findUnique({ where: { id: pacienteId } });
    if (!paciente) {
      throw new NotFoundException({
        error: "Paciente não encontrado",
        message: "Nenhum paciente com esse identificador",
      });
    }

    const atendimentos = await this.prisma.atendimento.findMany({
      where: { pacienteId },
      select: { inicio: true, fim: true, status: true, motivo: true },
      orderBy: [{ inicio: "asc" }, { id: "asc" }],
    });
    const versoes = await this.prisma.evolucao.findMany({
      where: { pacienteId },
      select: {
        id: true,
        pacienteId: true,
        texto: true,
        registradoEm: true,
        vigente: true,
        retificaDeId: true,
        atendimento: { select: { inicio: true } },
      },
    });
    const evolucoes = montarCadeias(
      versoes.map((v) => ({ ...v, atendimentoInicio: v.atendimento?.inicio ?? null })),
    );

    const pdf = await gerarProntuarioPdf({
      paciente,
      atendimentos,
      evolucoes,
      profissional,
      emitidoEm: new Date(),
    });

    await this.auditoria.registrar({
      tipoEvento: EventoAuditoria.PRONTUARIO_EXPORTADO,
      ip,
      recursoTipo: "PACIENTE",
      recursoId: pacienteId,
      detalhe: {
        evolucoes: evolucoes.length,
        versoes: versoes.length,
        atendimentos: atendimentos.length,
      },
    });
    return { pdf, nomeArquivo: nomeDeArquivo(paciente.nome) };
  }
}
