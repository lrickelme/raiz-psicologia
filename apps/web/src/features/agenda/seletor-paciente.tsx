"use client";

import type { Pagina, Paciente } from "@raiz/shared";
import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { chamarApi } from "@/lib/api-cliente";
import { formatarDinheiro } from "@/lib/formatar";

type Props = {
  selecionado: Paciente | null;
  onSelecionar: (paciente: Paciente | null) => void;
  erro?: string;
};

/** Busca só pacientes ativos: arquivado não aparece para agendar (spec agenda). */
export function SeletorPaciente({ selecionado, onSelecionar, erro }: Props) {
  const id = useId();
  const [busca, setBusca] = useState("");
  const { data, isFetching } = useQuery({
    queryKey: ["pacientes", "seletor", busca.trim()],
    queryFn: () => {
      const params = new URLSearchParams({ status: "ATIVO", size: "8" });
      if (busca.trim()) params.set("busca", busca.trim());
      return chamarApi<Pagina<Paciente>>(`/pacientes?${params}`);
    },
    enabled: !selecionado,
  });

  if (selecionado) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-raiz-corpo-sm font-semibold text-raiz-marrom">Paciente</span>
        <div className="flex items-center justify-between gap-3 rounded-raiz-campo border-[1.5px] border-raiz-borda-forte bg-raiz-superficie px-3.5 py-[9px]">
          <span className="font-semibold text-raiz-marrom">{selecionado.nome}</span>
          <button
            type="button"
            onClick={() => onSelecionar(null)}
            className="text-raiz-corpo-sm font-semibold text-raiz-vinho hover:underline"
          >
            Trocar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-raiz-corpo-sm font-semibold text-raiz-marrom">
        Paciente
      </label>
      <input
        id={id}
        type="search"
        autoFocus
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nome ou telefone"
        aria-invalid={erro ? true : undefined}
        className={`rounded-raiz-campo border-[1.5px] bg-raiz-superficie px-3.5 py-[11px] text-raiz-corpo text-raiz-marrom placeholder:text-raiz-texto-terciario focus:outline-none ${
          erro ? "border-raiz-vinho" : "border-raiz-borda-forte focus:border-raiz-vinho"
        }`}
      />
      <ul className="flex max-h-[200px] flex-col overflow-y-auto rounded-raiz-campo border border-raiz-borda">
        {data?.itens.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onSelecionar(p)}
              className="flex w-full items-center justify-between gap-3 px-3.5 py-2 text-left hover:bg-raiz-areia focus-visible:bg-raiz-areia focus-visible:outline-none"
            >
              <span className="text-raiz-corpo text-raiz-marrom">{p.nome}</span>
              <span className="font-raiz-mono text-raiz-legenda text-raiz-texto-terciario">
                {formatarDinheiro(p.valorConsultaPadrao)}
              </span>
            </button>
          </li>
        ))}
        {data && !data.itens.length && (
          <li className="px-3.5 py-2 text-raiz-corpo-sm text-raiz-texto-terciario">
            {isFetching ? "Buscando…" : "Nenhum paciente ativo encontrado."}
          </li>
        )}
      </ul>
      {erro && <p className="text-raiz-legenda font-semibold text-raiz-vinho">{erro}</p>}
    </div>
  );
}
