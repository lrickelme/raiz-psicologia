import { useId, type ReactNode } from "react";

type ColunaProps = {
  titulo: string;
  /** Classe de fundo do marcador, como no design-ref. */
  marcador: string;
  contador: number;
  vazio: string;
  /** Um nó por cartão; vazio mostra o estado vazio. */
  cartoes: { id: string; no: ReactNode }[];
  rodape?: ReactNode;
};

/**
 * As três colunas saem deste componente: na change 06 viram abas ou pilha
 * sem reescrever o cartão (design.md, "Frontend").
 */
export function Coluna({ titulo, marcador, contador, vazio, cartoes, rodape }: ColunaProps) {
  const tituloId = useId();
  return (
    <section aria-labelledby={tituloId} className="flex min-w-0 flex-1 flex-col gap-3">
      <header className="flex items-center gap-[9px] px-0.5">
        <span aria-hidden className={`size-[9px] rounded-[3px] ${marcador}`} />
        <h2 id={tituloId} className="font-raiz-display text-[15px] font-semibold text-raiz-marrom">
          {titulo}
        </h2>
        <span className="font-raiz-mono text-raiz-legenda text-raiz-texto-terciario">
          <span className="sr-only">: </span>
          {contador}
          <span className="sr-only"> {contador === 1 ? "tópico" : "tópicos"}</span>
        </span>
      </header>
      {cartoes.length ? (
        <ul className="flex flex-col gap-[11px]">
          {cartoes.map(({ id, no }) => (
            <li key={id}>{no}</li>
          ))}
        </ul>
      ) : (
        <p className="rounded-[13px] border border-dashed border-raiz-borda-forte px-4 py-6 text-center text-raiz-corpo-sm text-raiz-texto-terciario">
          {vazio}
        </p>
      )}
      {rodape}
    </section>
  );
}
