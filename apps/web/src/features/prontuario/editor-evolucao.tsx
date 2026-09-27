"use client";

import { horaLocal, TEXTO_EVOLUCAO_MAX, type RascunhoEvolucao } from "@raiz/shared";
import { useId, useState } from "react";
import { Botao } from "@/components/ui/botao";
import { ErroApi } from "@/lib/api-cliente";
import { descartarRascunho, gravarEvolucao } from "./consultas";
import { quando } from "./formatar";
import { ModalReautenticacao, useSessaoDoEditor } from "./reautenticacao";
import { useRascunhoAutomatico, type SituacaoRascunho } from "./use-rascunho-automatico";

type EditorEvolucaoProps = {
  pacienteId: string;
  atendimento: { id: string; inicio: string } | null;
  /** Rascunho retomado, quando a profissional escolheu continuar. */
  rascunho: RascunhoEvolucao | null;
  onGravada: () => void;
  onFechar: () => void;
};

function legenda(situacao: SituacaoRascunho, salvoEm: string | null): string {
  switch (situacao) {
    case "vazio":
      return "O texto é salvo como rascunho, cifrado, enquanto você escreve.";
    case "pendente":
      return "Alterações ainda não salvas…";
    case "salvando":
      return "Salvando rascunho…";
    case "salvo":
      return salvoEm ? `Rascunho salvo às ${horaLocal(salvoEm)}` : "Rascunho salvo";
    case "erro":
      return "Não foi possível salvar o rascunho agora.";
    case "sem-sessao":
      return "Sessão expirada — o texto está preservado aqui.";
  }
}

/**
 * Editor de nova evolução: `textarea` simples, sem editor rico (design.md,
 * "Frontend"). A data e a hora do registro são atribuídas pelo servidor ao
 * gravar; nada aqui as edita.
 */
export function EditorEvolucao({
  pacienteId,
  atendimento,
  rascunho,
  onGravada,
  onFechar,
}: EditorEvolucaoProps) {
  const campoId = useId();
  const [texto, setTexto] = useState(rascunho?.texto ?? "");
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const atendimentoId = atendimento?.id ?? null;

  const sessao = useSessaoDoEditor(texto.trim().length > 0);
  const auto = useRascunhoAutomatico({
    chave: { pacienteId, atendimentoId },
    texto,
    textoSalvo: rascunho?.texto ?? "",
    ativo: !sessao.semSessao && !gravando,
    aoPerderSessao: sessao.perdeuSessao,
  });

  async function gravar() {
    if (!texto.trim()) {
      setErro("Escreva a evolução antes de gravar.");
      return;
    }
    setErro(null);
    setGravando(true);
    try {
      // Nenhum salvamento pode chegar ao servidor depois da gravação e
      // recriar o rascunho que ela consome.
      await auto.descarregar();
      await gravarEvolucao(pacienteId, texto, atendimentoId);
      onGravada();
    } catch (falha) {
      if (falha instanceof ErroApi && falha.status === 401) sessao.perdeuSessao();
      else setErro(falha instanceof Error ? falha.message : String(falha));
      setGravando(false);
    }
  }

  async function fechar() {
    if (auto.situacao === "pendente") auto.salvarAgora();
    await auto.descarregar();
    onFechar();
  }

  async function descartar() {
    if (!window.confirm("Descartar este rascunho? O texto não poderá ser recuperado.")) return;
    await auto.descarregar();
    await descartarRascunho(pacienteId, atendimentoId);
    onFechar();
  }

  return (
    <section
      aria-labelledby={`${campoId}-titulo`}
      className="flex flex-col gap-3 rounded-[14px] border-[1.5px] border-raiz-vinho/40 bg-raiz-superficie px-[18px] py-4"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3
          id={`${campoId}-titulo`}
          className="font-raiz-display text-raiz-titulo-card font-semibold text-raiz-marrom"
        >
          Nova evolução
          <span className="ml-2 font-raiz-corpo text-raiz-meta font-normal text-raiz-texto-terciario">
            {atendimento ? `atendimento de ${quando(atendimento.inicio)}` : "avulsa"}
          </span>
        </h3>
        <span className="text-raiz-legenda text-raiz-texto-terciario">
          Data e hora do registro: as do momento da gravação.
        </span>
      </header>

      <label htmlFor={campoId} className="sr-only">
        Texto da evolução
      </label>
      <textarea
        id={campoId}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        maxLength={TEXTO_EVOLUCAO_MAX}
        rows={14}
        autoFocus
        disabled={gravando}
        aria-invalid={erro ? true : undefined}
        aria-describedby={`${campoId}-situacao`}
        className="min-h-60 resize-y rounded-raiz-campo border-[1.5px] border-raiz-borda-forte bg-raiz-superficie px-3.5 py-3 text-raiz-corpo leading-relaxed text-raiz-marrom focus:border-raiz-vinho focus:outline-none disabled:opacity-60"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p
          id={`${campoId}-situacao`}
          aria-live="polite"
          className={`text-raiz-meta ${
            auto.situacao === "erro" || auto.situacao === "sem-sessao"
              ? "font-semibold text-raiz-vinho"
              : "text-raiz-texto-terciario"
          }`}
        >
          {legenda(auto.situacao, auto.salvoEm ?? rascunho?.atualizadoEm ?? null)}
          {auto.situacao === "erro" && (
            <button
              type="button"
              onClick={auto.salvarAgora}
              className="ml-2 font-semibold underline hover:text-raiz-vinho-escuro"
            >
              Tentar agora
            </button>
          )}
        </p>
        <span className="font-raiz-mono text-raiz-legenda text-raiz-texto-terciario">
          {texto.length.toLocaleString("pt-BR")} caracteres
        </span>
      </div>

      {erro && (
        <p
          role="alert"
          className="rounded-raiz-campo bg-raiz-vinho-suave px-3.5 py-2.5 text-raiz-corpo-sm font-semibold text-raiz-vinho"
        >
          {erro}
        </p>
      )}

      <footer className="flex flex-wrap justify-end gap-2.5">
        {(rascunho || auto.situacao !== "vazio") && (
          <Botao variante="secundario" onClick={descartar} disabled={gravando}>
            Descartar rascunho
          </Botao>
        )}
        <Botao variante="secundario" onClick={fechar} disabled={gravando}>
          Fechar e continuar depois
        </Botao>
        <Botao onClick={gravar} disabled={gravando || sessao.semSessao}>
          {gravando ? "Gravando…" : "Gravar evolução"}
        </Botao>
      </footer>

      <ModalReautenticacao
        aberto={sessao.semSessao}
        onEntrou={() => {
          sessao.reautenticou();
          // Reenvia o texto integral, inclusive o trecho posterior ao último
          // salvamento, que só existia aqui.
          auto.salvarAgora();
        }}
      />
    </section>
  );
}
