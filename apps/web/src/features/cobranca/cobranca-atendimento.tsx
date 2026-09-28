"use client";

import { dataLocal, type Atendimento, type Dispensa } from "@raiz/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AreaTexto } from "@/components/ui/area-texto";
import { Botao } from "@/components/ui/botao";
import { Modal } from "@/components/ui/modal";
import { chaveAtendimentos } from "@/features/agenda/consultas";
import { chaveFinanceiro } from "@/features/financeiro/consultas";
import { chamarApi, ErroApi } from "@/lib/api-cliente";
import { formatarData, formatarDinheiro } from "@/lib/formatar";

/** Só o que é cobrável tem cobrança a dispensar (spec agenda, "Dispensa de cobrança"). */
export const temCobranca = (a: Atendimento) => a.cobravel === true;

/** Por que a regra tornou o atendimento cobrável, em texto: é o que ela decide dispensar. */
function porQueCobravel(a: Atendimento): string {
  switch (a.status) {
    case "REALIZADO":
      return "Atendimento realizado: sempre cobrável.";
    case "FALTA":
      return "Falta: sempre cobrável.";
    case "CANCELADO":
      return "Cancelado no próprio dia da consulta: cancelamento no dia é cobrável.";
    default:
      return "Cobrável pela regra vigente no encerramento.";
  }
}

/**
 * Dispensar ou reverter a cobrança de um atendimento — o conteúdo único que o
 * histórico do paciente abre num modal e o detalhe da agenda mostra como um
 * de seus modos. Exibe o valor congelado e o motivo da cobrabilidade antes da
 * decisão; havendo dispensa, o motivo registrado e a reversão.
 */
export function CobrancaAtendimento({
  atendimento,
  onConcluir,
  onVoltar,
}: {
  atendimento: Atendimento;
  onConcluir: () => void;
  onVoltar: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  // A grade da agenda não carrega o motivo da dispensa: busca o detalhe.
  const detalhe = useQuery({
    queryKey: [...chaveAtendimentos, "detalhe", atendimento.id],
    queryFn: () => chamarApi<Atendimento>(`/atendimentos/${atendimento.id}`),
    enabled: atendimento.cobrancaDispensada && atendimento.motivoDispensa === undefined,
  });
  const motivoRegistrado = atendimento.motivoDispensa ?? detalhe.data?.motivoDispensa;

  const alterar = useMutation({
    mutationFn: (corpo: Dispensa | null) =>
      chamarApi<Atendimento>(
        `/atendimentos/${atendimento.id}/${corpo ? "dispensar-cobranca" : "reverter-dispensa"}`,
        { method: "POST", corpo: corpo ?? undefined },
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: chaveAtendimentos }),
        queryClient.invalidateQueries({ queryKey: chaveFinanceiro }),
      ]);
      // O perfil do paciente é renderizado no servidor.
      router.refresh();
      onConcluir();
    },
    onError: (e) => setErro(e instanceof ErroApi && e.campos.length ? e.campos[0].mensagem : e.message),
  });

  const resumo = (
    <dl className="flex flex-col gap-2 rounded-raiz-campo border border-raiz-borda px-3.5 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-raiz-meta text-raiz-texto-terciario">
          {atendimento.paciente.nome} · {formatarData(dataLocal(atendimento.inicio))}
        </dt>
        <dd className="font-raiz-mono text-raiz-corpo font-semibold text-raiz-marrom">
          <span className="sr-only">Valor congelado: </span>
          {formatarDinheiro(atendimento.valor)}
        </dd>
      </div>
      <div>
        <dt className="sr-only">Por que é cobrável</dt>
        <dd className="text-raiz-corpo-sm text-raiz-texto-secundario">{porQueCobravel(atendimento)}</dd>
      </div>
    </dl>
  );

  if (atendimento.cobrancaDispensada) {
    return (
      <div className="flex flex-col gap-4">
        {resumo}
        <div className="rounded-raiz-campo bg-raiz-ambar-suave px-3.5 py-3">
          <div className="text-raiz-meta font-semibold text-raiz-ambar-escuro">Cobrança dispensada · motivo registrado</div>
          <p className="mt-1 text-raiz-corpo text-raiz-texto-secundario">
            {motivoRegistrado ?? (detalhe.isError ? "Não foi possível carregar o motivo." : "Carregando…")}
          </p>
        </div>
        <p className="text-raiz-meta text-raiz-texto-terciario">
          Reverter devolve o valor à receita realizada. O motivo continua registrado, e a dispensa e a
          reversão ficam na trilha de auditoria.
        </p>
        {erro && <p role="alert" className="font-semibold text-raiz-vinho">{erro}</p>}
        <div className="flex justify-end gap-2.5">
          <Botao variante="secundario" onClick={onVoltar}>Voltar</Botao>
          <Botao disabled={alterar.isPending} onClick={() => alterar.mutate(null)}>
            {alterar.isPending ? "Revertendo…" : "Reverter dispensa"}
          </Botao>
        </div>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setErro(null);
        alterar.mutate({ motivo });
      }}
    >
      {resumo}
      <AreaTexto
        rotulo="Motivo da dispensa"
        descricao="Guardado cifrado e visível no histórico do paciente. O valor sai da receita realizada."
        autoFocus
        rows={3}
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
      />
      {erro && <p role="alert" className="font-semibold text-raiz-vinho">{erro}</p>}
      <div className="flex justify-end gap-2.5">
        <Botao variante="secundario" onClick={onVoltar}>Voltar</Botao>
        <Botao type="submit" disabled={alterar.isPending || !motivo.trim()}>
          {alterar.isPending ? "Dispensando…" : "Dispensar cobrança"}
        </Botao>
      </div>
    </form>
  );
}

export const tituloCobranca = (a: Atendimento) =>
  a.cobrancaDispensada ? "Cobrança dispensada" : "Dispensar cobrança";

/** Entrada pelo histórico do paciente: botão que abre o conteúdo num modal. */
export function AcaoCobranca({ atendimento }: { atendimento: Atendimento }) {
  const [aberto, setAberto] = useState(false);
  if (!temCobranca(atendimento)) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="self-start text-raiz-corpo-sm font-semibold text-raiz-vinho hover:underline"
      >
        {atendimento.cobrancaDispensada ? "Ver dispensa de cobrança" : "Dispensar cobrança"}
      </button>
      <Modal aberto={aberto} titulo={tituloCobranca(atendimento)} onFechar={() => setAberto(false)}>
        {aberto && (
          <CobrancaAtendimento
            atendimento={atendimento}
            onConcluir={() => setAberto(false)}
            onVoltar={() => setAberto(false)}
          />
        )}
      </Modal>
    </>
  );
}
