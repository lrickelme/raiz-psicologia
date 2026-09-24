"use client";

import { useState } from "react";

/**
 * Encerra a sessão no servidor e volta ao login por navegação completa, para
 * que nada do estado em memória sobreviva (spec auth, "Logout explícito").
 */
export async function sair(): Promise<void> {
  await fetch("/api/v1/auth/logout", { method: "POST" });
  window.location.replace("/login");
}

export function BotaoSair() {
  const [saindo, setSaindo] = useState(false);

  return (
    <button
      type="button"
      aria-label="Sair"
      title="Sair"
      disabled={saindo}
      onClick={() => {
        setSaindo(true);
        void sair();
      }}
      className="ml-auto flex size-[34px] shrink-0 items-center justify-center rounded-raiz-campo text-raiz-texto-inativo hover:bg-raiz-linho-claro/12 hover:text-raiz-areia focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-raiz-areia disabled:opacity-50"
    >
      <svg
        width={18}
        height={18}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4" />
      </svg>
    </button>
  );
}
