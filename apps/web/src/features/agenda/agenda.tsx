"use client";

import { dataLocal, hojeLocal, type DataLocal } from "@raiz/shared";
import { useState } from "react";
import { CabecalhoPagina } from "@/components/shell/cabecalho-pagina";
import { Botao } from "@/components/ui/botao";
import {
  COOKIE_ENCERRADOS,
  COOKIE_VISAO,
  diasVisiveis,
  janelaDeBusca,
  navegar,
  OCUPA,
  rotuloMeses,
  salvarPreferencia,
  titulo,
  VISOES,
  type Visao,
} from "./calendario";
import { useAtendimentos } from "./consultas";
import { GradeHorarios } from "./grade-horarios";
import { GradeMes } from "./grade-mes";
import { ModalAtendimento, type Selecao } from "./modal-atendimento";
import { ModalNovoAtendimento, type Rascunho } from "./modal-novo-atendimento";

type Props = {
  visaoInicial: Visao;
  encerradosInicial: boolean;
  hojeServidor: DataLocal;
  abrirNovo: boolean;
};

export function Agenda({ visaoInicial, encerradosInicial, hojeServidor, abrirNovo }: Props) {
  const [visao, setVisao] = useState<Visao>(visaoInicial);
  const [referencia, setReferencia] = useState<DataLocal>(hojeServidor);
  const [mostrarEncerrados, setMostrarEncerrados] = useState(encerradosInicial);
  const [rascunho, setRascunho] = useState<Rascunho | null>(
    abrirNovo ? { data: hojeServidor, inicioMin: 9 * 60, fimMin: 9 * 60 + 50 } : null,
  );
  const [selecao, setSelecao] = useState<Selecao | null>(null);

  // "Hoje" sempre em São Paulo, qualquer que seja o fuso do navegador.
  const hoje = hojeLocal();
  const dias = diasVisiveis(visao, referencia);
  const { de, ate } = janelaDeBusca(visao, referencia);
  const { data: atendimentos = [], error } = useAtendimentos(de, ate);
  const exibidos = mostrarEncerrados ? atendimentos : atendimentos.filter((a) => OCUPA[a.status]);

  function escolherVisao(nova: Visao) {
    setVisao(nova);
    salvarPreferencia(COOKIE_VISAO, nova);
  }

  function alternarEncerrados() {
    const novo = !mostrarEncerrados;
    setMostrarEncerrados(novo);
    salvarPreferencia(COOKIE_ENCERRADOS, novo ? "1" : "0");
  }

  const visiveis = new Set(dias);
  const totalNaVisao = atendimentos.filter(
    (a) => OCUPA[a.status] && visiveis.has(dataLocal(a.inicio)),
  ).length;

  return (
    <>
      <CabecalhoPagina
        titulo="Agenda"
        descricao={`${titulo(visao, referencia)} · ${totalNaVisao} ${totalNaVisao === 1 ? "sessão" : "sessões"}`}
        acoes={
          <>
            <div role="group" aria-label="Visão" className="flex rounded-full border border-raiz-borda bg-raiz-sand p-[3px]">
              {VISOES.map((v) => (
                <button
                  key={v.valor}
                  type="button"
                  aria-pressed={visao === v.valor}
                  onClick={() => escolherVisao(v.valor)}
                  className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold ${
                    visao === v.valor
                      ? "bg-raiz-superficie text-raiz-marrom shadow-raiz-segmento"
                      : "text-raiz-texto-terciario hover:text-raiz-marrom"
                  }`}
                >
                  {v.rotulo}
                </button>
              ))}
            </div>
            <Botao
              onClick={() => setRascunho({ data: visao === "dia" ? referencia : hoje, inicioMin: 9 * 60, fimMin: 9 * 60 + 50 })}
            >
              + Nova consulta
            </Botao>
          </>
        }
      />

      <div className="flex flex-col gap-3.5 px-raiz-conteudo-x pt-[18px] pb-[26px]">
        <div className="flex flex-wrap items-center gap-2">
          {([-1, 1] as const).map((sentido) => (
            <button
              key={sentido}
              type="button"
              aria-label={sentido < 0 ? "Período anterior" : "Próximo período"}
              onClick={() => setReferencia(navegar(visao, referencia, sentido))}
              className="flex size-[30px] items-center justify-center rounded-[9px] border border-raiz-borda-forte bg-raiz-superficie text-raiz-texto-terciario hover:text-raiz-marrom"
            >
              {sentido < 0 ? "‹" : "›"}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setReferencia(hoje)}
            className="rounded-[9px] border border-raiz-borda-forte bg-raiz-superficie px-3 py-1 text-raiz-corpo-sm font-semibold text-raiz-marrom hover:bg-raiz-sand"
          >
            Hoje
          </button>
          <span className="ml-1.5 font-raiz-display text-raiz-titulo-card font-semibold text-raiz-marrom">
            {rotuloMeses(visao === "mes" ? [referencia] : dias)}
          </span>
          <div className="flex-1" />
          <label className="flex items-center gap-2 text-raiz-rotulo text-raiz-texto-terciario">
            <input type="checkbox" checked={mostrarEncerrados} onChange={alternarEncerrados} className="accent-raiz-vinho" />
            Mostrar cancelados e remarcados
          </label>
          <div className="flex gap-3.5 text-raiz-rotulo text-raiz-texto-terciario">
            <Legenda cor="bg-raiz-musgo" rotulo="Realizada" />
            <Legenda cor="bg-raiz-ambar" rotulo="Agendada" />
            <Legenda cor="bg-raiz-vinho" rotulo="Falta" />
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-raiz-campo bg-raiz-vinho-suave px-3.5 py-2.5 text-raiz-corpo-sm font-semibold text-raiz-vinho">
            {error.message}
          </p>
        )}

        {visao === "mes" ? (
          <GradeMes
            dias={dias}
            mesDeReferencia={referencia.slice(0, 7)}
            hoje={hoje}
            atendimentos={exibidos}
            onAbrirDia={(dia) => {
              // Atalho, não troca de preferência: a visão salva continua a mensal.
              setReferencia(dia);
              setVisao("dia");
            }}
            onSelecionar={setSelecao}
          />
        ) : (
          <GradeHorarios
            dias={dias}
            hoje={hoje}
            atendimentos={exibidos}
            onNovo={setRascunho}
            onSelecionar={setSelecao}
          />
        )}
      </div>

      <ModalNovoAtendimento rascunho={rascunho} onFechar={() => setRascunho(null)} atendimentos={atendimentos} />
      <ModalAtendimento selecao={selecao} onFechar={() => setSelecao(null)} atendimentos={atendimentos} />
    </>
  );
}

function Legenda({ cor, rotulo }: { cor: string; rotulo: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className={`size-[9px] rounded-[3px] ${cor}`} />
      {rotulo}
    </span>
  );
}
