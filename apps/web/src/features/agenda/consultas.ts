"use client";

import type { Atendimento, DataLocal, Encerramento, Remarcacao } from "@raiz/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { chamarApi } from "@/lib/api-cliente";

export const chaveAtendimentos = ["atendimentos"] as const;

export function useAtendimentos(de: DataLocal, ate: DataLocal) {
  return useQuery({
    queryKey: [...chaveAtendimentos, de, ate],
    queryFn: () => chamarApi<Atendimento[]>(`/atendimentos?de=${de}&ate=${ate}`),
    placeholderData: (anteriores) => anteriores,
  });
}

type Transicao =
  | { acao: "realizar"; id: string }
  | { acao: "cancelar" | "falta"; id: string; dados: Encerramento }
  | { acao: "remarcar"; id: string; dados: Remarcacao };

/** Toda mudança de atendimento invalida a agenda inteira em cache. */
export function useTransicao() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (t: Transicao) =>
      chamarApi<Atendimento>(`/atendimentos/${t.id}/${t.acao}`, {
        method: "POST",
        corpo: "dados" in t ? t.dados : undefined,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chaveAtendimentos }),
  });
}
