export type CampoInvalido = { caminho: string; mensagem: string };

/** Erro da API em RFC 7807, com os campos inválidos quando é um 422. */
export class ErroApi extends Error {
  constructor(
    readonly status: number,
    mensagem: string,
    readonly campos: CampoInvalido[] = [],
    readonly corpo: Record<string, unknown> = {},
  ) {
    super(mensagem);
  }
}

const FALHA_DE_REDE = "Não foi possível falar com o servidor. Tente de novo.";

/**
 * Chamada à API pelo BFF, a partir do navegador. Sessão vencida leva ao login
 * com navegação completa, para não sobrar estado em memória.
 */
export async function chamarApi<T>(
  caminho: string,
  { corpo, ...init }: Omit<RequestInit, "body"> & { corpo?: unknown } = {},
): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(`/api/v1${caminho}`, {
      ...init,
      headers: corpo === undefined ? init.headers : { "Content-Type": "application/json" },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
  } catch {
    throw new ErroApi(0, FALHA_DE_REDE);
  }

  if (resposta.status === 401) {
    const de = `${window.location.pathname}${window.location.search}`;
    window.location.replace(`/login?de=${encodeURIComponent(de)}`);
  }
  if (resposta.status === 204) return undefined as T;

  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new ErroApi(resposta.status, dados.detail ?? FALHA_DE_REDE, dados.campos, dados);
  }
  return dados as T;
}
