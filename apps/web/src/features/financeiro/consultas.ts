"use client";

import type { DataLocal, Receita, ReceitaMensal, ReceitaPorPaciente } from "@raiz/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { chamarApi } from "@/lib/api-cliente";

export const chaveFinanceiro = ["financeiro"] as const;

/**
 * Uma chave por pergunta (design.md, "Um endpoint por pergunta"). Sem
 * `staleTime`: um encerramento na agenda muda estes números, e o dashboard
 * aberto logo depois não pode mostrar o valor de antes.
 */
const opcoes = { staleTime: 0, placeholderData: keepPreviousData };

export function useReceita(de: DataLocal, ate: DataLocal) {
  return useQuery({
    queryKey: [...chaveFinanceiro, "receita", de, ate],
    queryFn: () => chamarApi<Receita>(`/financeiro/receita?de=${de}&ate=${ate}`),
    ...opcoes,
  });
}

/** Não depende do filtro: é sempre a série até o mês corrente. */
export function useMensal() {
  return useQuery({
    queryKey: [...chaveFinanceiro, "mensal"],
    queryFn: () => chamarApi<ReceitaMensal[]>("/financeiro/mensal?meses=12"),
    staleTime: 0,
  });
}

export function usePorPaciente(de: DataLocal, ate: DataLocal) {
  return useQuery({
    queryKey: [...chaveFinanceiro, "por-paciente", de, ate],
    queryFn: () => chamarApi<ReceitaPorPaciente[]>(`/financeiro/por-paciente?de=${de}&ate=${ate}`),
    ...opcoes,
  });
}
