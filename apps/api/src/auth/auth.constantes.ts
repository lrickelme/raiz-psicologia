import type { CookieSerializeOptions } from "@fastify/cookie";

export const COOKIE_SESSAO = "raiz_sessao";

/** Expiração por inatividade (spec auth, "Expiração de sessão por inatividade"). */
export const SESSAO_INATIVIDADE_MS = 30 * 60 * 1000;

export const LOGIN_MAX_FALHAS = 5;
export const LOGIN_JANELA_MS = 5 * 60 * 1000;

/**
 * Sem Max-Age de propósito: a validade é controlada pela tabela `sessao`.
 * `secure: true` sempre — Chrome e Firefox aceitam cookie Secure em
 * http://localhost, então o desenvolvimento local não precisa de exceção.
 */
export const OPCOES_COOKIE: CookieSerializeOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "strict",
  path: "/",
};
