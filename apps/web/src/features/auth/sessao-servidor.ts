import type { SessaoCorrente } from "@raiz/shared";
import { headers } from "next/headers";
import { API_INTERNAL_URL } from "@/lib/api-interna";

/** Sessão corrente vista pela API, ou `null` se não houver sessão válida. */
export async function obterSessao(): Promise<SessaoCorrente | null> {
  const cookie = (await headers()).get("cookie");
  if (!cookie) return null;

  const resposta = await fetch(`${API_INTERNAL_URL}/api/v1/auth/sessao`, {
    headers: { cookie },
    cache: "no-store",
  });
  if (resposta.status === 401) return null;
  if (!resposta.ok) {
    throw new Error(`API respondeu ${resposta.status} ao consultar a sessão`);
  }
  return resposta.json();
}
