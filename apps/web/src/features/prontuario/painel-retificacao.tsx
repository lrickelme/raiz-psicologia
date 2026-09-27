"use client";

import { TEXTO_EVOLUCAO_MAX, type Evolucao } from "@raiz/shared";
import { useId, useState } from "react";
import { Botao } from "@/components/ui/botao";
import { ErroApi } from "@/lib/api-cliente";
import { retificarEvolucao } from "./consultas";
import { quando } from "./formatar";
import { ModalReautenticacao, useSessaoDoEditor } from "./reautenticacao";

type PainelRetificacaoProps = {
  evolucao: Evolucao;
  onRetificada: () => void;
  onCancelar: () => void;
};

/**
 * Corrigir não edita: cria versão nova e preserva a atual, que passa a
 * constar como retificada (spec prontuario, "Retificação versionada"). A
 * versão vigente fica visível ao lado durante a escrita.
 */
export function PainelRetificacao({ evolucao, onRetificada, onCancelar }: PainelRetificacaoProps) {
  const campoId = useId();
  const [texto, setTexto] = useState(evolucao.texto);
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const alterado = texto !== evolucao.texto;
  const sessao = useSessaoDoEditor(alterado);

  async function gravar() {
    if (!texto.trim()) {
      setErro("Escreva o texto corrigido antes de gravar.");
      return;
    }
    setErro(null);
    setGravando(true);
    try {
      await retificarEvolucao(evolucao.id, texto);
      onRetificada();
    } catch (falha) {
      if (falha instanceof ErroApi && falha.status === 401) sessao.perdeuSessao();
      else setErro(falha instanceof Error ? falha.message : String(falha));
      setGravando(false);
    }
  }

  return (
    <section
      aria-labelledby={`${campoId}-titulo`}
      className="flex flex-col gap-3 rounded-[14px] border-[1.5px] border-raiz-ambar/50 bg-raiz-superficie px-[18px] py-4"
    >
      <header className="flex flex-col gap-0.5">
        <h3
          id={`${campoId}-titulo`}
          className="font-raiz-display text-raiz-titulo-card font-semibold text-raiz-marrom"
        >
          Retificar evolução
        </h3>
        <p className="text-raiz-meta text-raiz-texto-terciario">
          A versão atual não é apagada: fica no histórico, marcada como retificada. A nova versão
          recebe data e hora próprias ao ser gravada.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className="text-raiz-corpo-sm font-semibold text-raiz-marrom">
            Versão vigente · {quando(evolucao.registradoEm)}
          </span>
          <p className="max-h-[28rem] overflow-y-auto rounded-raiz-campo border border-raiz-borda bg-raiz-areia px-3.5 py-3 text-raiz-corpo leading-relaxed whitespace-pre-wrap text-raiz-texto-secundario">
            {evolucao.texto}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={campoId} className="text-raiz-corpo-sm font-semibold text-raiz-marrom">
            Texto corrigido
          </label>
          <textarea
            id={campoId}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={TEXTO_EVOLUCAO_MAX}
            rows={14}
            autoFocus
            disabled={gravando}
            className="min-h-60 resize-y rounded-raiz-campo border-[1.5px] border-raiz-borda-forte bg-raiz-superficie px-3.5 py-3 text-raiz-corpo leading-relaxed text-raiz-marrom focus:border-raiz-vinho focus:outline-none disabled:opacity-60"
          />
          <span className="self-end font-raiz-mono text-raiz-legenda text-raiz-texto-terciario">
            {texto.length.toLocaleString("pt-BR")} caracteres
          </span>
        </div>
      </div>

      {erro && (
        <p
          role="alert"
          className="rounded-raiz-campo bg-raiz-vinho-suave px-3.5 py-2.5 text-raiz-corpo-sm font-semibold text-raiz-vinho"
        >
          {erro}
        </p>
      )}

      <footer className="flex justify-end gap-2.5">
        <Botao
          variante="secundario"
          disabled={gravando}
          onClick={() => {
            if (!alterado || window.confirm("Descartar o texto corrigido?")) onCancelar();
          }}
        >
          Cancelar
        </Botao>
        <Botao onClick={gravar} disabled={gravando || !alterado || sessao.semSessao}>
          {gravando ? "Gravando…" : "Gravar retificação"}
        </Botao>
      </footer>

      <ModalReautenticacao aberto={sessao.semSessao} onEntrou={sessao.reautenticou} />
    </section>
  );
}
