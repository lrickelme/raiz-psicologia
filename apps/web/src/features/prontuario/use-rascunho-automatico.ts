"use client";

import type { ChaveRascunho, RascunhoSalvo } from "@raiz/shared";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { chamarApi, ErroApi } from "@/lib/api-cliente";

/** Pausa de digitação que dispara o salvamento. */
const PAUSA_MS = 1500;

export type SituacaoRascunho = "vazio" | "pendente" | "salvando" | "salvo" | "erro" | "sem-sessao";

type Opcoes = {
  chave: ChaveRascunho;
  texto: string;
  /** Texto que já está no servidor quando o editor abre (rascunho retomado). */
  textoSalvo: string;
  /** Desligado enquanto a sessão está perdida ou a evolução está sendo gravada. */
  ativo: boolean;
  aoPerderSessao: () => void;
};

/**
 * Salva o texto como rascunho no servidor a cada pausa de digitação (spec
 * prontuario, "Rascunho sem perda"; design.md, "Salvamento em voo").
 *
 * - Os salvamentos vão em fila, um de cada vez, sempre com o texto mais atual
 *   no momento do envio: o servidor nunca recebe uma versão antiga depois de
 *   uma nova.
 * - Cada um leva um número de sequência; resposta de número menor que o
 *   último aplicado é ignorada, para o indicador não voltar para trás.
 * - `descarregar` cancela o salvamento agendado e aguarda o que está em voo.
 *   Quem grava a evolução chama antes do POST: abortar o fetch não impediria
 *   o servidor de gravar depois e recriar o rascunho consumido.
 * - Um 401 não leva ao login: vira `sem-sessao`, e o texto fica no editor.
 */
export function useRascunhoAutomatico({ chave, texto, textoSalvo, ativo, aoPerderSessao }: Opcoes) {
  const [situacao, setSituacao] = useState<SituacaoRascunho>(textoSalvo ? "salvo" : "vazio");
  const [salvoEm, setSalvoEm] = useState<string | null>(null);

  const textoAtual = useRef(texto);
  const ultimoSalvo = useRef(textoSalvo);
  const agendado = useRef<number | null>(null);
  const fila = useRef<Promise<void>>(Promise.resolve());
  const sequencia = useRef(0);
  const aplicada = useRef(0);
  const aoPerder = useRef(aoPerderSessao);
  useLayoutEffect(() => {
    textoAtual.current = texto;
    aoPerder.current = aoPerderSessao;
  });
  const { pacienteId, atendimentoId } = chave;

  const salvarAgora = useCallback(() => {
    if (agendado.current !== null) window.clearTimeout(agendado.current);
    agendado.current = null;
    const numero = ++sequencia.current;
    setSituacao("salvando");

    fila.current = fila.current.then(async () => {
      const enviado = textoAtual.current;
      try {
        const resposta = await chamarApi<RascunhoSalvo>("/prontuario/rascunho", {
          method: "PUT",
          corpo: { pacienteId, atendimentoId: atendimentoId ?? null, texto: enviado },
          redirecionarEm401: false,
        });
        if (numero < aplicada.current) return;
        aplicada.current = numero;
        ultimoSalvo.current = enviado;
        setSalvoEm(resposta.atualizadoEm);
        setSituacao(textoAtual.current === enviado ? "salvo" : "pendente");
      } catch (erro) {
        if (erro instanceof ErroApi && erro.status === 401) {
          setSituacao("sem-sessao");
          aoPerder.current();
        } else {
          setSituacao("erro");
        }
      }
    });
  }, [pacienteId, atendimentoId]);

  useEffect(() => {
    if (!ativo || texto === ultimoSalvo.current) return;
    setSituacao((atual) => (atual === "salvando" ? atual : "pendente"));
    if (agendado.current !== null) window.clearTimeout(agendado.current);
    agendado.current = window.setTimeout(salvarAgora, PAUSA_MS);
  }, [texto, ativo, salvarAgora]);

  useEffect(
    () => () => {
      if (agendado.current !== null) window.clearTimeout(agendado.current);
    },
    [],
  );

  // Fechar a aba com texto ainda não salvo pede confirmação ao navegador.
  const naoSalvo = situacao === "pendente" || situacao === "salvando" || situacao === "sem-sessao";
  useEffect(() => {
    if (!naoSalvo) return;
    const avisar = (evento: BeforeUnloadEvent) => evento.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [naoSalvo]);

  /** Cancela o agendado e espera o que já saiu. Chamar antes de gravar a evolução. */
  const descarregar = useCallback(async () => {
    if (agendado.current !== null) window.clearTimeout(agendado.current);
    agendado.current = null;
    await fila.current;
  }, []);

  return { situacao, salvoEm, salvarAgora, descarregar };
}
