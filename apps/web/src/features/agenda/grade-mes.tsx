"use client";

import { dataLocal, type Atendimento, type DataLocal } from "@raiz/shared";
import { DIAS_CURTOS, OCUPA } from "./calendario";
import { faixaHoraria } from "./horario";
import type { Selecao } from "./modal-atendimento";

/** Quantos atendimentos cabem na célula antes do indicador "+N". */
const POR_CELULA = 3;

const PONTO: Record<Atendimento["status"], string> = {
  AGENDADO: "bg-raiz-ambar",
  REALIZADO: "bg-raiz-musgo",
  FALTA: "bg-raiz-vinho",
  CANCELADO: "bg-raiz-vinho-suave",
  REMARCADO: "bg-raiz-bege",
};

type Props = {
  dias: DataLocal[];
  mesDeReferencia: string;
  hoje: DataLocal;
  atendimentos: Atendimento[];
  onAbrirDia: (dia: DataLocal) => void;
  onSelecionar: (selecao: Selecao) => void;
};

export function GradeMes({ dias, mesDeReferencia, hoje, atendimentos, onAbrirDia, onSelecionar }: Props) {
  const porDia = new Map<DataLocal, Atendimento[]>();
  for (const a of atendimentos) {
    const dia = dataLocal(a.inicio);
    porDia.set(dia, [...(porDia.get(dia) ?? []), a]);
  }

  return (
    <div className="overflow-hidden rounded-raiz-card border border-raiz-borda bg-raiz-superficie">
      <div className="grid grid-cols-7 border-b border-raiz-borda bg-raiz-sand">
        {DIAS_CURTOS.map((d) => (
          <div key={d} className="py-2.5 text-center text-[12.5px] font-semibold text-raiz-marrom">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {dias.map((dia, i) => {
          const doDia = porDia.get(dia) ?? [];
          // Os que ocupam o horário vêm primeiro; encerrados só se sobrar espaço.
          const ordenados = [...doDia].sort(
            (a, b) => Number(OCUPA[b.status]) - Number(OCUPA[a.status]) || a.inicio.localeCompare(b.inicio),
          );
          const visiveis = ordenados.slice(0, POR_CELULA);
          const restantes = ordenados.length - visiveis.length;
          const foraDoMes = !dia.startsWith(mesDeReferencia);

          return (
            <div
              key={dia}
              className={`flex min-h-[112px] flex-col gap-1 p-1.5 ${i % 7 ? "border-l" : ""} ${
                i >= 7 ? "border-t" : ""
              } border-raiz-borda ${foraDoMes ? "bg-raiz-areia/50" : ""}`}
            >
              <button
                type="button"
                onClick={() => onAbrirDia(dia)}
                aria-label={`Abrir ${dia.split("-").reverse().join("/")} na visão diária`}
                className={`self-end rounded-full px-1.5 font-raiz-display text-raiz-corpo font-semibold hover:bg-raiz-sand ${
                  dia === hoje
                    ? "bg-raiz-vinho text-raiz-sobre-vinho hover:bg-raiz-vinho-escuro"
                    : foraDoMes
                      ? "text-raiz-texto-inativo"
                      : "text-raiz-marrom"
                }`}
              >
                {Number(dia.slice(8))}
              </button>
              {visiveis.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onSelecionar({ atendimento: a })}
                  className={`flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left text-raiz-legenda hover:bg-raiz-sand ${
                    OCUPA[a.status] ? "text-raiz-marrom" : "text-raiz-texto-terciario line-through"
                  }`}
                >
                  <span aria-hidden className={`size-2 shrink-0 rounded-[3px] ${PONTO[a.status]}`} />
                  <span className="font-raiz-mono">{faixaHoraria(a.inicio, a.fim).slice(0, 5)}</span>
                  <span className="truncate">{a.paciente.nome}</span>
                </button>
              ))}
              {restantes > 0 && (
                <button
                  type="button"
                  onClick={() => onAbrirDia(dia)}
                  className="self-start rounded-md px-1.5 py-0.5 text-raiz-legenda font-semibold text-raiz-vinho hover:bg-raiz-vinho-suave"
                >
                  +{restantes} {restantes === 1 ? "outro" : "outros"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
