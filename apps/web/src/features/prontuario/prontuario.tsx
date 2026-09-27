"use client";

import type { Evolucao, RascunhoEvolucao } from "@raiz/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Botao } from "@/components/ui/botao";
import {
  buscarRascunho,
  chaves,
  descartarRascunho,
  listarEvolucoes,
  SEM_REFAZER,
} from "./consultas";
import { EditorEvolucao } from "./editor-evolucao";
import { quando } from "./formatar";
import { ListaEvolucoes } from "./lista-evolucoes";
import { ModalHistorico } from "./modal-historico";
import { PainelRetificacao } from "./painel-retificacao";

type ProntuarioProps = {
  pacienteId: string;
  ativo: boolean;
  /** Início de cada atendimento do paciente, por id. */
  atendimentos: Record<string, string>;
  /** Atendimento realizado de onde a evolução foi iniciada (`?atendimento=`). */
  atendimento: { id: string; inicio: string } | null;
};

type Edicao =
  | { tipo: "nova"; rascunho: RascunhoEvolucao | null }
  | { tipo: "retificacao"; evolucao: Evolucao }
  | null;

export function Prontuario({ pacienteId, ativo, atendimentos, atendimento }: ProntuarioProps) {
  const queryClient = useQueryClient();
  const atendimentoId = atendimento?.id ?? null;
  const [edicao, setEdicao] = useState<Edicao>(null);
  const [historicoDe, setHistoricoDe] = useState<string | null>(null);

  const evolucoes = useQuery({
    queryKey: chaves.evolucoes(pacienteId),
    queryFn: () => listarEvolucoes(pacienteId),
    ...SEM_REFAZER,
  });
  const rascunho = useQuery({
    queryKey: chaves.rascunho(pacienteId, atendimentoId),
    queryFn: () => buscarRascunho(pacienteId, atendimentoId),
    enabled: ativo,
    ...SEM_REFAZER,
  });
  const inicioPorId = new Map(Object.entries(atendimentos));

  function concluir() {
    setEdicao(null);
    queryClient.setQueryData(chaves.rascunho(pacienteId, atendimentoId), null);
    void queryClient.invalidateQueries({ queryKey: chaves.evolucoes(pacienteId) });
  }

  function fecharEditor() {
    setEdicao(null);
    // O rascunho mudou no servidor enquanto o editor estava aberto.
    void queryClient.invalidateQueries({ queryKey: chaves.rascunho(pacienteId, atendimentoId) });
  }

  async function descartar() {
    if (!window.confirm("Descartar este rascunho? O texto não poderá ser recuperado.")) return;
    await descartarRascunho(pacienteId, atendimentoId);
    queryClient.setQueryData(chaves.rascunho(pacienteId, atendimentoId), null);
  }

  function retificar(id: string) {
    const evolucao = queryClient.getQueryData<Evolucao>(chaves.evolucao(id));
    if (evolucao) setEdicao({ tipo: "retificacao", evolucao });
  }

  const pendente = rascunho.data;
  const total = evolucoes.data?.length ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="font-raiz-display text-[17px] font-semibold text-raiz-marrom">
            Evoluções do prontuário
          </h2>
          {evolucoes.data && (
            <span className="font-raiz-mono text-raiz-legenda text-raiz-texto-terciario">
              {total} {total === 1 ? "registro" : "registros"}
            </span>
          )}
        </div>
        {ativo && edicao === null && (
          <Botao onClick={() => setEdicao({ tipo: "nova", rascunho: pendente ?? null })}>
            {pendente ? "Continuar evolução" : "Nova evolução"}
          </Botao>
        )}
      </div>

      {!ativo && (
        <p className="rounded-raiz-campo bg-raiz-sand px-3.5 py-2.5 text-raiz-corpo-sm text-raiz-texto-secundario">
          Paciente arquivado: o prontuário é somente leitura. Reative o paciente para registrar
          ou retificar evoluções.
        </p>
      )}

      {pendente && edicao === null && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-raiz-campo border border-raiz-ambar/50 bg-raiz-ambar-suave px-3.5 py-3"
        >
          <p className="text-raiz-corpo-sm text-raiz-ambar-escuro">
            <span className="font-semibold">Há um rascunho não gravado</span>
            {atendimento ? ` para o atendimento de ${quando(atendimento.inicio)}` : ""}, salvo em{" "}
            {quando(pendente.atualizadoEm)}.
          </p>
          <div className="flex gap-2">
            <Botao variante="secundario" onClick={descartar}>
              Descartar
            </Botao>
            <Botao onClick={() => setEdicao({ tipo: "nova", rascunho: pendente })}>
              Retomar rascunho
            </Botao>
          </div>
        </div>
      )}

      {edicao?.tipo === "nova" && (
        <EditorEvolucao
          pacienteId={pacienteId}
          atendimento={atendimento}
          rascunho={edicao.rascunho}
          onGravada={concluir}
          onFechar={fecharEditor}
        />
      )}
      {edicao?.tipo === "retificacao" && (
        <PainelRetificacao
          evolucao={edicao.evolucao}
          onRetificada={() => {
            queryClient.removeQueries({ queryKey: chaves.historico(edicao.evolucao.id) });
            concluir();
          }}
          onCancelar={() => setEdicao(null)}
        />
      )}

      {evolucoes.isPending && (
        <p className="text-raiz-corpo text-raiz-texto-terciario">Carregando evoluções…</p>
      )}
      {evolucoes.isError && (
        <p role="alert" className="font-semibold text-raiz-vinho">
          {evolucoes.error.message}
        </p>
      )}
      {evolucoes.data && (
        <ListaEvolucoes
          evolucoes={evolucoes.data}
          atendimentos={inicioPorId}
          podeRetificar={ativo && edicao === null}
          onRetificar={retificar}
          onHistorico={setHistoricoDe}
        />
      )}

      <ModalHistorico id={historicoDe} onFechar={() => setHistoricoDe(null)} />
    </div>
  );
}
