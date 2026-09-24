import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { API_INTERNAL_URL } from "@/lib/api-interna";

/**
 * GET na API a partir de Server Component, com o cookie da requisição e o IP
 * de origem (a trilha de auditoria registra quem acessou). Sessão vencida
 * leva ao login; recurso inexistente — ou id malformado, que a API recusa com
 * 400 — vira a página 404 do Next.
 */
export async function buscarNaApi<T>(caminho: string): Promise<T> {
  const recebidos = await headers();
  const repassados = new Headers({ cookie: recebidos.get("cookie") ?? "" });
  const origem = recebidos.get("x-forwarded-for");
  if (origem) repassados.set("x-forwarded-for", origem);

  const resposta = await fetch(`${API_INTERNAL_URL}/api/v1${caminho}`, {
    headers: repassados,
    cache: "no-store",
  });
  if (resposta.status === 401) redirect("/login");
  if (resposta.status === 404 || resposta.status === 400) notFound();
  if (!resposta.ok) {
    throw new Error(`API respondeu ${resposta.status} em GET ${caminho}`);
  }
  return resposta.json();
}
