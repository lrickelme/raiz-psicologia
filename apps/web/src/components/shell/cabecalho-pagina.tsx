import type { ReactNode } from "react";

type CabecalhoPaginaProps = {
  titulo: string;
  descricao?: string;
  acoes?: ReactNode;
};

export function CabecalhoPagina({ titulo, descricao, acoes }: CabecalhoPaginaProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-raiz-borda bg-raiz-superficie px-raiz-conteudo-x pt-6 pb-[18px]">
      <div>
        <h1 className="font-raiz-display text-raiz-titulo font-semibold text-raiz-marrom">
          {titulo}
        </h1>
        {descricao && (
          <p className="mt-1 text-raiz-corpo-sm text-raiz-texto-terciario">{descricao}</p>
        )}
      </div>
      {acoes && <div className="flex items-center gap-3">{acoes}</div>}
    </header>
  );
}
