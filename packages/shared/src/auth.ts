import { z } from "zod";

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
