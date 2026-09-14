import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { gerarHashSenha } from "../src/auth/senha";

const prisma = new PrismaClient();

function variavelObrigatoria(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Defina ${nome} em apps/api/.env (ver .env.example)`);
  return valor;
}

/**
 * Provisiona ou redefine a credencial única da profissional. Não existe rota
 * de cadastro (spec auth): este é o único caminho para criar a conta ou trocar
 * a senha. Qualquer outro usuário é removido, mantendo o sistema single-tenant.
 */
async function provisionarCredencial() {
  const email = variavelObrigatoria("RAIZ_EMAIL").trim().toLowerCase();
  const nome = variavelObrigatoria("RAIZ_NOME");
  const senhaHash = await gerarHashSenha(variavelObrigatoria("RAIZ_SENHA"));

  await prisma.usuario.deleteMany({ where: { email: { not: email } } });
  await prisma.usuario.upsert({
    where: { email },
    create: { email, nome, senhaHash },
    update: { nome, senhaHash },
  });
  console.log(`Credencial provisionada para ${email}.`);
}

// Dados fictícios de desenvolvimento entram na tarefa 7.1 do tasks.md.
async function main() {
  await provisionarCredencial();
}

main().finally(() => prisma.$disconnect());
