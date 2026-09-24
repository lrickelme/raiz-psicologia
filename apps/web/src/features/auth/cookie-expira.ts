import {
  COOKIE_SESSAO,
  COOKIE_SESSAO_EXPIRA,
  HEADER_SESSAO_EXPIRA,
} from "@raiz/shared";
import type { NextResponse } from "next/server";

/**
 * Leva para o cookie legível pela interface o `expiraEm` que a API anunciou.
 * Some quando a API recusa a sessão (401) ou a encerra (logout apaga o cookie
 * de sessão e não anuncia renovação).
 */
export function sincronizarCookieExpira(upstream: Response, destino: NextResponse): void {
  const encerrou =
    upstream.status === 401 ||
    upstream.headers.getSetCookie().some((c) => c.startsWith(`${COOKIE_SESSAO}=;`));
  if (encerrou) {
    destino.cookies.delete(COOKIE_SESSAO_EXPIRA);
    return;
  }

  const expiraEm = upstream.headers.get(HEADER_SESSAO_EXPIRA);
  if (expiraEm) {
    destino.cookies.set(COOKIE_SESSAO_EXPIRA, expiraEm, {
      path: "/",
      secure: true,
      sameSite: "strict",
    });
  }
}
