"use client";

import { loginSchema } from "@raiz/shared";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";

type ErrosCampo = { email?: string; senha?: string };
type Problema = { detail?: string; campos?: { caminho: string; mensagem: string }[] };

const FALHA_DE_REDE = "Não foi possível falar com o servidor. Tente de novo.";

export function FormularioLogin({ destino }: { destino: string }) {
  const router = useRouter();
  const [erros, setErros] = useState<ErrosCampo>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErroGeral(null);

    const validacao = loginSchema.safeParse(
      Object.fromEntries(new FormData(evento.currentTarget)),
    );
    if (!validacao.success) {
      const { email, senha } = validacao.error.flatten().fieldErrors;
      setErros({ email: email?.[0], senha: senha?.[0] });
      return;
    }
    setErros({});

    setEnviando(true);
    try {
      const resposta = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validacao.data),
      });
      if (resposta.ok) {
        router.replace(destino);
        return;
      }

      const problema: Problema = await resposta.json().catch(() => ({}));
      if (resposta.status === 422 && problema.campos) {
        setErros(
          Object.fromEntries(problema.campos.map((c) => [c.caminho, c.mensagem])),
        );
      } else {
        setErroGeral(problema.detail ?? FALHA_DE_REDE);
      }
    } catch {
      setErroGeral(FALHA_DE_REDE);
    }
    setEnviando(false);
  }

  return (
    <form onSubmit={entrar} noValidate className="flex flex-col gap-4">
      <Campo
        rotulo="E-mail"
        name="email"
        type="email"
        autoComplete="username"
        autoFocus
        erro={erros.email}
      />
      <Campo
        rotulo="Senha"
        name="senha"
        type="password"
        autoComplete="current-password"
        erro={erros.senha}
      />

      {erroGeral && (
        <p
          role="alert"
          className="rounded-raiz-campo bg-raiz-vinho-suave px-3.5 py-2.5 text-raiz-corpo-sm font-semibold text-raiz-vinho"
        >
          {erroGeral}
        </p>
      )}

      <Botao type="submit" disabled={enviando} className="mt-1 w-full">
        {enviando ? "Entrando…" : "Entrar"}
      </Botao>
    </form>
  );
}
