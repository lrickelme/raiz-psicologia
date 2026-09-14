import type { HTMLAttributes, ReactNode } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  titulo?: ReactNode;
  acoes?: ReactNode;
};

export function Card({
  titulo,
  acoes,
  children,
  className = "",
  ...props
}: CardProps) {
  return (
    <section
      className={`rounded-raiz-card border border-raiz-borda bg-raiz-superficie p-5 ${className}`}
      {...props}
    >
      {(titulo || acoes) && (
        <header className="mb-3.5 flex items-center justify-between gap-4">
          {titulo && (
            <h2 className="font-raiz-display text-raiz-titulo-card font-semibold text-raiz-marrom">
              {titulo}
            </h2>
          )}
          {acoes}
        </header>
      )}
      {children}
    </section>
  );
}
