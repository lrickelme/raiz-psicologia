"use client";

import type { DataLocal } from "@raiz/shared";
import { deslocar, ehPadrao, periodo, periodoPadrao, rotulo, type Periodo, type TipoPeriodo } from "./periodo";

const OPCOES: { tipo: TipoPeriodo; rotulo: string }[] = [
  { tipo: "mes", rotulo: "Mês" },
  { tipo: "trimestre", rotulo: "Trimestre" },
  { tipo: "ano", rotulo: "Ano" },
];

const seta =
  "grid size-8 place-items-center rounded-full border-[1.5px] border-raiz-borda-forte text-raiz-marrom hover:bg-raiz-sand focus-visible:outline-2 focus-visible:outline-raiz-vinho";

/** Controle segmentado do design-ref, mais navegação para o período anterior e o seguinte. */
export function FiltroPeriodo({
  valor,
  hoje,
  onChange,
}: {
  valor: Periodo;
  hoje: DataLocal;
  onChange: (p: Periodo) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        role="radiogroup"
        aria-label="Tipo de período"
        className="flex rounded-full border border-raiz-borda bg-raiz-sand p-[3px]"
      >
        {OPCOES.map((opcao) => {
          const ativo = valor.tipo === opcao.tipo;
          return (
            <button
              key={opcao.tipo}
              type="button"
              role="radio"
              aria-checked={ativo}
              // Trocar o tipo mantém o ponto do calendário em que se está.
              onClick={() => onChange(periodo(opcao.tipo, valor.ref))}
              className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold ${
                ativo
                  ? "bg-raiz-superficie text-raiz-marrom shadow-raiz-segmento"
                  : "text-raiz-texto-terciario hover:text-raiz-marrom"
              }`}
            >
              {opcao.rotulo}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <button type="button" aria-label="Período anterior" className={seta} onClick={() => onChange(deslocar(valor, -1))}>
          ‹
        </button>
        <span
          aria-live="polite"
          className="min-w-[11.5rem] text-center text-raiz-corpo font-semibold text-raiz-marrom first-letter:uppercase"
        >
          {rotulo(valor)}
        </span>
        <button type="button" aria-label="Período seguinte" className={seta} onClick={() => onChange(deslocar(valor, 1))}>
          ›
        </button>
      </div>

      {!ehPadrao(valor, hoje) && (
        <button
          type="button"
          onClick={() => onChange(periodoPadrao(hoje))}
          className="text-raiz-corpo-sm font-semibold text-raiz-vinho hover:underline"
        >
          Mês atual
        </button>
      )}
    </div>
  );
}
