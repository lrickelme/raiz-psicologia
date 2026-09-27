"use client";

import { useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import { buscarHistorico, chaves, SEM_REFAZER } from "./consultas";
import { quando } from "./formatar";

/** Todas as versões da evolução, da original à vigente, sem omitir elo. */
export function ModalHistorico({ id, onFechar }: { id: string | null; onFechar: () => void }) {
  const historico = useQuery({
    queryKey: chaves.historico(id ?? ""),
    queryFn: () => buscarHistorico(id!),
    enabled: id !== null,
    ...SEM_REFAZER,
  });
  const versoes = historico.data ?? [];

  return (
    <Modal aberto={id !== null} titulo="Histórico de versões" onFechar={onFechar} largo>
      {historico.isPending && <p>Carregando…</p>}
      {historico.isError && (
        <p role="alert" className="font-semibold text-raiz-vinho">
          {historico.error.message}
        </p>
      )}
      <ol className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto">
        {versoes.map((versao, i) => (
          <li
            key={versao.id}
            className={`flex flex-col gap-1.5 rounded-raiz-campo border px-3.5 py-3 ${
              versao.vigente ? "border-raiz-vinho/40 bg-raiz-superficie" : "border-raiz-borda bg-raiz-areia"
            }`}
          >
            <header className="flex flex-wrap items-center gap-2 text-raiz-meta">
              <span className="font-semibold text-raiz-marrom">
                Versão {i + 1} de {versoes.length}
              </span>
              <span className="font-raiz-mono text-raiz-texto-terciario">
                {quando(versao.registradoEm)}
              </span>
              <span
                className={`rounded-full px-[9px] py-0.5 text-[10.5px] font-semibold ${
                  versao.vigente
                    ? "bg-raiz-musgo-suave text-raiz-musgo-escuro"
                    : "bg-raiz-ambar-suave text-raiz-ambar-escuro"
                }`}
              >
                {versao.vigente ? "Vigente" : "Retificada"}
              </span>
            </header>
            <p className="text-raiz-corpo leading-relaxed whitespace-pre-wrap text-raiz-texto-secundario">
              {versao.texto}
            </p>
          </li>
        ))}
      </ol>
    </Modal>
  );
}
