"use client";

import type { DataLocal } from "@raiz/shared";
import { useSearchParams } from "next/navigation";
import { CabecalhoPagina } from "@/components/shell/cabecalho-pagina";
import { AreaConteudo } from "@/components/shell/area-conteudo";
import { CartoesReceita } from "./cartoes-receita";
import { useMensal, usePorPaciente, useReceita } from "./consultas";
import { FiltroPeriodo } from "./filtro-periodo";
import { GraficoMensal } from "./grafico-mensal";
import { Carregando, Falha, Painel } from "./painel";
import { ehPadrao, intervalo, lerDaUrl, mesesDoPeriodo, paraUrl, rotulo, type Periodo } from "./periodo";
import { GraficoPorPaciente, TabelaPorPaciente } from "./receita-por-paciente";

/**
 * O filtro vive na URL (`?periodo=&ref=`) e muda por `history.pushState`: o
 * voltar do navegador volta ao período anterior, e trocar de período refaz só
 * as consultas que dependem dele, sem ida ao servidor do Next.
 */
export function Financeiro({ hoje }: { hoje: DataLocal }) {
  const params = useSearchParams();
  const periodo = lerDaUrl(params, hoje);
  const { de, ate } = intervalo(periodo);

  const receita = useReceita(de, ate);
  const mensal = useMensal();
  const porPaciente = usePorPaciente(de, ate);

  function filtrar(novo: Periodo) {
    window.history.pushState(null, "", paraUrl(novo));
  }

  const filtroAtivo = !ehPadrao(periodo, hoje);
  const linhas = porPaciente.data;
  const titulo = `Receita por paciente · ${rotulo(periodo)}`;

  return (
    <>
      <CabecalhoPagina
        titulo="Financeiro"
        descricao="Receita apurada dos atendimentos, pelo valor congelado de cada um"
        acoes={<FiltroPeriodo valor={periodo} hoje={hoje} onChange={filtrar} />}
      />
      <AreaConteudo>
        {receita.error ? (
          <Falha mensagem={receita.error.message} />
        ) : receita.data && linhas ? (
          <CartoesReceita receita={receita.data} semAtendimentos={!linhas.length} />
        ) : (
          <Carregando />
        )}

        <div className="grid grid-cols-[1.7fr_1fr] gap-3.5">
          <GraficoMensal
            serie={mensal.data}
            erro={mensal.error}
            filtroAtivo={filtroAtivo}
            mesesFiltrados={mesesDoPeriodo(periodo)}
          />
          <Painel titulo="Maiores receitas do período">
            {porPaciente.error ? (
              <Falha mensagem={porPaciente.error.message} />
            ) : linhas ? (
              <GraficoPorPaciente linhas={linhas} />
            ) : (
              <Carregando />
            )}
          </Painel>
        </div>

        <Painel
          titulo={<span className="first-letter:uppercase">{titulo}</span>}
          acoes={
            linhas && (
              <span className="font-raiz-mono text-raiz-legenda text-raiz-texto-terciario">
                {linhas.length} {linhas.length === 1 ? "paciente" : "pacientes"}
              </span>
            )
          }
        >
          {porPaciente.error ? (
            <Falha mensagem={porPaciente.error.message} />
          ) : linhas ? (
            // Chave por período: a paginação volta à primeira página a cada filtro.
            <TabelaPorPaciente key={`${de}-${ate}`} linhas={linhas} />
          ) : (
            <Carregando />
          )}
        </Painel>
      </AreaConteudo>
    </>
  );
}
