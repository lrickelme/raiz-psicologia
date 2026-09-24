"use client";

import {
  atendimentoEntradaSchema,
  horaLocal,
  dataLocal,
  type Atendimento,
  type ConflitoDeHorario,
  type DataLocal,
  type Paciente,
} from "@raiz/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { Modal } from "@/components/ui/modal";
import { chamarApi, ErroApi } from "@/lib/api-cliente";
import { chaveAtendimentos } from "./consultas";
import { conflitoLocal } from "./calendario";
import { faixaHoraria, instanteIso, paraHora, paraMinutos } from "./horario";
import { SeletorPaciente } from "./seletor-paciente";

export type Rascunho = { data: DataLocal; inicioMin: number; fimMin: number };

type Props = {
  rascunho: Rascunho | null;
  onFechar: () => void;
  /** Atendimentos já carregados, para avisar do conflito antes de enviar. */
  atendimentos: Atendimento[];
};

export function ModalNovoAtendimento({ rascunho, onFechar, atendimentos }: Props) {
  return (
    <Modal aberto={rascunho !== null} titulo="Nova consulta" onFechar={onFechar}>
      {/* Remontar a cada abertura zera o formulário. */}
      {rascunho && (
        <Formulario
          key={`${rascunho.data}-${rascunho.inicioMin}-${rascunho.fimMin}`}
          rascunho={rascunho}
          onFechar={onFechar}
          atendimentos={atendimentos}
        />
      )}
    </Modal>
  );
}

function Formulario({
  rascunho,
  onFechar,
  atendimentos,
}: {
  rascunho: Rascunho;
  onFechar: () => void;
  atendimentos: Atendimento[];
}) {
  const queryClient = useQueryClient();
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [data, setData] = useState(rascunho.data);
  const [inicio, setInicio] = useState(paraHora(rascunho.inicioMin));
  const [fim, setFim] = useState(paraHora(rascunho.fimMin));
  const [valor, setValor] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [conflito, setConflito] = useState<ConflitoDeHorario | null>(null);

  function escolherPaciente(p: Paciente | null) {
    setPaciente(p);
    // Herda o valor do paciente, editável no ato (spec agenda).
    setValor(p ? p.valorConsultaPadrao.replace(".", ",") : "");
  }

  /** Mantém a duração ao mexer no início. */
  function mudarInicio(novo: string) {
    if (novo && inicio && fim) {
      const duracao = paraMinutos(fim) - paraMinutos(inicio);
      const novoFim = paraMinutos(novo) + duracao;
      if (novoFim < 24 * 60) setFim(paraHora(novoFim));
    }
    setInicio(novo);
  }

  const inicioIso = data && inicio ? instanteIso(data, inicio) : null;
  const fimIso = data && fim ? instanteIso(data, fim) : null;
  const ocupado =
    inicioIso && fimIso && fimIso > inicioIso
      ? conflitoLocal(atendimentos, new Date(inicioIso), new Date(fimIso))
      : undefined;

  const criar = useMutation({
    mutationFn: (corpo: object) =>
      chamarApi<Atendimento>("/atendimentos", { method: "POST", corpo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chaveAtendimentos });
      onFechar();
    },
    onError: (erro) => {
      if (erro instanceof ErroApi && erro.status === 409) {
        setConflito(erro.corpo as unknown as ConflitoDeHorario);
      } else if (erro instanceof ErroApi && erro.campos.length) {
        setErros(Object.fromEntries(erro.campos.map((c) => [c.caminho, c.mensagem])));
      } else {
        setErros({ geral: erro.message });
      }
    },
  });

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setConflito(null);
    const validacao = atendimentoEntradaSchema.safeParse({
      pacienteId: paciente?.id,
      inicio: inicioIso ?? undefined,
      fim: fimIso ?? undefined,
      valor: valor || undefined,
    });
    if (!validacao.success) {
      setErros(
        Object.fromEntries(validacao.error.issues.map((i) => [i.path.join("."), i.message])),
      );
      return;
    }
    setErros({});
    criar.mutate(validacao.data);
  }

  function usarProximoLivre() {
    if (!conflito) return;
    const { inicio: i, fim: f } = conflito.proximoHorarioLivre;
    setData(dataLocal(i));
    setInicio(horaLocal(i));
    setFim(horaLocal(f));
    setConflito(null);
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
      <SeletorPaciente selecionado={paciente} onSelecionar={escolherPaciente} erro={erros.pacienteId} />
      <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-3">
        <Campo rotulo="Data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        <Campo
          rotulo="Início"
          type="time"
          step={900}
          value={inicio}
          onChange={(e) => mudarInicio(e.target.value)}
          erro={erros.inicio}
        />
        <Campo
          rotulo="Término"
          type="time"
          step={900}
          value={fim}
          onChange={(e) => setFim(e.target.value)}
          erro={erros.fim}
        />
      </div>
      <Campo
        rotulo="Valor (R$)"
        inputMode="decimal"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        descricao="Congelado neste atendimento; reajustes futuros do paciente não o alteram."
        erro={erros.valor}
      />

      {ocupado && !conflito && (
        <p role="status" className="rounded-raiz-campo bg-raiz-ambar-suave px-3.5 py-2.5 text-raiz-corpo-sm text-raiz-ambar-escuro">
          Esse horário cruza com {ocupado.paciente.nome} ({faixaHoraria(ocupado.inicio, ocupado.fim)}).
          Ao agendar, será sugerido o próximo horário livre.
        </p>
      )}
      {conflito && (
        <div role="alert" className="flex flex-col gap-2 rounded-raiz-campo bg-raiz-vinho-suave px-3.5 py-2.5 text-raiz-corpo-sm text-raiz-vinho">
          <span className="font-semibold">
            Conflito com {conflito.conflitante?.paciente} (
            {conflito.conflitante && faixaHoraria(conflito.conflitante.inicio, conflito.conflitante.fim)}).
          </span>
          <button type="button" onClick={usarProximoLivre} className="self-start font-semibold underline">
            Usar o próximo horário livre: {dataLocal(conflito.proximoHorarioLivre.inicio) !== data && `${dataLocal(conflito.proximoHorarioLivre.inicio).split("-").reverse().join("/")} `}
            {faixaHoraria(conflito.proximoHorarioLivre.inicio, conflito.proximoHorarioLivre.fim)}
          </button>
        </div>
      )}
      {erros.geral && (
        <p role="alert" className="font-semibold text-raiz-vinho">{erros.geral}</p>
      )}

      <div className="flex justify-end gap-2.5">
        <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
        <Botao type="submit" disabled={criar.isPending}>
          {criar.isPending ? "Agendando…" : "Agendar"}
        </Botao>
      </div>
    </form>
  );
}
