import "dotenv/config";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { CAMPOS_CRIPTOGRAFADOS } from "../src/comum/criptografia/campos";
import { carregarChave } from "../src/comum/criptografia/cifra";
import { criptografiaDeColuna } from "../src/comum/criptografia/extensao";

/**
 * uso: tsx scripts/verificar-restauracao.ts <url-origem> <url-restaurado>
 *
 * Confirma que um backup restaurado volta legível pela aplicação (spec
 * prontuario, "Backup verificado"): lê os dois bancos pela mesma extensão de
 * criptografia da API, com a `RAIZ_CHAVE_CRIPTOGRAFIA` do ambiente, e
 * compara o texto decifrado. Qualquer valor que não decifre derruba o script.
 */
function cliente(url: string) {
  return new PrismaClient({ datasourceUrl: url }).$extends(
    criptografiaDeColuna(CAMPOS_CRIPTOGRAFADOS, carregarChave()),
  );
}

async function retrato(url: string) {
  const prisma = cliente(url);
  try {
    const evolucoes = await prisma.evolucao.findMany({
      select: { id: true, texto: true, vigente: true, retificaDeId: true },
      orderBy: { id: "asc" },
    });
    const motivos = await prisma.atendimento.findMany({
      select: { id: true, motivo: true },
      orderBy: { id: "asc" },
    });
    const rascunhos = await prisma.rascunhoEvolucao.findMany({
      select: { id: true, texto: true },
      orderBy: { id: "asc" },
    });
    const resumo = (dados: unknown) => createHash("sha256").update(JSON.stringify(dados)).digest("hex");
    return {
      pacientes: await prisma.paciente.count(),
      evolucoes: evolucoes.length,
      atendimentos: motivos.length,
      rascunhos: rascunhos.length,
      auditoria: await prisma.auditoria.count(),
      conteudo: resumo({ evolucoes, motivos, rascunhos }),
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const [origem, restaurado] = process.argv.slice(2);
  if (!origem || !restaurado) throw new Error("uso: verificar-restauracao.ts <url-origem> <url-restaurado>");

  const [antes, depois] = await Promise.all([retrato(origem), retrato(restaurado)]);
  console.table({ origem: antes, restaurado: depois });

  const iguais = JSON.stringify(antes) === JSON.stringify(depois);
  if (!iguais) {
    console.error("A restauração difere da origem.");
    process.exitCode = 1;
    return;
  }
  console.log(
    `Restauração verificada: ${depois.evolucoes} evoluções e ${depois.atendimentos} atendimentos ` +
      "decifrados com a chave da aplicação, idênticos à origem.",
  );
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
