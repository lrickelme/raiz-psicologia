import type { EvolucaoResumo, Paciente } from "@raiz/shared";
import { extractText } from "unpdf";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { subirAmbiente, type Ambiente } from "../teste/ambiente";

/** Texto de cada página, com espaços normalizados. */
async function paginas(pdf: Buffer): Promise<string[]> {
  const { text } = await extractText(new Uint8Array(pdf));
  return text.map((pagina) => pagina.replace(/\s+/g, " "));
}

describe("prontuário — exportação em PDF (integração)", () => {
  let amb: Ambiente;
  let paciente: Paciente;

  beforeAll(async () => {
    amb = await subirAmbiente();
  }, 180_000);

  afterAll(() => amb?.encerrar());

  beforeEach(async () => {
    await amb.prisma.$executeRawUnsafe("TRUNCATE atendimento, paciente CASCADE");
    paciente = (
      await amb.api("POST", "/pacientes", {
        nome: "Mariana Alves",
        valorConsultaPadrao: "150",
        telefone: "83993229097",
      })
    ).json();
  });

  function exportar(pacienteId = paciente.id) {
    return amb.api("GET", `/pacientes/${pacienteId}/prontuario.pdf`);
  }

  async function registrar(texto: string, atendimentoId?: string): Promise<EvolucaoResumo> {
    const resposta = await amb.api("POST", `/pacientes/${paciente.id}/evolucoes`, { texto, atendimentoId });
    expect(resposta.statusCode).toBe(201);
    return resposta.json();
  }

  async function retificar(id: string, texto: string): Promise<EvolucaoResumo> {
    return (await amb.api("POST", `/evolucoes/${id}/retificar`, { texto })).json();
  }

  function trilha(tipoEvento: string) {
    return amb.prisma.auditoria.findMany({
      where:
        tipoEvento === "EVOLUCAO_LIDA"
          ? { tipoEvento, detalhe: { path: ["pacienteId"], equals: paciente.id } }
          : { tipoEvento, recursoId: paciente.id },
    });
  }

  it("contém cadastro, atendimentos e todas as versões, marcadas como vigente ou retificada", async () => {
    const realizado = await amb.prisma.atendimento.create({
      data: {
        pacienteId: paciente.id,
        inicio: new Date("2026-01-10T14:00:00-03:00"),
        fim: new Date("2026-01-10T14:50:00-03:00"),
        valor: "150",
        status: "REALIZADO",
      },
    });
    await amb.prisma.atendimento.create({
      data: {
        pacienteId: paciente.id,
        inicio: new Date("2026-01-17T14:00:00-03:00"),
        fim: new Date("2026-01-17T14:50:00-03:00"),
        valor: "150",
        status: "CANCELADO",
        motivo: "Viagem a trabalho",
      },
    });

    const v1 = await registrar("Primeira escrita da sessão.", realizado.id);
    const v2 = await retificar(v1.id, "Segunda escrita, corrigida.");
    const v3 = await retificar(v2.id, "Terceira escrita, definitiva.");
    const avulsa = await registrar("Contato telefônico com a família.");

    const resposta = await exportar();

    expect(resposta.statusCode).toBe(200);
    expect(resposta.headers["content-type"]).toBe("application/pdf");
    expect(resposta.headers["content-disposition"]).toMatch(
      /^attachment; filename="prontuario-mariana-alves-\d{4}-\d{2}-\d{2}\.pdf"$/,
    );
    expect(resposta.headers["cache-control"]).toBe("no-store");

    const texto = (await paginas(resposta.rawPayload)).join(" ");
    for (const trecho of [
      "Prontuário psicológico",
      "Dados cadastrais",
      "Mariana Alves",
      "(83) 99322-9097",
      "Histórico de atendimentos",
      "10/01/2026, 14:00–14:50 · Realizado",
      "17/01/2026, 14:00–14:50 · Cancelado",
      "Motivo: Viagem a trabalho",
      "Evolução 1 · atendimento de 10/01/2026",
      "Evolução 2 · avulsa",
      "Primeira escrita da sessão.",
      "Segunda escrita, corrigida.",
      "Terceira escrita, definitiva.",
      "Contato telefônico com a família.",
    ]) {
      expect(texto, trecho).toContain(trecho);
    }
    // Versões em ordem, com a marcação de cada uma.
    expect(texto).toMatch(
      /Versão 1 de 3 · registrada em .*? · RETIFICADA Primeira escrita.*Versão 2 de 3 · .*? · RETIFICADA Segunda escrita.*Versão 3 de 3 · .*? · VIGENTE Terceira escrita/,
    );
    expect(texto).toMatch(/registrada em .*? · VIGENTE Contato telefônico/);
    // Valor financeiro não é conteúdo de prontuário.
    expect(texto).not.toContain("150");

    const lidas = await trilha("EVOLUCAO_LIDA");
    expect(lidas.map((l) => l.recursoId).sort()).toEqual([v1.id, v2.id, v3.id, avulsa.id].sort());
    const exportacoes = await trilha("PRONTUARIO_EXPORTADO");
    expect(exportacoes).toHaveLength(1);
    expect(exportacoes[0]).toMatchObject({
      recursoTipo: "PACIENTE",
      ip: "198.51.100.50",
      detalhe: { evolucoes: 2, versoes: 4, atendimentos: 2 },
    });
  });

  it("rodapé em toda página: emissão, profissional, paginação e sigilo", async () => {
    const paragrafo = "Relato extenso da sessão, com detalhes do processo terapêutico. ".repeat(40);
    for (let i = 0; i < 4; i++) await registrar(`${i}: ${paragrafo}`);

    const texto = await paginas((await exportar()).rawPayload);

    expect(texto.length).toBeGreaterThan(1);
    texto.forEach((pagina, i) => {
      expect(pagina).toMatch(/Emitido em \d{2}\/\d{2}\/\d{4} às \d{2}:\d{2} por Profissional/);
      expect(pagina).toContain(`Página ${i + 1} de ${texto.length}`);
      expect(pagina).toContain("Documento sigiloso");
    });
  });

  it("paciente sem evolução: PDF com cadastro e ausência explícita", async () => {
    const resposta = await exportar();

    expect(resposta.statusCode).toBe(200);
    const texto = (await paginas(resposta.rawPayload)).join(" ");
    expect(texto).toContain("Dados cadastrais");
    expect(texto).toContain("Nenhum atendimento registrado.");
    expect(texto).toContain("Nenhuma evolução registrada para este paciente.");

    expect(await trilha("EVOLUCAO_LIDA")).toHaveLength(0);
    expect(await trilha("PRONTUARIO_EXPORTADO")).toHaveLength(1);
  });

  it("caractere sem glifo na fonte aparece anotado, nunca some", async () => {
    await registrar("Humor: ansioso → estável 🙂");

    const texto = (await paginas((await exportar()).rawPayload)).join(" ");

    expect(texto).toContain("ansioso [U+2192] estável [U+1F642]");
  });

  it("paciente arquivado exporta; inexistente é 404 sem registro", async () => {
    await registrar("Última sessão antes do encerramento.");
    await amb.api("POST", `/pacientes/${paciente.id}/arquivar`, {});
    expect((await exportar()).statusCode).toBe(200);

    const inexistente = "0199a0e0-0000-7000-8000-00000000ffff";
    expect((await exportar(inexistente)).statusCode).toBe(404);
    expect(
      await amb.prisma.auditoria.count({
        where: { tipoEvento: "PRONTUARIO_EXPORTADO", recursoId: inexistente },
      }),
    ).toBe(0);
  });
});
