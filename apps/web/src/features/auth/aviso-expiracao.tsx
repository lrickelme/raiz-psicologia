"use client";

import { COOKIE_SESSAO_EXPIRA } from "@raiz/shared";
import { useEffect, useState } from "react";
import { Botao } from "@/components/ui/botao";
import { Modal } from "@/components/ui/modal";

const AVISO_MS = 2 * 60 * 1000;

function lerExpiraEm(): number | null {
  const par = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${COOKIE_SESSAO_EXPIRA}=`));
  if (!par) return null;
  const instante = Date.parse(decodeURIComponent(par.split("=")[1]));
  return Number.isNaN(instante) ? null : instante;
}

function irParaLogin(): void {
  const de = `${window.location.pathname}${window.location.search}`;
  // Navegação completa, não do router: nada do estado em memória sobrevive.
  window.location.replace(`/login?de=${encodeURIComponent(de)}`);
}

function formatar(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutos = Math.floor(total / 60);
  const segundos = String(total % 60).padStart(2, "0");
  return `${minutos}:${segundos}`;
}

/**
 * Avisa quando a sessão está a dois minutos de expirar por inatividade e, se
 * ninguém responder, leva ao login quando ela expira. O prazo vem do cookie
 * `COOKIE_SESSAO_EXPIRA`, relido a cada segundo: assim uma renovação feita em
 * outra aba, ou por qualquer chamada à API, chega aqui sem combinação extra.
 */
export function AvisoExpiracao() {
  const [restanteMs, setRestanteMs] = useState<number | null>(null);
  const [renovando, setRenovando] = useState(false);

  useEffect(() => {
    const atualizar = () => {
      const expiraEm = lerExpiraEm();
      if (expiraEm === null) return setRestanteMs(null);

      const restante = expiraEm - Date.now();
      if (restante <= 0) return irParaLogin();
      setRestanteMs(restante);
    };
    atualizar();
    const intervalo = window.setInterval(atualizar, 1000);
    return () => window.clearInterval(intervalo);
  }, []);

  async function continuar() {
    setRenovando(true);
    try {
      const resposta = await fetch("/api/v1/auth/sessao", { cache: "no-store" });
      if (resposta.status === 401) return irParaLogin();
      const expiraEm = lerExpiraEm();
      if (expiraEm !== null) setRestanteMs(expiraEm - Date.now());
    } finally {
      setRenovando(false);
    }
  }

  async function sair() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    window.location.replace("/login");
  }

  const aberto = restanteMs !== null && restanteMs <= AVISO_MS;

  return (
    <Modal
      aberto={aberto}
      titulo="Sua sessão vai expirar"
      // Fechar o aviso (Esc, clique fora) é sinal de que há alguém diante da
      // tela. O `close` disparado quando o próprio aviso some não conta.
      onFechar={() => {
        if (aberto) void continuar();
      }}
      rodape={
        <>
          <Botao variante="secundario" onClick={sair}>
            Sair
          </Botao>
          <Botao onClick={continuar} disabled={renovando}>
            Continuar conectada
          </Botao>
        </>
      }
    >
      <p>
        Por segurança, a sessão encerra após 30 minutos sem uso. Ela expira em{" "}
        <span className="font-raiz-mono font-medium text-raiz-marrom">
          {formatar(restanteMs ?? 0)}
        </span>
        .
      </p>
    </Modal>
  );
}
