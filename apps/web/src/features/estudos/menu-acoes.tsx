"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

export type GrupoMenu = { titulo?: string; itens: { rotulo: string; nome?: string; acao: () => void }[] };

/**
 * Menu de ações no padrão "menu button" da WAI-ARIA: abre por clique, Enter ou
 * seta; setas, Home e End navegam; Esc e Tab fecham. Nada depende de `hover`
 * (spec estudos, "Estados do tópico").
 */
export function MenuAcoes({ rotulo, grupos }: { rotulo: string; grupos: GrupoMenu[] }) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const gatilho = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const itens = () => [...(raiz.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];

  useEffect(() => {
    if (!aberto) return;
    itens()[0]?.focus();
    const fora = (evento: PointerEvent) => {
      if (!raiz.current?.contains(evento.target as Node)) setAberto(false);
    };
    document.addEventListener("pointerdown", fora);
    return () => document.removeEventListener("pointerdown", fora);
  }, [aberto]);

  function fechar(devolverFoco: boolean) {
    setAberto(false);
    if (devolverFoco) gatilho.current?.focus();
  }

  function teclaNoGatilho(evento: KeyboardEvent) {
    if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
      evento.preventDefault();
      setAberto(true);
    }
  }

  function teclaNoMenu(evento: KeyboardEvent) {
    const lista = itens();
    const atual = lista.indexOf(document.activeElement as HTMLElement);
    const focar = (i: number) => lista[(i + lista.length) % lista.length]?.focus();
    if (evento.key === "ArrowDown") focar(atual + 1);
    else if (evento.key === "ArrowUp") focar(atual - 1);
    else if (evento.key === "Home") focar(0);
    else if (evento.key === "End") focar(lista.length - 1);
    else if (evento.key === "Escape") fechar(true);
    else if (evento.key === "Tab") return fechar(false);
    else return;
    evento.preventDefault();
  }

  return (
    <div ref={raiz} className="relative">
      <button
        ref={gatilho}
        type="button"
        aria-label={rotulo}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? menuId : undefined}
        onClick={() => setAberto((a) => !a)}
        onKeyDown={teclaNoGatilho}
        className="flex size-6 items-center justify-center rounded-full text-raiz-texto-terciario hover:bg-raiz-sand hover:text-raiz-marrom focus-visible:outline-2 focus-visible:outline-raiz-vinho"
      >
        <span aria-hidden className="text-[15px] leading-none tracking-[-1px]">
          ⋯
        </span>
      </button>
      {aberto && (
        <div
          id={menuId}
          role="menu"
          aria-label={rotulo}
          onKeyDown={teclaNoMenu}
          className="absolute top-full right-0 z-10 mt-1 flex min-w-44 flex-col rounded-raiz-campo border border-raiz-borda bg-raiz-superficie py-1.5 shadow-raiz-moldura"
        >
          {grupos.map((grupo, i) => (
            <div
              key={i}
              role="group"
              aria-label={grupo.titulo}
              className={i > 0 ? "mt-1.5 border-t border-raiz-borda pt-1.5" : undefined}
            >
              {grupo.titulo && (
                <p aria-hidden className="px-3.5 pb-1 text-raiz-legenda text-raiz-texto-terciario">
                  {grupo.titulo}
                </p>
              )}
              {grupo.itens.map((item) => (
                <button
                  key={item.rotulo}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  aria-label={item.nome}
                  onClick={() => {
                    fechar(true);
                    item.acao();
                  }}
                  className="block w-full px-3.5 py-1.5 text-left text-raiz-corpo-sm font-semibold text-raiz-marrom hover:bg-raiz-sand focus:bg-raiz-sand focus:outline-none"
                >
                  {item.rotulo}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
