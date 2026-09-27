import { createRequire } from "node:module";
import { openSync, type Font } from "fontkit";
import PDFDocument from "pdfkit";
import {
  dataLocal,
  formatarTelefone,
  horaLocal,
  type StatusAtendimento,
  type StatusPaciente,
} from "@raiz/shared";

const requerer = createRequire(__filename);
const arquivoFonte = (peso: 400 | 600 | 700) =>
  requerer.resolve(`@fontsource/hanken-grotesk/files/hanken-grotesk-latin-${peso}-normal.woff`);

/** Hanken Grotesk, a fonte de corpo do design-ref, embutida no PDF. */
const FONTES = { normal: arquivoFonte(400), semi: arquivoFonte(600), negrito: arquivoFonte(700) };
const cobertura: Font = openSync(FONTES.normal) as Font;

export type VersaoPdf = {
  registradoEm: Date;
  vigente: boolean;
  texto: string;
  /** Início do atendimento que originou a evolução, se houver. */
  atendimentoInicio: Date | null;
};

export type DadosProntuarioPdf = {
  paciente: {
    nome: string;
    nascimento: Date | null;
    telefone: string | null;
    email: string | null;
    status: StatusPaciente;
    criadoEm: Date;
    observacoes: string | null;
  };
  atendimentos: {
    inicio: Date;
    fim: Date;
    status: StatusAtendimento;
    motivo: string | null;
  }[];
  /** Cada evolução com suas versões, da original à vigente; evoluções em ordem cronológica. */
  evolucoes: VersaoPdf[][];
  profissional: string;
  emitidoEm: Date;
};

const STATUS_ATENDIMENTO: Record<StatusAtendimento, string> = {
  AGENDADO: "Agendado",
  REALIZADO: "Realizado",
  CANCELADO: "Cancelado",
  REMARCADO: "Remarcado",
  FALTA: "Falta",
};

export const AVISO_SIGILO =
  "Documento sigiloso: contém informações protegidas pelo sigilo profissional " +
  "(Código de Ética Profissional do Psicólogo). Uso restrito.";

const COR = { texto: "#2b2320", secundario: "#6b5d56", linha: "#d9cfc7" };
const MARGEM = { top: 56, left: 56, right: 56, bottom: 88 };

function data(instante: Date): string {
  return dataLocal(instante).split("-").reverse().join("/");
}

/** `@db.Date` chega à meia-noite UTC: formatar sem passar pelo fuso. */
function dataCalendario(dia: Date): string {
  return dia.toISOString().slice(0, 10).split("-").reverse().join("/");
}

function dataHora(instante: Date): string {
  return `${data(instante)} às ${horaLocal(instante)}`;
}

/**
 * Caractere que a fonte não tem viraria espaço em branco no PDF — conteúdo
 * clínico sumindo sem aviso. Em vez disso, aparece como `[U+2192]`: feio,
 * mas nada é omitido.
 */
export function comGlifos(texto: string): string {
  let saida = "";
  for (const caractere of texto) {
    const ponto = caractere.codePointAt(0)!;
    const controle = caractere === "\n" || caractere === "\t";
    saida +=
      controle || cobertura.hasGlyphForCodePoint(ponto)
        ? caractere
        : `[U+${ponto.toString(16).toUpperCase().padStart(4, "0")}]`;
  }
  return saida;
}

/**
 * Prontuário completo em PDF (spec prontuario, "Exportação do prontuário"):
 * cadastro, atendimentos e todas as versões de cada evolução, marcadas como
 * vigente ou retificada. Rodapé em toda página com emissão, profissional e
 * aviso de sigilo. Texto livre entra como texto — sem HTML nem formatação —,
 * então não há como injetar marcação no documento.
 */
export function gerarProntuarioPdf(dados: DadosProntuarioPdf): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margins: MARGEM,
    bufferPages: true,
    info: {
      Title: `Prontuário — ${dados.paciente.nome}`,
      Author: dados.profissional,
      CreationDate: dados.emitidoEm,
    },
  });
  const partes: Buffer[] = [];
  doc.on("data", (parte: Buffer) => partes.push(parte));
  const pronto = new Promise<Buffer>((resolver, rejeitar) => {
    doc.on("end", () => resolver(Buffer.concat(partes)));
    doc.on("error", rejeitar);
  });

  const largura = doc.page.width - MARGEM.left - MARGEM.right;
  const escrever = (texto: string, opcoes?: PDFKit.Mixins.TextOptions) =>
    doc.text(comGlifos(texto), opcoes);

  function secao(titulo: string) {
    doc.moveDown(1.2).font(FONTES.semi).fontSize(13).fillColor(COR.texto);
    escrever(titulo);
    const y = doc.y + 3;
    doc.moveTo(MARGEM.left, y).lineTo(MARGEM.left + largura, y).lineWidth(0.6).strokeColor(COR.linha).stroke();
    doc.moveDown(0.6);
  }

  function campo(rotulo: string, valor: string | null) {
    doc.font(FONTES.semi).fontSize(10).fillColor(COR.secundario);
    escrever(`${rotulo}: `, { continued: true });
    doc.font(FONTES.normal).fillColor(COR.texto);
    escrever(valor ?? "—");
  }

  // Cabeçalho
  doc.font(FONTES.negrito).fontSize(20).fillColor(COR.texto);
  escrever("Prontuário psicológico");
  doc.font(FONTES.normal).fontSize(12).fillColor(COR.secundario);
  escrever(dados.paciente.nome);

  // Cadastro
  const { paciente } = dados;
  secao("Dados cadastrais");
  campo("Nome", paciente.nome);
  campo("Nascimento", paciente.nascimento && dataCalendario(paciente.nascimento));
  campo("Telefone", formatarTelefone(paciente.telefone));
  campo("E-mail", paciente.email);
  campo("Situação", paciente.status === "ATIVO" ? "Ativo" : "Arquivado");
  campo("Cadastro", data(paciente.criadoEm));
  campo("Observações administrativas", paciente.observacoes);

  // Atendimentos
  secao("Histórico de atendimentos");
  if (!dados.atendimentos.length) {
    doc.font(FONTES.normal).fontSize(10).fillColor(COR.secundario);
    escrever("Nenhum atendimento registrado.");
  }
  for (const atendimento of dados.atendimentos) {
    doc.font(FONTES.semi).fontSize(10).fillColor(COR.texto);
    escrever(
      `${data(atendimento.inicio)}, ${horaLocal(atendimento.inicio)}–${horaLocal(atendimento.fim)} · ` +
        STATUS_ATENDIMENTO[atendimento.status],
    );
    if (atendimento.motivo) {
      doc.font(FONTES.normal).fillColor(COR.secundario);
      escrever(`Motivo: ${atendimento.motivo}`, { indent: 12 });
    }
    doc.moveDown(0.3);
  }

  // Evoluções
  secao("Evoluções");
  if (!dados.evolucoes.length) {
    doc.font(FONTES.normal).fontSize(10.5).fillColor(COR.texto);
    escrever("Nenhuma evolução registrada para este paciente.");
  }
  dados.evolucoes.forEach((versoes, i) => {
    if (i > 0) doc.moveDown(0.8);
    const original = versoes[0];
    doc.font(FONTES.semi).fontSize(11.5).fillColor(COR.texto);
    escrever(
      `Evolução ${i + 1}` +
        (original.atendimentoInicio
          ? ` · atendimento de ${data(original.atendimentoInicio)}`
          : " · avulsa"),
    );
    versoes.forEach((versao, v) => {
      doc.moveDown(0.4).font(FONTES.semi).fontSize(9.5).fillColor(COR.secundario);
      escrever(
        `${versoes.length > 1 ? `Versão ${v + 1} de ${versoes.length} · ` : ""}` +
          `registrada em ${dataHora(versao.registradoEm)} · ` +
          (versao.vigente ? "VIGENTE" : "RETIFICADA"),
      );
      doc.font(FONTES.normal).fontSize(10.5).fillColor(COR.texto);
      escrever(versao.texto, { align: "left" });
    });
  });

  // Rodapé em todas as páginas, com a contagem final conhecida.
  const { start, count } = doc.bufferedPageRange();
  const emissao = `Emitido em ${dataHora(dados.emitidoEm)} por ${dados.profissional}`;
  for (let pagina = start; pagina < start + count; pagina++) {
    doc.switchToPage(pagina);
    // Fora da margem inferior o pdfkit abriria página nova; zera enquanto escreve.
    doc.page.margins.bottom = 0;
    const y = doc.page.height - MARGEM.bottom + 20;
    doc
      .moveTo(MARGEM.left, y - 8)
      .lineTo(MARGEM.left + largura, y - 8)
      .lineWidth(0.6)
      .strokeColor(COR.linha)
      .stroke();
    doc.font(FONTES.normal).fontSize(8).fillColor(COR.secundario);
    doc.text(comGlifos(`${emissao} · Página ${pagina - start + 1} de ${count}`), MARGEM.left, y, {
      width: largura,
      lineBreak: false,
    });
    doc.text(AVISO_SIGILO, MARGEM.left, y + 12, { width: largura });
  }

  doc.end();
  return pronto;
}
