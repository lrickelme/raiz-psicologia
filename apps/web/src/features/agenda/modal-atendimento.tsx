"use client";

import {
  dataLocal,
  horaLocal,
  type Atendimento,
  type ConflitoDeHorario,
  type DataLocal,
} from "@raiz/shared";
import Link from "next/link";
import { useState } from "react";
import { AreaTexto } from "@/components/ui/area-texto";
import { BadgeStatus } from "@/components/ui/badge-status";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { Modal } from "@/components/ui/modal";
import { ErroApi } from "@/lib/api-cliente";
import { formatarData, formatarDinheiro } from "@/lib/formatar";
import { conflitoLocal } from "./calendario";
import { useTransicao } from "./consultas";
import { duracaoMin, faixaHoraria, instanteIso, paraHora } from "./horario";

type Modo = "detalhe" | "cancelar" | "falta" | "remarcar";

export type Selecao = {
  atendimento: Atendimento;
  /** Destino vindo de arrastar no calendário: abre direto na remarcação. */
  destino?: { data: DataLocal; inicioMin: number };
};

type Props = {
  selecao: Selecao | null;
  onFechar: () => void;
  atendimentos: Atendimento[];
};

const TITULOS: Record<Modo, string> = {
  detalhe: "Atendimento",
  cancelar: "Cancelar atendimento",
  falta: "Registrar falta",
  remarcar: "Remarcar atendimento",
};

export function ModalAtendimento({ selecao, onFechar, atendimentos }: Props) {
  const [modo, setModo] = useState<Modo>("detalhe");
  const modoAtual = selecao?.destino ? "remarcar" : modo;

  function fechar() {
    setModo("detalhe");
    onFechar();
  }

  return (
    <Modal aberto={selecao !== null} titulo={TITULOS[modoAtual]} onFechar={fechar}>
      {selecao && (
        <Conteudo
          key={`${selecao.atendimento.id}-${selecao.destino?.data}-${selecao.destino?.inicioMin}`}
          selecao={selecao}
          modo={modoAtual}
          setModo={setModo}
          onFechar={fechar}
          atendimentos={atendimentos}
        />
      )}
    </Modal>
  );
}

function Conteudo({
  selecao: { atendimento, destino },
  modo,
  setModo,
  onFechar,
  atendimentos,
}: {
  selecao: Selecao;
  modo: Modo;
  setModo: (modo: Modo) => void;
  onFechar: () => void;
  atendimentos: Atendimento[];
}) {
  const transicao = useTransicao();
  const [motivo, setMotivo] = useState("");
  const [data, setData] = useState(destino?.data ?? dataLocal(atendimento.inicio));
  const [inicio, setInicio] = useState(
    destino ? paraHora(destino.inicioMin) : horaLocal(atendimento.inicio),
  );
  const [erro, setErro] = useState<string | null>(null);
  const [conflito, setConflito] = useState<ConflitoDeHorario | null>(null);

  // Instante da abertura: o modal é remontado a cada atendimento aberto.
  const [agora] = useState(Date.now);
  const agendado = atendimento.status === "AGENDADO";
  const terminou = Date.parse(atendimento.fim) <= agora;
  const comecou = Date.parse(atendimento.inicio) <= agora;
  const duracao = duracaoMin(atendimento.inicio, atendimento.fim);

  // Remarcar preserva a duração: o término é derivado do novo início.
  const novoInicio = data && inicio ? new Date(instanteIso(data, inicio)) : null;
  const novoFim = novoInicio ? new Date(novoInicio.getTime() + duracao * 60_000) : null;
  const ocupado =
    modo === "remarcar" && novoInicio && novoFim
      ? conflitoLocal(atendimentos, novoInicio, novoFim, atendimento.id)
      : undefined;

  function executar(t: Parameters<typeof transicao.mutate>[0]) {
    setErro(null);
    setConflito(null);
    transicao.mutate(t, {
      onSuccess: onFechar,
      onError: (e) => {
        if (e instanceof ErroApi && e.status === 409 && "proximoHorarioLivre" in e.corpo) {
          setConflito(e.corpo as unknown as ConflitoDeHorario);
        } else {
          setErro(e instanceof ErroApi && e.campos.length ? e.campos[0].mensagem : e.message);
        }
      },
    });
  }

  function confirmar(evento: React.FormEvent) {
    evento.preventDefault();
    if (modo === "remarcar") {
      if (!novoInicio) return setErro("Informe data e horário");
      executar({
        acao: "remarcar",
        id: atendimento.id,
        dados: { inicio: novoInicio.toISOString(), motivo },
      });
    } else if (modo === "cancelar" || modo === "falta") {
      executar({ acao: modo, id: atendimento.id, dados: { motivo } });
    }
  }

  const resumo = (
    <div className="flex flex-col gap-1 rounded-raiz-campo border border-raiz-borda px-3.5 py-3">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/pacientes/${atendimento.paciente.id}`}
          className="font-semibold text-raiz-marrom hover:underline"
        >
          {atendimento.paciente.nome}
        </Link>
        <BadgeStatus status={atendimento.status} />
      </div>
      <div className="font-raiz-mono text-raiz-meta text-raiz-texto-terciario">
        {formatarData(dataLocal(atendimento.inicio))} · {faixaHoraria(atendimento.inicio, atendimento.fim)} ·{" "}
        {formatarDinheiro(atendimento.valor)}
      </div>
    </div>
  );

  if (modo === "detalhe") {
    return (
      <div className="flex flex-col gap-4">
        {resumo}
        {agendado ? (
          <div className="flex flex-wrap justify-end gap-2.5">
            <Botao variante="secundario" onClick={() => setModo("cancelar")}>Cancelar</Botao>
            <Botao variante="secundario" onClick={() => setModo("remarcar")}>Remarcar</Botao>
            <Botao
              variante="secundario"
              disabled={!comecou}
              title={comecou ? undefined : "Disponível a partir do horário de início"}
              onClick={() => setModo("falta")}
            >
              Falta
            </Botao>
            <Botao
              variante="sucesso"
              disabled={!terminou || transicao.isPending}
              title={terminou ? undefined : "Disponível depois do horário de término"}
              onClick={() => executar({ acao: "realizar", id: atendimento.id })}
            >
              Marcar realizado
            </Botao>
          </div>
        ) : (
          <p className="text-raiz-corpo-sm text-raiz-texto-terciario">
            Atendimento encerrado. O motivo, quando houver, aparece no histórico do paciente.
          </p>
        )}
        {erro && <p role="alert" className="font-semibold text-raiz-vinho">{erro}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={confirmar} noValidate className="flex flex-col gap-4">
      {resumo}
      {modo === "remarcar" && (
        <div className="grid grid-cols-[1.4fr_1fr_1fr] items-end gap-3">
          <Campo rotulo="Nova data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
          <Campo rotulo="Início" type="time" step={900} value={inicio} onChange={(e) => setInicio(e.target.value)} />
          <div className="pb-[11px] font-raiz-mono text-raiz-meta text-raiz-texto-terciario">
            até {novoFim ? horaLocal(novoFim) : "—"} ({duracao} min)
          </div>
        </div>
      )}
      <AreaTexto
        rotulo="Motivo"
        descricao="Registro clínico: guardado cifrado e visível no histórico do paciente."
        autoFocus={!destino}
        rows={3}
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
      />

      {ocupado && (
        <p role="alert" className="rounded-raiz-campo bg-raiz-vinho-suave px-3.5 py-2.5 text-raiz-corpo-sm font-semibold text-raiz-vinho">
          O novo horário cruza com {ocupado.paciente.nome} ({faixaHoraria(ocupado.inicio, ocupado.fim)}).
        </p>
      )}
      {conflito && (
        <div role="alert" className="flex flex-col gap-1 rounded-raiz-campo bg-raiz-vinho-suave px-3.5 py-2.5 text-raiz-corpo-sm text-raiz-vinho">
          <span className="font-semibold">Esse horário acabou de ser ocupado.</span>
          <button
            type="button"
            className="self-start font-semibold underline"
            onClick={() => {
              setData(dataLocal(conflito.proximoHorarioLivre.inicio));
              setInicio(horaLocal(conflito.proximoHorarioLivre.inicio));
              setConflito(null);
            }}
          >
            Usar o próximo horário livre: {faixaHoraria(conflito.proximoHorarioLivre.inicio, conflito.proximoHorarioLivre.fim)}
          </button>
        </div>
      )}
      {erro && <p role="alert" className="font-semibold text-raiz-vinho">{erro}</p>}

      <div className="flex justify-end gap-2.5">
        <Botao variante="secundario" onClick={destino ? onFechar : () => setModo("detalhe")}>
          Voltar
        </Botao>
        <Botao type="submit" disabled={transicao.isPending || !motivo.trim() || Boolean(ocupado)}>
          {modo === "remarcar" ? "Confirmar remarcação" : modo === "cancelar" ? "Cancelar atendimento" : "Registrar falta"}
        </Botao>
      </div>
    </form>
  );
}
