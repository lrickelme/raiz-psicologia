"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

type ModalProps = {
  aberto: boolean;
  titulo: string;
  onFechar: () => void;
  children: ReactNode;
  rodape?: ReactNode;
  /**
   * `false` impede fechar por Esc, clique fora ou ✕: a saída é pelas ações
   * do próprio modal. Para decisões que não podem ser adiadas.
   */
  fechavel?: boolean;
  /** Para conteúdo de leitura longa, como o histórico de versões. */
  largo?: boolean;
};

export function Modal({
  aberto,
  titulo,
  onFechar,
  children,
  rodape,
  fechavel = true,
  largo = false,
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const tituloId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (aberto && !dialog.open) dialog.showModal();
    if (!aberto && dialog.open) dialog.close();
  }, [aberto]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={tituloId}
      onClose={onFechar}
      onCancel={(e) => {
        if (!fechavel) e.preventDefault();
      }}
      onClick={(e) => {
        if (fechavel && e.target === ref.current) onFechar();
      }}
      className={`m-auto w-full ${largo ? "max-w-[760px]" : "max-w-[520px]"} rounded-raiz-painel border border-raiz-borda bg-raiz-superficie p-0 text-raiz-marrom shadow-raiz-moldura backdrop:bg-raiz-marrom/40`}
    >
      <div className="flex flex-col gap-4 p-6">
        <header className="flex items-start justify-between gap-4">
          <h2 id={tituloId} className="font-raiz-display text-raiz-titulo-secao font-semibold">
            {titulo}
          </h2>
          {fechavel && (
            <button
              type="button"
              onClick={onFechar}
              aria-label="Fechar"
              className="rounded-full px-2 text-raiz-texto-terciario hover:bg-raiz-sand hover:text-raiz-marrom"
            >
              ✕
            </button>
          )}
        </header>
        <div className="text-raiz-corpo text-raiz-texto-secundario">{children}</div>
        {rodape && <footer className="flex justify-end gap-2.5">{rodape}</footer>}
      </div>
    </dialog>
  );
}
