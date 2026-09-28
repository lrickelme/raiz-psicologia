"use client";

import type { ReceitaMensal } from "@raiz/shared";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatarDinheiro } from "@/lib/formatar";
import { useCoresGrafico } from "./cores";
import { ehZero } from "./dinheiro";
import { Carregando, Falha, Painel, Vazio } from "./painel";
import { rotuloMesCurto, rotuloMesLongo } from "./periodo";

/** Só para os ticks do eixo, que são da escala e não valores da API. */
const COMPACTO = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

type Ponto = { mes: string; realizada: string; altura: number };

/**
 * Sempre os últimos doze meses, com ou sem filtro (spec financeiro,
 * "Comparativo entre meses"). Com filtro ativo, o painel diz que não o segue e
 * marca com uma faixa rotulada os meses que o período alcança.
 */
export function GraficoMensal({
  serie,
  erro,
  filtroAtivo,
  mesesFiltrados,
}: {
  serie: ReceitaMensal[] | undefined;
  erro: Error | null;
  filtroAtivo: boolean;
  mesesFiltrados: { primeiro: string; ultimo: string };
}) {
  const cores = useCoresGrafico();

  const pontos: Ponto[] = (serie ?? []).map(({ mes, realizada }) => ({
    mes,
    realizada,
    // `number` só para a geometria da barra; rótulo e tooltip usam a string.
    altura: Number(realizada),
  }));
  const vazio = serie && pontos.every((p) => ehZero(p.realizada));

  // A faixa cobre os meses da série dentro do período, inclusive os parciais.
  const naFaixa = pontos.filter(
    (p) => p.mes >= mesesFiltrados.primeiro && p.mes <= mesesFiltrados.ultimo,
  );

  return (
    <Painel
      titulo="Últimos 12 meses"
      acoes={<span className="font-raiz-mono text-raiz-legenda text-raiz-texto-terciario">receita realizada</span>}
    >
      {/* Fora do estado vazio: com filtro ativo, o aviso vale mesmo sem receita. */}
      {filtroAtivo && (
        <p className="-mt-2 mb-3 text-raiz-meta text-raiz-texto-terciario">
          Este painel mostra a série completa e não segue o filtro de período
          {naFaixa.length && !vazio ? "; a faixa marca os meses do período filtrado." : "."}
        </p>
      )}
      {erro ? (
        <Falha mensagem={erro.message} />
      ) : vazio ? (
        <Vazio>Nenhuma receita realizada nos últimos 12 meses.</Vazio>
      ) : !serie || !cores ? (
        <Carregando />
      ) : (
        <>
          <div className="h-[210px]" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pontos} margin={{ top: 26, right: 4, bottom: 0, left: 4 }}>
                <CartesianGrid vertical={false} stroke={cores.grade} />
                {filtroAtivo && naFaixa.length > 0 && (
                  <ReferenceArea
                    x1={naFaixa[0].mes}
                    x2={naFaixa[naFaixa.length - 1].mes}
                    fill={cores.faixa}
                    fillOpacity={1}
                    ifOverflow="extendDomain"
                    // Acima da área de plotagem: dentro dela, as barras cobririam o rótulo.
                    label={{ value: "período filtrado", position: "top", fill: cores.eixo, fontSize: 11 }}
                  />
                )}
                <XAxis
                  dataKey="mes"
                  tickFormatter={rotuloMesCurto}
                  tick={{ fill: cores.eixo, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  width={64}
                  tickFormatter={(v: number) => COMPACTO.format(v)}
                  tick={{ fill: cores.eixo, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: cores.cursor }}
                  content={({ active, payload }) => {
                    const ponto = payload?.[0]?.payload as Ponto | undefined;
                    if (!active || !ponto) return null;
                    return (
                      <div className="rounded-raiz-campo border border-raiz-borda bg-raiz-superficie px-3 py-2 text-raiz-meta shadow-raiz-segmento">
                        <div className="text-raiz-texto-terciario first-letter:uppercase">
                          {rotuloMesLongo(ponto.mes)}
                        </div>
                        <div className="font-raiz-mono font-semibold text-raiz-marrom">
                          {formatarDinheiro(ponto.realizada)}
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="altura" fill={cores.barra} radius={[5, 5, 0, 0]} maxBarSize={40} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <details className="mt-3 text-raiz-corpo-sm">
            <summary className="cursor-pointer font-semibold text-raiz-vinho">Ver valores por mês</summary>
            <table className="mt-2 w-full">
              <caption className="sr-only">Receita realizada nos últimos 12 meses</caption>
              <thead>
                <tr className="text-raiz-legenda tracking-[0.05em] text-raiz-texto-terciario uppercase">
                  <th scope="col" className="py-1.5 text-left font-semibold">Mês</th>
                  <th scope="col" className="py-1.5 text-right font-semibold">Receita realizada</th>
                </tr>
              </thead>
              <tbody>
                {pontos.map((p) => {
                  const noPeriodo = filtroAtivo && naFaixa.includes(p);
                  return (
                    <tr key={p.mes} className="border-t border-raiz-borda">
                      <th scope="row" className="py-1.5 text-left font-normal text-raiz-texto-secundario first-letter:uppercase">
                        {rotuloMesLongo(p.mes)}
                        {noPeriodo && (
                          <span className="ml-2 text-raiz-legenda text-raiz-texto-terciario">· no período filtrado</span>
                        )}
                      </th>
                      <td className="py-1.5 text-right font-raiz-mono text-raiz-marrom">
                        {formatarDinheiro(p.realizada)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </details>
        </>
      )}
    </Painel>
  );
}
