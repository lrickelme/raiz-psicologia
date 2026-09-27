import type {
  Evolucao,
  EvolucaoListada,
  EvolucaoResumo,
  RascunhoEvolucao,
} from "@raiz/shared";
import { chamarApi } from "@/lib/api-cliente";

/**
 * Chaves do TanStack Query do prontuário. As consultas deste módulo não se
 * refazem sozinhas (foco da janela, intervalo): cada busca da lista grava um
 * `EVOLUCAO_LISTADA` e cada texto aberto um `EVOLUCAO_LIDA`, e a trilha só
 * deve registrar o que a profissional de fato pediu.
 */
export const chaves = {
  evolucoes: (pacienteId: string) => ["prontuario", pacienteId, "evolucoes"] as const,
  evolucao: (id: string) => ["prontuario", "evolucao", id] as const,
  historico: (id: string) => ["prontuario", "historico", id] as const,
  rascunho: (pacienteId: string, atendimentoId: string | null) =>
    ["prontuario", pacienteId, "rascunho", atendimentoId] as const,
};

export const SEM_REFAZER = {
  staleTime: Infinity,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

export function listarEvolucoes(pacienteId: string) {
  return chamarApi<EvolucaoListada[]>(`/pacientes/${pacienteId}/evolucoes`);
}

export function abrirEvolucao(id: string) {
  return chamarApi<Evolucao>(`/evolucoes/${id}`);
}

export function buscarHistorico(id: string) {
  return chamarApi<Evolucao[]>(`/evolucoes/${id}/historico`);
}

function consultaRascunho(pacienteId: string, atendimentoId: string | null) {
  const params = new URLSearchParams({ pacienteId });
  if (atendimentoId) params.set("atendimentoId", atendimentoId);
  return `/prontuario/rascunho?${params}`;
}

/** `null` quando não há rascunho (a API responde 204). */
export async function buscarRascunho(pacienteId: string, atendimentoId: string | null) {
  return (
    (await chamarApi<RascunhoEvolucao | undefined>(consultaRascunho(pacienteId, atendimentoId))) ??
    null
  );
}

export function descartarRascunho(pacienteId: string, atendimentoId: string | null) {
  return chamarApi<void>(consultaRascunho(pacienteId, atendimentoId), { method: "DELETE" });
}

/** Chamadas de escrita do editor: 401 volta como erro para a reautenticação em modal. */
export function gravarEvolucao(pacienteId: string, texto: string, atendimentoId: string | null) {
  return chamarApi<EvolucaoResumo>(`/pacientes/${pacienteId}/evolucoes`, {
    method: "POST",
    corpo: { texto, atendimentoId },
    redirecionarEm401: false,
  });
}

export function retificarEvolucao(id: string, texto: string) {
  return chamarApi<EvolucaoResumo>(`/evolucoes/${id}/retificar`, {
    method: "POST",
    corpo: { texto },
    redirecionarEm401: false,
  });
}
