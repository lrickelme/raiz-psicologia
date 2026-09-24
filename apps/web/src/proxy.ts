import { COOKIE_SESSAO, COOKIE_SESSAO_EXPIRA } from "@raiz/shared";
import { NextResponse, type NextRequest } from "next/server";
import { sincronizarCookieExpira } from "@/features/auth/cookie-expira";
import { API_INTERNAL_URL } from "@/lib/api-interna";

function paraLogin(request: NextRequest): NextResponse {
  const url = new URL("/login", request.url);
  const { pathname, search } = request.nextUrl;
  if (pathname !== "/") url.searchParams.set("de", `${pathname}${search}`);
  return NextResponse.redirect(url);
}

/**
 * Toda rota de página exige sessão. Sem cookie, vai direto para o login; com
 * cookie, a API confirma a sessão — e a renova, porque navegar é atividade. A
 * resposta atualiza o cookie de expiração que o aviso da interface lê.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  if (!request.cookies.has(COOKIE_SESSAO)) return paraLogin(request);

  const upstream = await fetch(`${API_INTERNAL_URL}/api/v1/auth/sessao`, {
    headers: { cookie: request.headers.get("cookie") ?? "" },
    cache: "no-store",
  });

  if (upstream.status === 401) {
    const resposta = paraLogin(request);
    resposta.cookies.delete(COOKIE_SESSAO);
    resposta.cookies.delete(COOKIE_SESSAO_EXPIRA);
    return resposta;
  }
  if (!upstream.ok) {
    throw new Error(`API respondeu ${upstream.status} ao validar a sessão`);
  }

  const resposta = NextResponse.next();
  sincronizarCookieExpira(upstream, resposta);
  return resposta;
}

export const config = {
  matcher: [
    {
      // Fora: o BFF (a API responde 401 por conta própria), o login, os
      // assets do Next e arquivos com extensão.
      source: "/((?!api/|login|_next/|.*\\.).*)",
      // Prefetch não é atividade: se renovasse a sessão, links visíveis na
      // tela a manteriam viva sozinha. O layout `(app)` barra a renderização
      // de prefetch sem sessão.
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
