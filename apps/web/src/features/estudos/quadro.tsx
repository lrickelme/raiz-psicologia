"use client";

import type { StatusTopico, Topico } from "@raiz/shared";
import Link from "next/link";
import { useState } from "react";
import { AreaConteudo } from "@/components/shell/area-conteudo";
import { CabecalhoPagina } from "@/components/shell/cabecalho-pagina";
import { Botao } from "@/components/ui/botao";
import { Carregando, Falha } from "@/features/financeiro/painel";
import { CartaoTopico, NOME_COLUNA } from "./cartao-topico";
import { Coluna } from "./coluna";
import { useMover, useQuadro } from "./consultas";
import { GestaoLabels } from "./gestao-labels";
import { ModalTopico } from "./modal-topico";

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export function Quadro() {
  const quadro = useQuadro();
  const mover = useMover();
  // `null` fechado; sem tópico, criação.
  const [edicao, setEdicao] = useState<{ topico?: Topico } | null>(null);
  const [gestaoAberta, setGestaoAberta] = useState(false);

  const dados = quadro.data;
  const cartoes = (topicos: Topico[]) =>
    topicos.map((topico) => ({
      id: topico.id,
      no: (
        <CartaoTopico
          topico={topico}
          onMover={(status: StatusTopico) => mover.mutate({ topico, status })}
          onEditar={() => setEdicao({ topico })}
        />
      ),
    }));
  const noHistorico = dados ? dados.totalConcluidos - dados.concluidos.length : 0;

  return (
    <>
      <CabecalhoPagina
        titulo="Conteúdos a estudar"
        descricao={
          dados &&
          `${plural(dados.pendentes, "pendente", "pendentes")} · ${plural(
            dados.concluidosNoMes,
            "concluído",
            "concluídos",
          )} este mês`
        }
        acoes={
          <>
            <button
              type="button"
              onClick={() => setGestaoAberta(true)}
              className="flex items-center gap-2 rounded-full border border-raiz-borda-forte bg-raiz-superficie px-[13px] py-1.5 text-[12.5px] font-semibold text-raiz-marrom hover:bg-raiz-sand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-raiz-vinho"
            >
              <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z" />
                <circle cx="7" cy="7" r="1.4" />
              </svg>
              Gerenciar labels
            </button>
            <Botao onClick={() => setEdicao({})}>+ Novo tópico</Botao>
          </>
        }
      />
      <AreaConteudo>
        {mover.error && (
          <p
            role="alert"
            className="rounded-raiz-campo bg-raiz-vinho-suave px-3.5 py-2.5 text-raiz-corpo-sm font-semibold text-raiz-vinho"
          >
            Não foi possível mover “{mover.variables?.topico.titulo}”: {mover.error.message} O cartão voltou
            para onde estava.
          </p>
        )}
        {quadro.error ? (
          <Falha mensagem={quadro.error.message} />
        ) : !dados ? (
          <Carregando />
        ) : (
          <div className="flex items-start gap-5 pt-0.5">
            <Coluna
              titulo={NOME_COLUNA.A_ESTUDAR}
              marcador="bg-raiz-ambar"
              contador={dados.aEstudar.length}
              vazio="Nenhum tópico a estudar. Use “+ Novo tópico” para começar."
              cartoes={cartoes(dados.aEstudar)}
            />
            <Coluna
              titulo={NOME_COLUNA.EM_ESTUDO}
              marcador="bg-raiz-vinho"
              contador={dados.emEstudo.length}
              vazio="Nada em estudo agora."
              cartoes={cartoes(dados.emEstudo)}
            />
            <Coluna
              titulo={NOME_COLUNA.CONCLUIDO}
              marcador="bg-raiz-musgo"
              contador={dados.totalConcluidos}
              vazio="Nenhum tópico concluído ainda."
              cartoes={cartoes(dados.concluidos)}
              rodape={
                dados.totalConcluidos > 0 && (
                  <Link
                    href="/estudos/historico"
                    className="self-center rounded-full px-3 py-1.5 text-raiz-meta text-raiz-texto-terciario hover:bg-raiz-sand hover:text-raiz-marrom"
                  >
                    {noHistorico > 0 ? `+ ${noHistorico} no histórico` : "Ver histórico"}
                  </Link>
                )
              }
            />
          </div>
        )}
      </AreaConteudo>

      <ModalTopico edicao={edicao} onFechar={() => setEdicao(null)} />
      <GestaoLabels aberto={gestaoAberta} onFechar={() => setGestaoAberta(false)} />
    </>
  );
}
