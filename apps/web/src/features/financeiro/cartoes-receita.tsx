import type { Receita } from "@raiz/shared";
import type { ReactNode } from "react";
import { formatarDinheiro } from "@/lib/formatar";

function Cartao({
  rotulo,
  valor,
  nota,
  className,
}: {
  rotulo: string;
  valor: string;
  nota: ReactNode;
  className: string;
}) {
  return (
    <section aria-label={rotulo} className={`rounded-raiz-card px-[17px] py-4 ${className}`}>
      <h2 className="text-raiz-meta text-raiz-texto-terciario">{rotulo}</h2>
      <p className="mt-1.5 font-raiz-display text-[26px] font-semibold text-raiz-marrom">{valor}</p>
      <p className="mt-1 text-raiz-meta font-semibold">{nota}</p>
    </section>
  );
}

/**
 * Realizada, prevista e pendentes lado a lado, nunca somadas (spec
 * financeiro). A diferença não fica só na cor: a prevista tem borda
 * tracejada e cada cartão diz em texto o que conta.
 */
export function CartoesReceita({ receita, semAtendimentos }: { receita: Receita; semAtendimentos: boolean }) {
  const { realizada, prevista, pendentes } = receita;
  return (
    <div className="grid grid-cols-3 gap-3.5">
      <Cartao
        rotulo="Receita realizada"
        valor={formatarDinheiro(realizada)}
        className="border border-raiz-borda bg-raiz-superficie"
        nota={
          semAtendimentos ? (
            <span className="text-raiz-texto-terciario">Nenhum atendimento no período</span>
          ) : (
            <span className="text-raiz-musgo">Realizados, faltas e cancelamentos cobráveis</span>
          )
        }
      />
      <Cartao
        rotulo="Receita prevista"
        valor={prevista === null ? "—" : formatarDinheiro(prevista)}
        className="border-[1.5px] border-dashed border-raiz-borda-forte bg-raiz-superficie"
        nota={
          <span className="text-raiz-texto-terciario">
            {prevista === null
              ? "Só o mês corrente tem previsão"
              : "Agendados ainda por acontecer neste mês"}
          </span>
        }
      />
      <Cartao
        rotulo="Pendentes de encerramento"
        valor={formatarDinheiro(pendentes.valor)}
        className={
          pendentes.quantidade
            ? "border border-raiz-ambar bg-raiz-ambar-suave"
            : "border border-raiz-borda bg-raiz-superficie"
        }
        nota={
          pendentes.quantidade ? (
            <span className="text-raiz-ambar-escuro">
              ▲ {pendentes.quantidade}{" "}
              {pendentes.quantidade === 1
                ? "atendimento já passou e não foi encerrado"
                : "atendimentos já passaram e não foram encerrados"}
            </span>
          ) : (
            <span className="text-raiz-texto-terciario">Nenhum atendimento sem encerramento</span>
          )
        }
      />
    </div>
  );
}
