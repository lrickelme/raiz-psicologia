"use client";

import type { ReceitaPorPaciente, StatusAtendimento } from "@raiz/shared";
import Link from "next/link";
import { useState } from "react";
import { Bar, BarChart, LabelList, Rectangle, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Avatar } from "@/components/ui/avatar";
import { formatarDinheiro } from "@/lib/formatar";
import { useCoresGrafico } from "./cores";
import { ehZero, somarDinheiro } from "./dinheiro";
import { Vazio } from "./painel";

const POR_PAGINA = 20;
const NO_GRAFICO = 10;

/** Colunas de contagem, na ordem de leitura: o que gera receita, depois o que não gera. */
const COLUNAS: { status: StatusAtendimento; rotulo: string }[] = [
  { status: "REALIZADO", rotulo: "Realizadas" },
  { status: "FALTA", rotulo: "Faltas" },
  { status: "CANCELADO", rotulo: "Canceladas" },
  { status: "REMARCADO", rotulo: "Remarcadas" },
  { status: "AGENDADO", rotulo: "Agendadas" },
];

const botaoPagina =
  "rounded-full border-[1.5px] border-raiz-borda-forte px-4 py-1.5 text-raiz-corpo-sm font-semibold text-raiz-marrom hover:bg-raiz-sand disabled:pointer-events-none disabled:opacity-40";

/**
 * A visão primária (design.md, "Frontend"): o número de cada paciente, na
 * ordem de valor que a API devolve. Paginada no cliente — a lista é limitada
 * pelo número de pacientes do período, não pelo histórico.
 */
export function TabelaPorPaciente({ linhas }: { linhas: ReceitaPorPaciente[] }) {
  const [pagina, setPagina] = useState(1);
  const paginas = Math.max(1, Math.ceil(linhas.length / POR_PAGINA));
  const visiveis = linhas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  if (!linhas.length) return <Vazio>Nenhum atendimento no período.</Vazio>;

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <caption className="sr-only">Receita e atendimentos por paciente no período, do maior valor para o menor</caption>
          <thead>
            <tr className="border-b-[1.5px] border-raiz-borda-forte text-raiz-legenda tracking-[0.05em] text-raiz-texto-terciario uppercase">
              <th scope="col" className="py-2 text-left font-semibold">Paciente</th>
              {COLUNAS.map((c) => (
                <th key={c.status} scope="col" className="px-2 py-2 text-center font-semibold">
                  {c.rotulo}
                </th>
              ))}
              <th scope="col" className="py-2 text-right font-semibold">Total cobrado</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map(({ paciente, total, contagem }) => (
              <tr key={paciente.id} className="border-b border-raiz-borda last:border-b-0">
                <th scope="row" className="py-2.5 text-left font-normal">
                  <Link
                    href={`/pacientes/${paciente.id}`}
                    className="flex min-w-0 items-center gap-[11px] rounded-raiz-campo hover:text-raiz-vinho focus-visible:outline-2 focus-visible:outline-raiz-vinho"
                  >
                    <Avatar nome={paciente.nome} />
                    <span className="truncate text-raiz-corpo font-semibold text-raiz-marrom">{paciente.nome}</span>
                    {paciente.status === "ARQUIVADO" && (
                      <span className="rounded-full bg-raiz-sand px-2.5 py-0.5 text-raiz-legenda font-semibold text-raiz-texto-terciario">
                        Arquivado
                      </span>
                    )}
                  </Link>
                </th>
                {COLUNAS.map((c) => (
                  <td
                    key={c.status}
                    className={`px-2 py-2.5 text-center text-raiz-corpo-sm ${
                      contagem[c.status] ? "text-raiz-texto-secundario" : "text-raiz-texto-inativo"
                    }`}
                  >
                    {contagem[c.status]}
                  </td>
                ))}
                <td className="py-2.5 text-right font-raiz-mono text-raiz-corpo-sm font-medium text-raiz-marrom">
                  {formatarDinheiro(total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {paginas > 1 && (
        <nav aria-label="Paginação da receita por paciente" className="flex items-center justify-between gap-3 pt-3">
          <button type="button" className={botaoPagina} disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)}>
            ← Anterior
          </button>
          <span className="font-raiz-mono text-raiz-legenda text-raiz-texto-terciario">
            página {pagina} de {paginas} · {linhas.length} pacientes
          </span>
          <button type="button" className={botaoPagina} disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)}>
            Próxima →
          </button>
        </nav>
      )}
    </>
  );
}

type Barra = { nome: string; total: string; largura: number; outros: boolean };

/**
 * Subordinado à tabela: as dez maiores e uma barra "outros" com o resto,
 * somado em centavos. Cada barra traz nome e valor em texto.
 */
export function GraficoPorPaciente({ linhas }: { linhas: ReceitaPorPaciente[] }) {
  const cores = useCoresGrafico();
  const comReceita = linhas.filter((l) => !ehZero(l.total));
  if (!comReceita.length) return <Vazio>Nenhuma receita no período.</Vazio>;
  if (!cores) return null;

  const resto = comReceita.slice(NO_GRAFICO);
  const barras: Barra[] = comReceita.slice(0, NO_GRAFICO).map((l) => ({
    nome: l.paciente.nome,
    total: l.total,
    largura: Number(l.total),
    outros: false,
  }));
  if (resto.length) {
    const total = somarDinheiro(resto.map((l) => l.total));
    barras.push({
      nome: `Outros (${resto.length} ${resto.length === 1 ? "paciente" : "pacientes"})`,
      total,
      largura: Number(total),
      outros: true,
    });
  }

  return (
    <figure>
      <figcaption className="sr-only">
        Dez maiores receitas por paciente no período; os valores exatos estão na tabela.
      </figcaption>
      <div style={{ height: barras.length * 30 + 12 }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barras} layout="vertical" margin={{ top: 0, right: 92, bottom: 0, left: 0 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="nome"
              width={150}
              tick={{ fill: cores.texto, fontSize: 12 }}
              tickFormatter={(nome: string) => (nome.length > 22 ? `${nome.slice(0, 21)}…` : nome)}
              axisLine={false}
              tickLine={false}
            />
            <Bar
              dataKey="largura"
              radius={[0, 5, 5, 0]}
              barSize={16}
              isAnimationActive={false}
              shape={(props) => (
                <Rectangle {...props} fill={(props.payload as Barra).outros ? cores.outros : cores.barra} />
              )}
            >
              <LabelList
                dataKey="total"
                position="right"
                formatter={(total) => formatarDinheiro(String(total))}
                // Como prop, não só em `style`: sem ela o `Text` do Recharts grava
                // o próprio padrão, um cinza fora dos tokens, no atributo `fill`.
                fill={cores.texto}
                style={{ fontSize: 11.5, fontFamily: "var(--font-raiz-mono)" }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
