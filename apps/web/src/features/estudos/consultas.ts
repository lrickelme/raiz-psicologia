"use client";

import {
  CONCLUIDOS_NO_QUADRO,
  dataLocal,
  hojeLocal,
  type LabelComUso,
  type PaginaConcluidos,
  type QuadroEstudos,
  type StatusTopico,
  type Topico,
} from "@raiz/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { chamarApi } from "@/lib/api-cliente";

/** Toda escrita do módulo invalida esta raiz: labels aparecem no quadro e no histórico. */
export const chaveEstudos = ["estudos"] as const;
const chaveQuadro = [...chaveEstudos, "quadro"] as const;
const chaveHistorico = [...chaveEstudos, "historico"] as const;
export const chaveLabels = [...chaveEstudos, "labels"] as const;

export function useQuadro() {
  return useQuery({
    queryKey: chaveQuadro,
    queryFn: () => chamarApi<QuadroEstudos>("/estudos/quadro"),
  });
}

export function useLabels() {
  return useQuery({
    queryKey: chaveLabels,
    queryFn: () => chamarApi<LabelComUso[]>("/labels"),
  });
}

export function useHistorico(pagina: number) {
  return useQuery({
    queryKey: [...chaveHistorico, pagina],
    queryFn: () => chamarApi<PaginaConcluidos>(`/topicos/concluidos?pagina=${pagina}`),
    placeholderData: keepPreviousData,
  });
}

/** Mesma regra do SQL: ordem da label (sem label por último), depois os mais antigos. */
function compararPendentes(a: Topico, b: Topico): number {
  const ordem = (t: Topico) => t.label?.ordem ?? Number.POSITIVE_INFINITY;
  return ordem(a) - ordem(b) || a.criadoEm.localeCompare(b.criadoEm);
}

function doMesCorrente(instante: string | null): boolean {
  return instante !== null && dataLocal(instante).slice(0, 7) === hojeLocal().slice(0, 7);
}

/** O quadro como o servidor o devolveria depois do movimento. */
function moverNoQuadro(quadro: QuadroEstudos, topico: Topico, status: StatusTopico): QuadroEstudos {
  const sem = (lista: Topico[]) => lista.filter((t) => t.id !== topico.id);
  const movido: Topico = {
    ...topico,
    status,
    concluidoEm: status === "CONCLUIDO" ? new Date().toISOString() : null,
  };
  const saiuDeConcluido = topico.status === "CONCLUIDO";
  const entrouEmConcluido = status === "CONCLUIDO";

  const novo: QuadroEstudos = {
    ...quadro,
    aEstudar: sem(quadro.aEstudar),
    emEstudo: sem(quadro.emEstudo),
    concluidos: sem(quadro.concluidos),
  };
  if (status === "A_ESTUDAR") novo.aEstudar = [...novo.aEstudar, movido].sort(compararPendentes);
  if (status === "EM_ESTUDO") novo.emEstudo = [...novo.emEstudo, movido].sort(compararPendentes);
  if (entrouEmConcluido) novo.concluidos = [movido, ...novo.concluidos].slice(0, CONCLUIDOS_NO_QUADRO);

  novo.pendentes = novo.aEstudar.length + novo.emEstudo.length;
  novo.totalConcluidos += Number(entrouEmConcluido) - Number(saiuDeConcluido);
  novo.concluidosNoMes +=
    Number(entrouEmConcluido) - Number(saiuDeConcluido && doMesCorrente(topico.concluidoEm));
  return novo;
}

type Movimento = { topico: Topico; status: StatusTopico };

/**
 * Mover é o gesto mais frequente da tela: o cartão muda de coluna na hora, e
 * um erro devolve o quadro e o histórico ao que eram (design.md, "Frontend").
 * O servidor continua sendo a fonte do instante de conclusão; a resposta
 * substitui a estimativa local ao revalidar.
 */
export function useMover() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ topico, status }: Movimento) =>
      chamarApi<Topico>(`/topicos/${topico.id}/mover`, { method: "POST", corpo: { status } }),
    onMutate: async ({ topico, status }) => {
      await queryClient.cancelQueries({ queryKey: chaveEstudos });
      const quadro = queryClient.getQueryData<QuadroEstudos>(chaveQuadro);
      const historico = queryClient.getQueriesData<PaginaConcluidos>({ queryKey: chaveHistorico });

      if (topico.status !== status) {
        if (quadro) queryClient.setQueryData(chaveQuadro, moverNoQuadro(quadro, topico, status));
        if (status !== "CONCLUIDO") {
          queryClient.setQueriesData<PaginaConcluidos>({ queryKey: chaveHistorico }, (pagina) =>
            pagina && {
              ...pagina,
              itens: pagina.itens.filter((t) => t.id !== topico.id),
              total: pagina.total - Number(pagina.itens.some((t) => t.id === topico.id)),
            },
          );
        }
      }
      return { quadro, historico };
    },
    onError: (_erro, _movimento, anterior) => {
      if (anterior?.quadro) queryClient.setQueryData(chaveQuadro, anterior.quadro);
      for (const [chave, pagina] of anterior?.historico ?? []) queryClient.setQueryData(chave, pagina);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: chaveEstudos }),
  });
}
