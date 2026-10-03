"use client";

import type { StatusTopico, Topico } from "@raiz/shared";
import type { DragEvent } from "react";
import { formatarDiaMes } from "@/lib/formatar";
import { MenuAcoes } from "./menu-acoes";
import { PillLabel } from "./pill-label";

export const NOME_COLUNA: Record<StatusTopico, string> = {
  A_ESTUDAR: "A estudar",
  EM_ESTUDO: "Em estudo",
  CONCLUIDO: "Concluídos",
};

/** Tipo do dado arrastado: as colunas só aceitam cartões de tópico. */
export const TIPO_ARRASTO = "application/x-raiz-topico";

/** Controle do cartão que disparou o movimento, para o quadro devolver o foco a um igual. */
export type ControleCartao = "caixa" | "menu";
export const SELETOR_CONTROLE: Record<ControleCartao, string> = {
  caixa: 'input[type="checkbox"]',
  menu: 'button[aria-haspopup="menu"]',
};

type CartaoTopicoProps = {
  topico: Topico;
  onMover: (status: StatusTopico, controle: ControleCartao) => void;
  onEditar: () => void;
};

/**
 * Um cartão para os três estados. A caixa conclui (ou reabre para "Em
 * estudo"); o menu move para qualquer estado e edita. Arrastar entre colunas é
 * atalho de mouse: sem ele e sem `hover`, tudo funciona por teclado e, na
 * change 06, por toque.
 */
export function CartaoTopico({ topico, onMover, onEditar }: CartaoTopicoProps) {
  const concluido = topico.status === "CONCLUIDO";
  const destinos = (Object.keys(NOME_COLUNA) as StatusTopico[]).filter((s) => s !== topico.status);

  const caixa = (
    <label className="relative inline-flex shrink-0 cursor-pointer">
      <input
        type="checkbox"
        // Invisível sobre a caixa desenhada, e não `sr-only`: o alvo de clique e toque é a caixa inteira.
        className="peer absolute inset-0 m-0 cursor-pointer opacity-0"
        checked={concluido}
        onChange={() => onMover(concluido ? "EM_ESTUDO" : "CONCLUIDO", "caixa")}
        aria-label={`Concluído: ${topico.titulo}`}
      />
      <span
        aria-hidden
        className="flex size-5 items-center justify-center rounded-[6px] border-[1.5px] border-raiz-borda-forte text-[12px] text-raiz-sobre-pill peer-checked:border-raiz-musgo peer-checked:bg-raiz-musgo peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-raiz-vinho"
      >
        {concluido && "✓"}
      </span>
    </label>
  );

  const menu = (
    <MenuAcoes
      rotulo={`Ações de “${topico.titulo}”`}
      grupos={[
        {
          titulo: concluido ? "Reabrir em…" : "Mover para…",
          itens: destinos.map((status) => ({
            rotulo: NOME_COLUNA[status],
            nome: `Mover para ${NOME_COLUNA[status]}`,
            acao: () => onMover(status, "menu"),
          })),
        },
        { itens: [{ rotulo: "Editar", acao: onEditar }] },
      ]}
    />
  );

  const arrastavel = {
    "data-topico": topico.id,
    draggable: true,
    onDragStart: (evento: DragEvent) => {
      evento.dataTransfer.setData(TIPO_ARRASTO, topico.id);
      evento.dataTransfer.effectAllowed = "move";
    },
  };

  if (concluido) {
    return (
      <article
        {...arrastavel}
        aria-label={topico.titulo}
        className="flex cursor-grab items-center gap-2.5 rounded-[13px] border border-raiz-borda bg-raiz-areia px-3.5 py-[13px]"
      >
        {caixa}
        <div className="min-w-0 flex-1">
          <p className="text-raiz-corpo-sm text-raiz-texto-terciario line-through">{topico.titulo}</p>
          {topico.concluidoEm && (
            <p className="mt-0.5 font-raiz-mono text-[10px] text-raiz-texto-terciario">
              concluído {formatarDiaMes(topico.concluidoEm)}
            </p>
          )}
        </div>
        {menu}
      </article>
    );
  }

  return (
    <article
      {...arrastavel}
      aria-label={topico.titulo}
      className="cursor-grab rounded-[13px] border border-raiz-borda bg-raiz-superficie p-3.5 shadow-[0_4px_12px_-8px_rgb(70_52_42/0.3)]"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        {topico.label ? <PillLabel label={topico.label} /> : <span />}
        <div className="flex items-center gap-1">
          {menu}
          {caixa}
        </div>
      </div>
      <h3 className="mb-[5px] text-raiz-corpo leading-[1.3] font-semibold text-raiz-marrom">{topico.titulo}</h3>
      {topico.descricao && (
        <p className="text-raiz-meta leading-[1.45] whitespace-pre-line text-raiz-texto-terciario">
          {topico.descricao}
        </p>
      )}
    </article>
  );
}
