"use client";

import { useEffect, useRef, type ReactNode } from "react";

type ModalProps = {
  aberto: boolean;
  titulo: string;
  onFechar: () => void;
  children: ReactNode;
  rodape?: ReactNode;
};

export function Modal({ aberto, titulo, onFechar, children, rodape }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (aberto && !dialog.open) dialog.showModal();
    if (!aberto && dialog.open) dialog.close();
  }, [aberto]);

  return (
    <dialog
      ref={ref}
      onClose={onFechar}
      onClick={(e) => {
        if (e.target === ref.current) onFechar();
      }}
      className="m-auto w-full max-w-[520px] rounded-raiz-painel border border-raiz-borda bg-raiz-superficie p-0 text-raiz-marrom shadow-raiz-moldura backdrop:bg-raiz-marrom/40"
    >
      <div className="flex flex-col gap-4 p-6">
        <header className="flex items-start justify-between gap-4">
          <h2 className="font-raiz-display text-raiz-titulo-secao font-semibold">
            {titulo}
          </h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded-full px-2 text-raiz-texto-terciario hover:bg-raiz-sand hover:text-raiz-marrom"
          >
            ✕
          </button>
        </header>
        <div className="text-raiz-corpo text-raiz-texto-secundario">{children}</div>
        {rodape && <footer className="flex justify-end gap-2.5">{rodape}</footer>}
      </div>
    </dialog>
  );
}
