import { Algorithm, hash, verify } from "@node-rs/argon2";

/** Parâmetros mínimos recomendados pelo OWASP para Argon2id (19 MiB, t=2, p=1). */
const OPCOES_ARGON2 = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

export function gerarHashSenha(senha: string): Promise<string> {
  return hash(senha, OPCOES_ARGON2);
}

/**
 * O custo da verificação vem dos parâmetros gravados no próprio hash. Como o
 * hash de descarte do AuthService nasce de `gerarHashSenha`, verificar contra
 * ele custa o mesmo que verificar contra a senha real.
 */
export async function verificarSenha(
  hashArmazenado: string,
  senha: string,
): Promise<boolean> {
  try {
    return await verify(hashArmazenado, senha);
  } catch {
    return false;
  }
}
