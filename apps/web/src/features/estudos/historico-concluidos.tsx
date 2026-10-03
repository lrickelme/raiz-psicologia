"use client";

import type { StatusTopico, Topico } from "@raiz/shared";
import Link from "next/link";
import { useState } from "react";
import { AreaConteudo } from "@/components/shell/area-conteudo";
import { CabecalhoPagina } from "@/components/shell/cabecalho-pagina";
import { Card } from "@/components/ui/card";
import { Carregando, Falha } from "@/features/financeiro/painel";
import { Paginacao } from "@/features/pacientes/paginacao";
import { formatarData } from "@/lib/formatar";
import { NOME_COLUNA } from "./cartao-topico";
import { useHistorico, useMover } from "./consultas";
import { MenuAcoes } from "./menu-acoes";
import { ModalTopico } from "./modal-topico";
import { PillLabel } from "./pill-label";

const REABRIR_EM: StatusTopico[] = ["A_ESTUDAR", "EM_ESTUDO"];

/** Todos os concluídos, do mais recente para o mais antigo (spec estudos, "Histórico"). */
export function HistoricoConcluidos({ pagina }: { pagina: number }) {
  const historico = useHistorico(pagina);
  const mover = useMover();
  const [editando, setEditando] = useState<Topico | null>(null);
  const dados = historico.data;

  return (
    <>
      <CabecalhoPagina
        titulo="Histórico de estudos"
        descricao={dados && `${dados.total} ${dados.total === 1 ? "tópico concluído" : "tópicos concluídos"}`}
        acoes={
          <Link
            href="/estudos"
            className="rounded-full border-[1.5px] border-raiz-borda-forte px-5 py-[10px] text-raiz-corpo font-semibold text-raiz-marrom hover:bg-raiz-sand"
          >
            ← Voltar ao quadro
          </Link>
        }
      />
      <AreaConteudo>
        {mover.error && (
          <p
            role="alert"
            className="rounded-raiz-campo bg-raiz-vinho-suave px-3.5 py-2.5 text-raiz-corpo-sm font-semibold text-raiz-vinho"
          >
            Não foi possível reabrir “{mover.variables?.topico.titulo}”: {mover.error.message}
          </p>
        )}
        <Card>
          {historico.error ? (
            <Falha mensagem={historico.error.message} />
          ) : !dados ? (
            <Carregando />
          ) : dados.itens.length ? (
            <>
              <ul className="flex flex-col divide-y divide-raiz-borda">
                {dados.itens.map((topico) => (
                  <li key={topico.id} className="flex items-center gap-3 py-3">
                    <span aria-hidden className="flex size-5 shrink-0 items-center justify-center rounded-[6px] bg-raiz-musgo text-[12px] text-raiz-sobre-pill">
                      ✓
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-raiz-corpo font-semibold text-raiz-marrom">{topico.titulo}</p>
                      {topico.concluidoEm && (
                        <p className="mt-0.5 font-raiz-mono text-raiz-legenda text-raiz-texto-terciario">
                          concluído {formatarData(topico.concluidoEm)}
                        </p>
                      )}
                    </div>
                    {topico.label && <PillLabel label={topico.label} />}
                    <MenuAcoes
                      rotulo={`Ações de “${topico.titulo}”`}
                      grupos={[
                        {
                          titulo: "Reabrir em…",
                          itens: REABRIR_EM.map((status) => ({
                            rotulo: NOME_COLUNA[status],
                            nome: `Reabrir em ${NOME_COLUNA[status]}`,
                            acao: () => mover.mutate({ topico, status }),
                          })),
                        },
                        { itens: [{ rotulo: "Editar", acao: () => setEditando(topico) }] },
                      ]}
                    />
                  </li>
                ))}
              </ul>
              <Paginacao
                page={dados.page}
                size={dados.size}
                total={dados.total}
                href={(p) => `/estudos/historico?pagina=${p}`}
              />
            </>
          ) : (
            <p className="py-6 text-center text-raiz-corpo text-raiz-texto-terciario">
              {pagina > 1 ? "Esta página não tem tópicos." : "Nenhum tópico concluído ainda."}
            </p>
          )}
        </Card>
      </AreaConteudo>
      <ModalTopico edicao={editando && { topico: editando }} onFechar={() => setEditando(null)} />
    </>
  );
}
