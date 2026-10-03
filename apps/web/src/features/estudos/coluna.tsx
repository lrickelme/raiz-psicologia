import type { StatusTopico } from "@raiz/shared";
import { useId, useState, type DragEvent, type ReactNode } from "react";
import { TIPO_ARRASTO } from "./cartao-topico";

type ColunaProps = {
  status: StatusTopico;
  titulo: string;
  /** Classe de fundo do marcador, como no design-ref. */
  marcador: string;
  contador: number;
  vazio: string;
  /** Um nó por cartão; vazio mostra o estado vazio. */
  cartoes: { id: string; no: ReactNode }[];
  rodape?: ReactNode;
  /** Id do tópico solto na coluna. */
  onSoltar: (id: string) => void;
};

/**
 * As três colunas saem deste componente: na change 06 viram abas ou pilha
 * sem reescrever o cartão (design.md, "Frontend").
 */
export function Coluna({ status, titulo, marcador, contador, vazio, cartoes, rodape, onSoltar }: ColunaProps) {
  const tituloId = useId();
  const [alvo, setAlvo] = useState(false);

  const aceita = (evento: DragEvent) => evento.dataTransfer.types.includes(TIPO_ARRASTO);

  return (
    <section
      aria-labelledby={tituloId}
      data-status={status}
      // Alvo do foco quando o último cartão sai da coluna (design.md, "Frontend").
      tabIndex={-1}
      onDragOver={(evento) => {
        if (!aceita(evento)) return;
        evento.preventDefault();
        evento.dataTransfer.dropEffect = "move";
        setAlvo(true);
      }}
      onDragLeave={(evento) => {
        if (!evento.currentTarget.contains(evento.relatedTarget as Node | null)) setAlvo(false);
      }}
      onDrop={(evento) => {
        if (!aceita(evento)) return;
        evento.preventDefault();
        setAlvo(false);
        onSoltar(evento.dataTransfer.getData(TIPO_ARRASTO));
      }}
      className={`flex min-w-0 flex-1 flex-col gap-3 rounded-[13px] outline-offset-4 focus-visible:outline-2 focus-visible:outline-raiz-vinho ${
        alvo ? "outline-2 outline-dashed outline-raiz-musgo" : ""
      }`}
    >
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
