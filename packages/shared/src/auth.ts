import { z } from "zod";

/** Cookie `HttpOnly` com o token da sessão. */
export const COOKIE_SESSAO = "raiz_sessao";

/**
 * Header que a API devolve em toda resposta autenticada com o novo `expiraEm`.
 * O BFF o copia para `COOKIE_SESSAO_EXPIRA`, que não é `HttpOnly` e só carrega
 * o instante: é por ele que a interface sabe quando avisar da expiração, e
 * como o cookie é compartilhado, uma aba vê a renovação feita por outra.
 */
export const HEADER_SESSAO_EXPIRA = "x-sessao-expira-em";
export const COOKIE_SESSAO_EXPIRA = "raiz_sessao_expira";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  senha: z.string().min(1, "Informe a senha"),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** Corpo de `GET /api/v1/auth/sessao`. */
export type SessaoCorrente = {
  usuario: { id: string; nome: string; email: string };
  /** ISO-8601. A interface usa para avisar quando a expiração se aproxima. */
  expiraEm: string;
};
