"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Status = "ATIVO" | "ARQUIVADO" | "TODOS";

const OPCOES: { valor: Status; rotulo: string }[] = [
  { valor: "ATIVO", rotulo: "Ativos" },
  { valor: "ARQUIVADO", rotulo: "Arquivados" },
  { valor: "TODOS", rotulo: "Todos" },
];

const ESPERA_MS = 250;

/**
 * Busca e filtro vivem na URL: a listagem é renderizada no servidor a partir
 * deles, e um link ou o botão voltar reproduzem o mesmo estado.
 */
export function FiltrosPacientes({ busca, status }: { busca: string; status: Status }) {
  const router = useRouter();
  const pathname = usePathname();
  const [texto, setTexto] = useState(busca);
  const primeira = useRef(true);

  function navegar(novaBusca: string, novoStatus: Status) {
    const params = new URLSearchParams();
    if (novaBusca.trim()) params.set("busca", novaBusca.trim());
    if (novoStatus !== "ATIVO") params.set("status", novoStatus);
    const query = params.toString();
    // Filtro novo volta para a primeira página.
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    const espera = setTimeout(() => navegar(texto, status), ESPERA_MS);
    return () => clearTimeout(espera);
    // Só o texto dispara a busca com espera; o status navega na hora.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex min-w-[240px] flex-1 items-center gap-2 rounded-full border-[1.5px] border-raiz-borda-forte bg-raiz-superficie px-4 py-2 focus-within:border-raiz-vinho">
        <svg
          aria-hidden
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-raiz-texto-terciario"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <span className="sr-only">Buscar por nome ou telefone</span>
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar por nome ou telefone"
          className="w-full bg-transparent text-raiz-corpo text-raiz-marrom placeholder:text-raiz-texto-terciario focus:outline-none"
        />
      </label>

      <div role="group" aria-label="Situação" className="flex rounded-full bg-raiz-sand p-1">
        {OPCOES.map((opcao) => (
          <button
            key={opcao.valor}
            type="button"
            aria-pressed={status === opcao.valor}
            onClick={() => navegar(texto, opcao.valor)}
            className={`rounded-full px-3.5 py-1.5 text-raiz-corpo-sm font-semibold transition-colors ${
              status === opcao.valor
                ? "bg-raiz-superficie text-raiz-marrom shadow-raiz-segmento"
                : "text-raiz-texto-terciario hover:text-raiz-marrom"
            }`}
          >
            {opcao.rotulo}
          </button>
        ))}
      </div>
    </div>
  );
}
