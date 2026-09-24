"use client";

import {
  dataLocal,
  diaDaSemana,
  minutosDoDia,
  type Atendimento,
  type DataLocal,
} from "@raiz/shared";
import { useEffect, useRef, useState, type PointerEvent as EventoPonteiro } from "react";
import {
  arredondarPasso,
  DIAS_CURTOS,
  emFaixas,
  HORA_FINAL,
  HORA_INICIAL,
  OCUPA,
  PASSO_MIN,
  PX_POR_HORA,
  topoPx,
} from "./calendario";
import { duracaoMin, faixaHoraria, paraHora } from "./horario";
import type { Rascunho } from "./modal-novo-atendimento";
import type { Selecao } from "./modal-atendimento";

const ALTURA = (HORA_FINAL - HORA_INICIAL) * PX_POR_HORA;
const MIN_POR_PX = 60 / PX_POR_HORA;
const DURACAO_PADRAO = 50;
/** Deslocamento mínimo para um toque virar arraste. */
const LIMIAR_PX = 4;

/** Cores dos blocos, do design-ref; encerrados aparecem esmaecidos. */
const BLOCO: Record<Atendimento["status"], string> = {
  AGENDADO: "bg-raiz-ambar-suave border-raiz-ambar text-raiz-ambar-escuro",
  REALIZADO: "bg-raiz-musgo-suave border-raiz-musgo text-raiz-musgo-escuro",
  FALTA: "bg-raiz-vinho border-raiz-vinho-escuro text-raiz-sobre-vinho",
  CANCELADO: "bg-raiz-vinho-suave/60 border-raiz-vinho/50 text-raiz-vinho line-through opacity-70",
  REMARCADO: "bg-raiz-bege/60 border-raiz-texto-inativo text-raiz-texto-secundario line-through opacity-70",
};

type Gesto =
  | { tipo: "selecao"; dia: DataLocal; ancora: number; atual: number }
  | {
      tipo: "arraste";
      atendimento: Atendimento;
      origemX: number;
      origemY: number;
      deslocMin: number;
      dia: DataLocal;
      inicioMin: number;
      moveu: boolean;
    };

type Props = {
  dias: DataLocal[];
  hoje: DataLocal;
  atendimentos: Atendimento[];
  onNovo: (rascunho: Rascunho) => void;
  onSelecionar: (selecao: Selecao) => void;
};

/**
 * Grade da visão diária e semanal. Arrastar no vazio seleciona um intervalo
 * para agendar; arrastar um atendimento agendado propõe a remarcação, que o
 * modal confirma pedindo o motivo (spec agenda, "Arrastar no calendário").
 * Tudo em minutos de São Paulo, independentemente do fuso do navegador.
 */
export function GradeHorarios({ dias, hoje, atendimentos, onNovo, onSelecionar }: Props) {
  const colunas = useRef<HTMLDivElement>(null);
  const rolagem = useRef<HTMLDivElement>(null);
  const [gesto, setGesto] = useState<Gesto | null>(null);

  // Abre às 08h, como no design-ref; o que vem antes fica a uma rolagem. A
  // folga deixa o rótulo das 08:00 visível sob o cabeçalho.
  useEffect(() => {
    rolagem.current?.scrollTo({ top: PX_POR_HORA - 12 });
  }, []);

  function posicao(evento: { clientX: number; clientY: number }) {
    const caixa = colunas.current!.getBoundingClientRect();
    const indice = Math.min(
      dias.length - 1,
      Math.max(0, Math.floor(((evento.clientX - caixa.left) / caixa.width) * dias.length)),
    );
    const minutos = HORA_INICIAL * 60 + (evento.clientY - caixa.top) * MIN_POR_PX;
    return { dia: dias[indice], minutos };
  }

  const limitar = (min: number, duracao = PASSO_MIN) =>
    Math.min(Math.max(min, HORA_INICIAL * 60), HORA_FINAL * 60 - duracao);

  function iniciarSelecao(evento: EventoPonteiro<HTMLDivElement>) {
    if (evento.button !== 0 || evento.target !== evento.currentTarget) return;
    evento.currentTarget.setPointerCapture(evento.pointerId);
    const { dia, minutos } = posicao(evento);
    const ancora = limitar(Math.floor(minutos / PASSO_MIN) * PASSO_MIN);
    setGesto({ tipo: "selecao", dia, ancora, atual: ancora });
  }

  function iniciarArraste(evento: EventoPonteiro<HTMLButtonElement>, atendimento: Atendimento) {
    if (evento.button !== 0) return;
    evento.stopPropagation();
    evento.currentTarget.setPointerCapture(evento.pointerId);
    const { minutos } = posicao(evento);
    const inicioMin = minutosDoDia(atendimento.inicio);
    setGesto({
      tipo: "arraste",
      atendimento,
      origemX: evento.clientX,
      origemY: evento.clientY,
      deslocMin: minutos - inicioMin,
      dia: dataLocal(atendimento.inicio),
      inicioMin,
      moveu: false,
    });
  }

  function mover(evento: EventoPonteiro) {
    if (!gesto) return;
    const { dia, minutos } = posicao(evento);
    if (gesto.tipo === "selecao") {
      setGesto({ ...gesto, atual: limitar(arredondarPasso(minutos)) });
      return;
    }
    const moveu =
      gesto.moveu ||
      Math.hypot(evento.clientX - gesto.origemX, evento.clientY - gesto.origemY) > LIMIAR_PX;
    if (!moveu || gesto.atendimento.status !== "AGENDADO") return;
    const duracao = duracaoMin(gesto.atendimento.inicio, gesto.atendimento.fim);
    setGesto({
      ...gesto,
      moveu,
      dia,
      inicioMin: limitar(arredondarPasso(minutos - gesto.deslocMin), duracao),
    });
  }

  function soltar() {
    if (!gesto) return;
    setGesto(null);
    if (gesto.tipo === "selecao") {
      const [de, ate] = [gesto.ancora, gesto.atual].sort((a, b) => a - b);
      // Clique simples propõe a duração padrão de 50 min (spec agenda).
      onNovo({
        data: gesto.dia,
        inicioMin: de,
        fimMin: ate - de >= PASSO_MIN ? ate : Math.min(de + DURACAO_PADRAO, 24 * 60 - 1),
      });
      return;
    }
    const mudou =
      gesto.dia !== dataLocal(gesto.atendimento.inicio) ||
      gesto.inicioMin !== minutosDoDia(gesto.atendimento.inicio);
    onSelecionar(
      gesto.moveu && mudou
        ? { atendimento: gesto.atendimento, destino: { data: gesto.dia, inicioMin: gesto.inicioMin } }
        : { atendimento: gesto.atendimento },
    );
  }

  const horas = Array.from({ length: HORA_FINAL - HORA_INICIAL }, (_, i) => HORA_INICIAL + i);

  return (
    <div className="overflow-hidden rounded-raiz-card border border-raiz-borda bg-raiz-superficie">
      <div className="flex border-b border-raiz-borda bg-raiz-sand pl-[54px]">
        {dias.map((dia) => (
          <div
            key={dia}
            className={`flex-1 py-[11px] text-center text-[12.5px] font-semibold ${
              dia === hoje ? "text-raiz-vinho" : "text-raiz-marrom"
            }`}
          >
            {DIAS_CURTOS[diaDaSemana(dia)]}
            <br />
            <span className="font-raiz-display text-[17px]">{Number(dia.slice(8))}</span>
          </div>
        ))}
      </div>

      <div ref={rolagem} className="max-h-[min(640px,calc(100dvh-260px))] overflow-y-auto">
        <div className="relative ml-[54px] select-none" style={{ height: ALTURA }}>
          {horas.map((hora, i) => (
            <div key={hora}>
              <div
                className="absolute inset-x-0 border-t border-raiz-borda"
                style={{ top: i * PX_POR_HORA }}
              />
              <div
                className="absolute -left-[54px] w-[54px] pr-2.5 text-right font-raiz-mono text-[10.5px] text-raiz-texto-terciario"
                style={{ top: i * PX_POR_HORA - 7 }}
              >
                {paraHora(hora * 60)}
              </div>
            </div>
          ))}

          <div ref={colunas} className="absolute inset-0 flex">
            {dias.map((dia, indice) => {
              const doDia = atendimentos.filter((a) => dataLocal(a.inicio) === dia);
              return (
                <div
                  key={dia}
                  role="presentation"
                  onPointerDown={iniciarSelecao}
                  onPointerMove={mover}
                  onPointerUp={soltar}
                  onPointerCancel={() => setGesto(null)}
                  className={`relative flex-1 cursor-crosshair ${indice ? "border-l border-raiz-borda" : ""}`}
                >
                  {emFaixas(doDia).map(({ atendimento, faixa, faixas }) => {
                    const arrastando =
                      gesto?.tipo === "arraste" && gesto.moveu && gesto.atendimento.id === atendimento.id;
                    const altura = (duracaoMin(atendimento.inicio, atendimento.fim) * PX_POR_HORA) / 60;
                    return (
                      <button
                        key={atendimento.id}
                        type="button"
                        onPointerDown={(e) => iniciarArraste(e, atendimento)}
                        onPointerMove={mover}
                        onPointerUp={soltar}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onSelecionar({ atendimento });
                          }
                        }}
                        aria-label={`${atendimento.paciente.nome}, ${faixaHoraria(atendimento.inicio, atendimento.fim)}`}
                        className={`absolute overflow-hidden rounded-lg border-l-[3px] px-[9px] py-1.5 text-left focus-visible:outline-2 focus-visible:outline-raiz-vinho ${
                          BLOCO[atendimento.status]
                        } ${atendimento.status === "AGENDADO" ? "cursor-grab" : "cursor-pointer"} ${
                          arrastando ? "opacity-40" : ""
                        } ${OCUPA[atendimento.status] ? "z-10" : ""}`}
                        style={{
                          top: topoPx(atendimento.inicio) + 2,
                          height: Math.max(altura - 4, 18),
                          left: `calc(${(faixa / faixas) * 100}% + 4px)`,
                          width: `calc(${100 / faixas}% - 8px)`,
                        }}
                      >
                        <div className="truncate text-raiz-meta leading-tight font-semibold">
                          {atendimento.paciente.nome}
                        </div>
                        <div className="font-raiz-mono text-[9.5px] opacity-75">
                          {faixaHoraria(atendimento.inicio, atendimento.fim)}
                        </div>
                      </button>
                    );
                  })}

                  {gesto?.tipo === "selecao" && gesto.dia === dia && (
                    <Fantasma
                      inicioMin={Math.min(gesto.ancora, gesto.atual)}
                      fimMin={
                        gesto.atual === gesto.ancora
                          ? gesto.ancora + PASSO_MIN
                          : Math.max(gesto.ancora, gesto.atual)
                      }
                      rotulo="Nova consulta"
                    />
                  )}
                  {gesto?.tipo === "arraste" && gesto.moveu && gesto.dia === dia && (
                    <Fantasma
                      inicioMin={gesto.inicioMin}
                      fimMin={gesto.inicioMin + duracaoMin(gesto.atendimento.inicio, gesto.atendimento.fim)}
                      rotulo={gesto.atendimento.paciente.nome}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Fantasma({ inicioMin, fimMin, rotulo }: { inicioMin: number; fimMin: number; rotulo: string }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-1 z-20 rounded-lg border-2 border-dashed border-raiz-vinho bg-raiz-vinho-suave/70 px-[9px] py-1.5 text-raiz-vinho"
      style={{
        top: ((inicioMin - HORA_INICIAL * 60) * PX_POR_HORA) / 60,
        height: ((fimMin - inicioMin) * PX_POR_HORA) / 60,
      }}
    >
      <div className="truncate text-raiz-meta font-semibold">{rotulo}</div>
      <div className="font-raiz-mono text-[9.5px]">
        {paraHora(inicioMin)}–{paraHora(fimMin)}
      </div>
    </div>
  );
}
