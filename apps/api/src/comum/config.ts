function inteiroDoAmbiente(nome: string, padrao: number): number {
  const bruto = process.env[nome];
  if (bruto === undefined || bruto.trim() === "") return padrao;

  const valor = Number(bruto);
  if (!Number.isInteger(valor) || valor < 0) {
    throw new Error(`${nome} deve ser um inteiro não negativo (recebido: "${bruto}")`);
  }
  return valor;
}

/**
 * Piso de tempo das recusas de login, em milissegundos. Os dois 401 — e-mail
 * inexistente e senha incorreta — têm status e corpo idênticos, então o tempo
 * seria a última coisa capaz de separá-los; o piso fecha essa brecha.
 *
 * Não se aplica ao 204: o sucesso já se distingue pelo status e pelo
 * `Set-Cookie`, e segurá-lo custaria latência sem esconder nada. Também não
 * alcança o 422 de payload inválido nem o 429 do rate limit, que são
 * recusados antes de consultar qualquer conta.
 *
 * O padrão de 600 ms fica muito acima do trabalho real medido nesta máquina —
 * p99 de 21 ms ponta a ponta, com o Argon2id em 13,6 ms. A folga é o que
 * impede o piso de vazar: se o trabalho ultrapassar o alvo, a resposta atrasa
 * junto e a diferença volta a aparecer. Ao trocar os parâmetros do Argon2 ou
 * rodar em máquina mais lenta, meça de novo e suba este valor.
 */
export const LOGIN_PISO_MS = inteiroDoAmbiente("RAIZ_LOGIN_PISO_MS", 600);
