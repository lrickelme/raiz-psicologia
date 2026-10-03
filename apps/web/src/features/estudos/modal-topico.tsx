"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { topicoEntradaSchema, type Label, type Topico, type TopicoDados, type TopicoEntrada } from "@raiz/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { AreaTexto } from "@/components/ui/area-texto";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { Modal } from "@/components/ui/modal";
import { Carregando, Falha } from "@/features/financeiro/painel";
import { chamarApi, ErroApi } from "@/lib/api-cliente";
import { chaveEstudos, useLabels } from "./consultas";

type Props = {
  /** `null` fechado; sem `topico`, criação. */
  edicao: { topico?: Topico } | null;
  onFechar: () => void;
};

export function ModalTopico({ edicao, onFechar }: Props) {
  return (
    <Modal aberto={edicao !== null} titulo={edicao?.topico ? "Editar tópico" : "Novo tópico"} onFechar={onFechar}>
      {/* Remontar a cada abertura zera o formulário. */}
      {edicao && <ComLabels topico={edicao.topico} onFechar={onFechar} />}
    </Modal>
  );
}

/**
 * O formulário só monta com as labels em mãos: o `select` recebe o valor
 * inicial ao montar, e uma opção que chegasse depois não seria selecionada.
 */
function ComLabels({ topico, onFechar }: { topico?: Topico; onFechar: () => void }) {
  const labels = useLabels();
  if (labels.error) return <Falha mensagem={labels.error.message} />;
  if (!labels.data) return <Carregando />;
  return <Formulario key={topico?.id ?? "novo"} topico={topico} labels={labels.data} onFechar={onFechar} />;
}

function Formulario({ topico, labels, onFechar }: { topico?: Topico; labels: Label[]; onFechar: () => void }) {
  const queryClient = useQueryClient();
  const seletorId = useId();
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<TopicoEntrada, unknown, TopicoDados>({
    resolver: zodResolver(topicoEntradaSchema),
    defaultValues: {
      titulo: topico?.titulo ?? "",
      descricao: topico?.descricao ?? "",
      labelId: topico?.label?.id ?? null,
    },
  });

  const salvar = useMutation({
    mutationFn: (dados: TopicoDados) =>
      topico
        ? chamarApi<Topico>(`/topicos/${topico.id}`, { method: "PATCH", corpo: dados })
        : chamarApi<Topico>("/topicos", { method: "POST", corpo: dados }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chaveEstudos });
      onFechar();
    },
    // Erro por campo sem limpar os demais (spec estudos, "Título vazio").
    onError: (erro) => {
      if (erro instanceof ErroApi && erro.status === 422 && erro.campos.length) {
        for (const { caminho, mensagem } of erro.campos) {
          setError(caminho as keyof TopicoEntrada, { message: mensagem }, { shouldFocus: true });
        }
        return;
      }
      setErroGeral(erro.message);
    },
  });

  function enviar(dados: TopicoDados) {
    setErroGeral(null);
    salvar.mutate(dados);
  }

  return (
    <form onSubmit={handleSubmit(enviar)} noValidate className="flex flex-col gap-4">
      <p
        role="note"
        className="rounded-raiz-campo bg-raiz-ambar-suave px-3.5 py-2.5 text-raiz-corpo-sm text-raiz-ambar-escuro"
      >
        Estudos não é prontuário. Não registre aqui nome nem outro dado que identifique paciente.
      </p>
      <Campo rotulo="Título" autoFocus erro={errors.titulo?.message} {...register("titulo")} />
      <AreaTexto rotulo="Descrição (opcional)" rows={3} erro={errors.descricao?.message} {...register("descricao")} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor={seletorId} className="text-raiz-corpo-sm font-semibold text-raiz-marrom">
          Prioridade
        </label>
        <select
          id={seletorId}
          aria-invalid={errors.labelId ? true : undefined}
          aria-describedby={errors.labelId ? `${seletorId}-erro` : undefined}
          className={`rounded-raiz-campo border-[1.5px] bg-raiz-superficie px-3 py-[11px] text-raiz-corpo text-raiz-marrom focus:outline-none ${
            errors.labelId ? "border-raiz-vinho" : "border-raiz-borda-forte focus:border-raiz-vinho"
          }`}
          {...register("labelId", { setValueAs: (valor) => valor || null })}
        >
          <option value="">Sem prioridade</option>
          {labels.map((label) => (
            <option key={label.id} value={label.id}>
              {label.nome}
            </option>
          ))}
        </select>
        {errors.labelId && (
          <p id={`${seletorId}-erro`} className="text-raiz-legenda font-semibold text-raiz-vinho">
            {errors.labelId.message}
          </p>
        )}
      </div>

      {erroGeral && (
        <p role="alert" className="font-semibold text-raiz-vinho">
          {erroGeral}
        </p>
      )}

      <div className="flex justify-end gap-2.5">
        <Botao variante="secundario" onClick={onFechar}>
          Cancelar
        </Botao>
        <Botao type="submit" disabled={salvar.isPending}>
          {salvar.isPending ? "Salvando…" : topico ? "Salvar" : "Criar tópico"}
        </Botao>
      </div>
    </form>
  );
}
