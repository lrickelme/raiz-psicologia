"use client";

import { loginSchema } from "@raiz/shared";
import { useEffect, useState, type FormEvent } from "react";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { Modal } from "@/components/ui/modal";
import { protegerEdicao } from "@/features/auth/edicao-protegida";

const FALHA_DE_REDE = "Não foi possível falar com o servidor. Tente de novo.";

/**
 * Estado de sessão de um editor de prontuário. Enquanto `proteger` for
 * verdadeiro (há texto no editor), perder a sessão — por 401 numa chamada do
 * editor ou pelo aviso de expiração do shell — abre a reautenticação em vez
 * de navegar para o login.
 */
export function useSessaoDoEditor(proteger: boolean) {
  const [semSessao, setSemSessao] = useState(false);

  useEffect(() => {
    if (!proteger) return;
    return protegerEdicao(() => setSemSessao(true));
  }, [proteger]);

  return {
    semSessao,
    perdeuSessao: () => setSemSessao(true),
    reautenticou: () => setSemSessao(false),
  };
}

type ModalReautenticacaoProps = {
  aberto: boolean;
  onEntrou: () => void;
};

/**
 * Login sem sair da página: o editor continua montado por trás, com o texto
 * intacto em memória. Não fecha por Esc nem clique fora — a alternativa
 * explícita é ir ao login e perder o trecho não salvo.
 */
export function ModalReautenticacao({ aberto, onEntrou }: ModalReautenticacaoProps) {
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const validacao = loginSchema.safeParse(Object.fromEntries(new FormData(formulario)));
    if (!validacao.success) {
      setErro("Informe e-mail e senha.");
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      const resposta = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validacao.data),
      });
      if (resposta.ok) {
        formulario.reset();
        onEntrou();
        return;
      }
      const problema: { detail?: string } = await resposta.json().catch(() => ({}));
      setErro(problema.detail ?? FALHA_DE_REDE);
    } catch {
      setErro(FALHA_DE_REDE);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal aberto={aberto} titulo="Sua sessão expirou" onFechar={() => {}} fechavel={false}>
      <form onSubmit={entrar} noValidate className="flex flex-col gap-4">
        <p>
          Entre de novo para continuar. O texto que você está escrevendo continua aqui e será
          salvo assim que a sessão voltar.
        </p>
        <Campo rotulo="E-mail" name="email" type="email" autoComplete="username" />
        <Campo rotulo="Senha" name="senha" type="password" autoComplete="current-password" />
        {erro && (
          <p
            role="alert"
            className="rounded-raiz-campo bg-raiz-vinho-suave px-3.5 py-2.5 text-raiz-corpo-sm font-semibold text-raiz-vinho"
          >
            {erro}
          </p>
        )}
        <div className="flex justify-end gap-2.5">
          <Botao
            variante="secundario"
            onClick={() => {
              if (window.confirm("Ir para o login descarta o texto ainda não salvo. Continuar?")) {
                window.location.replace("/login");
              }
            }}
          >
            Ir para o login
          </Botao>
          <Botao type="submit" disabled={enviando}>
            {enviando ? "Entrando…" : "Entrar e continuar"}
          </Botao>
        </div>
      </form>
    </Modal>
  );
}
