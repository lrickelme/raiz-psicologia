"use client";

import { horaLocal, type EvolucaoListada } from "@raiz/shared";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { abrirEvolucao, chaves, SEM_REFAZER } from "./consultas";
import { dia, quando } from "./formatar";

type ListaEvolucoesProps = {
  evolucoes: EvolucaoListada[];
  /** Início de cada atendimento do paciente, por id, para rotular o vínculo. */
  atendimentos: Map<string, string>;
  podeRetificar: boolean;
  onRetificar: (id: string) => void;
  onHistorico: (id: string) => void;
};

/**
 * Linha do tempo do design-ref, mais recente primeiro pela data original. O
 * texto não vem com a lista: cada cartão o busca quando aberto, e só então a
 * trilha registra a leitura daquela evolução (design.md, "Frontend").
 */
export function ListaEvolucoes({ evolucoes, ...acoes }: ListaEvolucoesProps) {
  if (!evolucoes.length) {
    return (
      <p className="rounded-raiz-card border border-dashed border-raiz-borda-forte p-5 text-raiz-corpo text-raiz-texto-terciario">
        Nenhuma evolução registrada ainda.
      </p>
    );
  }

  return (
    <ol className="relative flex flex-col gap-4 pl-[26px]">
      <span aria-hidden className="absolute top-1.5 bottom-1.5 left-[5px] w-0.5 bg-raiz-borda-forte" />
      {evolucoes.map((evolucao, i) => (
        <CartaoEvolucao key={evolucao.id} evolucao={evolucao} maisRecente={i === 0} {...acoes} />
      ))}
    </ol>
  );
}

function CartaoEvolucao({
  evolucao,
  maisRecente,
  atendimentos,
  podeRetificar,
  onRetificar,
  onHistorico,
}: Omit<ListaEvolucoesProps, "evolucoes"> & { evolucao: EvolucaoListada; maisRecente: boolean }) {
  const [aberta, setAberta] = useState(false);
  const texto = useQuery({
    queryKey: chaves.evolucao(evolucao.id),
    queryFn: () => abrirEvolucao(evolucao.id),
    enabled: aberta,
    ...SEM_REFAZER,
  });
  const retificada = evolucao.retificaDeId !== null;
  const inicioAtendimento = evolucao.atendimentoId && atendimentos.get(evolucao.atendimentoId);
  const textoId = `evolucao-${evolucao.id}-texto`;

  return (
    <li className="relative">
      <span
        aria-hidden
        className={`absolute top-1 -left-[26px] size-3 rounded-full border-2 border-raiz-superficie ${
          maisRecente ? "bg-raiz-vinho" : "bg-raiz-bege"
        }`}
      />
      <article className="flex flex-col gap-2.5 rounded-[14px] border border-raiz-borda bg-raiz-superficie px-[18px] py-4">
        <header className="flex flex-wrap items-center gap-2.5">
          <span className="font-raiz-mono text-raiz-meta font-medium text-raiz-marrom">
            {dia(evolucao.originalmenteEm)}
          </span>
          <span className="font-raiz-mono text-raiz-legenda text-raiz-texto-terciario">
            {horaLocal(evolucao.originalmenteEm)}
          </span>
          {maisRecente && (
            <span className="rounded-full bg-raiz-vinho-suave px-[9px] py-0.5 text-[10.5px] font-semibold text-raiz-vinho">
              Mais recente
            </span>
          )}
          {retificada && (
            <span className="rounded-full bg-raiz-ambar-suave px-[9px] py-0.5 text-[10.5px] font-semibold text-raiz-ambar-escuro">
              Retificada em {quando(evolucao.registradoEm)}
            </span>
          )}
          <span className="ml-auto text-raiz-meta text-raiz-texto-terciario">
            {inicioAtendimento ? `Atendimento de ${quando(inicioAtendimento)}` : "Avulsa"}
          </span>
        </header>

        {aberta && (
          <div id={textoId}>
            {texto.isPending && (
              <p className="text-raiz-corpo-sm text-raiz-texto-terciario">Abrindo…</p>
            )}
            {texto.isError && (
              <p role="alert" className="text-raiz-corpo-sm font-semibold text-raiz-vinho">
                {texto.error.message}
              </p>
            )}
            {texto.data && (
              <p className="text-raiz-corpo leading-[1.6] whitespace-pre-wrap text-raiz-texto-secundario">
                {texto.data.texto}
              </p>
            )}
          </div>
        )}

        <footer className="flex flex-wrap gap-x-4 gap-y-1 text-raiz-corpo-sm font-semibold">
          <button
            type="button"
            aria-expanded={aberta}
            aria-controls={textoId}
            onClick={() => setAberta((a) => !a)}
            className="text-raiz-vinho hover:underline"
          >
            {aberta ? "Ocultar texto" : "Ler evolução"}
          </button>
          {aberta && podeRetificar && texto.data && (
            <button
              type="button"
              onClick={() => onRetificar(evolucao.id)}
              className="text-raiz-texto-secundario hover:text-raiz-vinho hover:underline"
            >
              Retificar
            </button>
          )}
          {retificada && (
            <button
              type="button"
              onClick={() => onHistorico(evolucao.id)}
              className="text-raiz-texto-secundario hover:text-raiz-vinho hover:underline"
            >
              Histórico de versões
            </button>
          )}
        </footer>
      </article>
    </li>
  );
}
