import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITMO = "aes-256-gcm";
const VERSAO = "v1";
const TAMANHO_CHAVE = 32;
const TAMANHO_IV = 12;

export const VARIAVEL_CHAVE = "RAIZ_CHAVE_CRIPTOGRAFIA";

/**
 * Lê a chave de `RAIZ_CHAVE_CRIPTOGRAFIA` (32 bytes em base64). Lança se ela
 * faltar ou tiver o tamanho errado — chamada na construção do PrismaService,
 * isso impede o boot em vez de deixar a API subir e gravar dado clínico em
 * claro ou ilegível.
 */
export function carregarChave(ambiente: NodeJS.ProcessEnv = process.env): Buffer {
  const bruta = ambiente[VARIAVEL_CHAVE]?.trim();
  if (!bruta) {
    throw new Error(
      `${VARIAVEL_CHAVE} não definida. Gere com \`openssl rand -base64 32\` e ` +
        "coloque em apps/api/.env (ver .env.example).",
    );
  }
  const chave = Buffer.from(bruta, "base64");
  if (chave.length !== TAMANHO_CHAVE) {
    throw new Error(
      `${VARIAVEL_CHAVE} deve ter ${TAMANHO_CHAVE} bytes em base64 (recebidos ${chave.length}).`,
    );
  }
  return chave;
}

/**
 * AES-256-GCM com IV aleatório por valor. O `contexto` (modelo.campo) entra
 * como dado autenticado: um valor copiado para outra coluna não decifra.
 * Formato gravado: `v1.<iv>.<tag>.<cifrado>`, em base64url — a versão abre
 * caminho para rotação de chave sem migrar tudo de uma vez.
 */
export function cifrar(texto: string, chave: Buffer, contexto: string): string {
  const iv = randomBytes(TAMANHO_IV);
  const cifra = createCipheriv(ALGORITMO, chave, iv).setAAD(Buffer.from(contexto));
  const cifrado = Buffer.concat([cifra.update(texto, "utf8"), cifra.final()]);
  return [VERSAO, iv, cifra.getAuthTag(), cifrado]
    .map((parte) => (typeof parte === "string" ? parte : parte.toString("base64url")))
    .join(".");
}

export function decifrar(valor: string, chave: Buffer, contexto: string): string {
  const [versao, iv, tag, cifrado, ...sobra] = valor.split(".");
  if (versao !== VERSAO || !iv || !tag || cifrado === undefined || sobra.length) {
    // Nunca devolver o valor como veio: se ele está em claro no banco, isso é
    // um defeito a ser visto, não algo a esconder.
    throw new Error(`Valor de ${contexto} não está no formato cifrado esperado`);
  }
  const decifra = createDecipheriv(ALGORITMO, chave, Buffer.from(iv, "base64url"))
    .setAAD(Buffer.from(contexto))
    .setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decifra.update(Buffer.from(cifrado, "base64url")),
    decifra.final(),
  ]).toString("utf8");
}
