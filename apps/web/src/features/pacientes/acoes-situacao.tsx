"use client";

import { dataLocal, type AtendimentosPendentes, type Paciente } from "@raiz/shared";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AreaTexto } from "@/components/ui/area-texto";
import { Botao } from "@/components/ui/botao";
import { Modal } from "@/components/ui/modal";
import { faixaHoraria } from "@/features/agenda/horario";
import { chamarApi, ErroApi } from "@/lib/api-cliente";
import { formatarData } from "@/lib/formatar";

/**
 * Arquivar (com confirmação) ou reativar. Não existe excluir (spec pacientes).
 * Se houver atendimentos futuros, a API devolve 409 com a lista; o modal a
 * mostra e pede o motivo com que todos serão cancelados.
 */
export function AcoesSituacao({ paciente }: { paciente: Paciente }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [pendentes, setPendentes] = useState<AtendimentosPendentes["pendentes"] | null>(null);
  const [motivo, setMotivo] = useState("");
  const arquivado = paciente.status === "ARQUIVADO";

  function fechar() {
    setConfirmando(false);
    setPendentes(null);
    setMotivo("");
  }

  const alternar = useMutation({
    mutationFn: (motivoCancelamento?: string) =>
      chamarApi<Paciente>(`/pacientes/${paciente.id}/${arquivado ? "reativar" : "arquivar"}`, {
        method: "POST",
        corpo: arquivado ? undefined : { motivoCancelamento },
      }),
    onSuccess: () => {
      fechar();
      router.refresh();
    },
    onError: (erro) => {
      if (erro instanceof ErroApi && erro.status === 409 && "pendentes" in erro.corpo) {
        setPendentes((erro.corpo as unknown as AtendimentosPendentes).pendentes);
      }
    },
  });

  if (arquivado) {
    return (
      <Botao variante="secundario" disabled={alternar.isPending} onClick={() => alternar.mutate(undefined)}>
        {alternar.isPending ? "Reativando…" : "Reativar"}
      </Botao>
    );
  }

  const precisaMotivo = pendentes !== null && pendentes.length > 0;

  return (
    <>
      <Botao variante="secundario" onClick={() => setConfirmando(true)}>
        Arquivar
      </Botao>
      <Modal
        aberto={confirmando}
        titulo={`Arquivar ${paciente.nome}?`}
        onFechar={fechar}
        rodape={
          <>
            <Botao variante="secundario" onClick={fechar}>
              Voltar
            </Botao>
            <Botao
              disabled={alternar.isPending || (precisaMotivo && !motivo.trim())}
              onClick={() => alternar.mutate(precisaMotivo ? motivo : undefined)}
            >
              {alternar.isPending
                ? "Arquivando…"
                : precisaMotivo
                  ? `Cancelar ${pendentes.length} e arquivar`
                  : "Arquivar"}
            </Botao>
          </>
        }
      >
        {precisaMotivo ? (
          <div className="flex flex-col gap-3">
            <p>
              {paciente.nome} tem {pendentes.length}{" "}
              {pendentes.length === 1 ? "atendimento agendado" : "atendimentos agendados"}. Ao
              arquivar, {pendentes.length === 1 ? "ele será cancelado" : "todos serão cancelados"}{" "}
              com o motivo abaixo:
            </p>
            <ul className="flex flex-col gap-1.5">
              {pendentes.map((p) => (
                <li
                  key={p.id}
                  className="rounded-raiz-campo border border-raiz-borda px-3 py-2 font-raiz-mono text-raiz-meta text-raiz-marrom"
                >
                  {formatarData(dataLocal(p.inicio))} · {faixaHoraria(p.inicio, p.fim)}
                </li>
              ))}
            </ul>
            <AreaTexto
              rotulo="Motivo do cancelamento"
              rows={2}
              autoFocus
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </div>
        ) : (
          <p>
            O paciente sai da listagem padrão e das opções de novo agendamento. Perfil e
            histórico continuam acessíveis pelo filtro de arquivados, e ele pode ser
            reativado a qualquer momento.
          </p>
        )}
        {alternar.error && !(alternar.error instanceof ErroApi && alternar.error.status === 409) && (
          <p role="alert" className="mt-3 font-semibold text-raiz-vinho">
            {alternar.error.message}
          </p>
        )}
      </Modal>
    </>
  );
}
