"use client";

import {
  CORES_LABEL,
  labelEntradaSchema,
  type CorLabel,
  type Label,
  type LabelComUso,
  type LabelDados,
  type LabelEmUso,
} from "@raiz/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { Modal } from "@/components/ui/modal";
import { Carregando, Falha } from "@/features/financeiro/painel";
import { chamarApi, ErroApi } from "@/lib/api-cliente";
import { chaveEstudos, chaveLabels, useLabels } from "./consultas";
import { CORES_LABEL_ESTILO, classesLabel } from "./cores-label";
import { PillLabel } from "./pill-label";

const plural = (n: number) => `${n} ${n === 1 ? "tópico" : "tópicos"}`;

export function GestaoLabels({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  return (
    <Modal aberto={aberto} titulo="Labels de prioridade" onFechar={onFechar}>
      {aberto && <Conteudo />}
    </Modal>
  );
}

function Conteudo() {
  const queryClient = useQueryClient();
  const labels = useLabels();
  const [erroOrdem, setErroOrdem] = useState<string | null>(null);

  const reordenar = useMutation({
    mutationFn: (ids: string[]) =>
      chamarApi<LabelComUso[]>("/labels/ordem", { method: "PUT", corpo: { ids } }),
    onMutate: (ids) => {
      setErroOrdem(null);
      const anteriores = queryClient.getQueryData<LabelComUso[]>(chaveLabels);
      if (anteriores) {
        const porId = new Map(anteriores.map((l) => [l.id, l]));
        queryClient.setQueryData(
          chaveLabels,
          ids.map((id, i) => ({ ...porId.get(id)!, ordem: i + 1 })),
        );
      }
      return anteriores;
    },
    onError: (erro, _ids, anteriores) => {
      if (anteriores) queryClient.setQueryData(chaveLabels, anteriores);
      setErroOrdem(erro.message);
    },
    // A ordem da label é a prioridade: o quadro reordena junto.
    onSettled: () => queryClient.invalidateQueries({ queryKey: chaveEstudos }),
  });

  if (labels.error) return <Falha mensagem={labels.error.message} />;
  if (!labels.data) return <Carregando />;
  const lista = labels.data;

  function mover(indice: number, delta: -1 | 1) {
    const alvo = indice + delta;
    if (alvo < 0 || alvo >= lista.length) return;
    const ids = lista.map((l) => l.id);
    [ids[indice], ids[alvo]] = [ids[alvo], ids[indice]];
    reordenar.mutate(ids);
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-raiz-corpo-sm text-raiz-texto-terciario">
        A ordem define a prioridade: a primeira label é a mais prioritária, e os tópicos sem label ficam
        por último.
      </p>
      {erroOrdem && (
        <p role="alert" className="text-raiz-corpo-sm font-semibold text-raiz-vinho">
          {erroOrdem}
        </p>
      )}
      {lista.length ? (
        <ol className="flex flex-col divide-y divide-raiz-borda rounded-raiz-campo border border-raiz-borda">
          {lista.map((label, i) => (
            <LinhaLabel
              key={label.id}
              label={label}
              primeira={i === 0}
              ultima={i === lista.length - 1}
              onMover={(delta) => mover(i, delta)}
            />
          ))}
        </ol>
      ) : (
        <p className="text-raiz-corpo-sm text-raiz-texto-terciario">Nenhuma label cadastrada.</p>
      )}

      <section aria-labelledby="nova-label" className="flex flex-col gap-3 border-t border-raiz-borda pt-4">
        <h3 id="nova-label" className="font-raiz-display text-raiz-titulo-card font-semibold text-raiz-marrom">
          Nova label
        </h3>
        <NovaLabel />
      </section>
    </div>
  );
}

function NovaLabel() {
  // Remontar depois de criar zera o formulário.
  const [versao, setVersao] = useState(0);
  const salvar = useSalvarLabel();
  return (
    <FormularioLabel
      key={versao}
      rotuloEnviar="Adicionar label"
      onEnviar={(dados) => salvar.mutateAsync({ dados }).then(() => setVersao((v) => v + 1))}
    />
  );
}

function useSalvarLabel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dados }: { id?: string; dados: LabelDados }) =>
      id
        ? chamarApi<Label>(`/labels/${id}`, { method: "PATCH", corpo: dados })
        : chamarApi<Label>("/labels", { method: "POST", corpo: dados }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chaveEstudos }),
  });
}

type LinhaProps = {
  label: LabelComUso;
  primeira: boolean;
  ultima: boolean;
  onMover: (delta: -1 | 1) => void;
};

function LinhaLabel({ label, primeira, ultima, onMover }: LinhaProps) {
  const queryClient = useQueryClient();
  const [modo, setModo] = useState<"ver" | "editar" | "excluir">("ver");
  // Quantos tópicos o servidor disse que usam a label, quando o aviso local estava desatualizado.
  const [emUsoServidor, setEmUsoServidor] = useState<number | null>(null);
  const salvar = useSalvarLabel();

  const excluir = useMutation({
    mutationFn: () => chamarApi<void>(`/labels/${label.id}`, { method: "DELETE" }),
    onError: (erro) => {
      if (erro instanceof ErroApi && erro.status === 409) {
        setEmUsoServidor((erro.corpo as unknown as LabelEmUso).topicos);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: chaveEstudos }),
  });

  const emUso = emUsoServidor ?? label.emUso;
  const botao =
    "rounded-full px-2.5 py-1 text-raiz-meta font-semibold text-raiz-marrom hover:bg-raiz-sand focus-visible:outline-2 focus-visible:outline-raiz-vinho aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:bg-transparent";

  if (modo === "editar") {
    return (
      <li className="p-3.5">
        <FormularioLabel
          inicial={label}
          rotuloEnviar="Salvar"
          onEnviar={(dados) => salvar.mutateAsync({ id: label.id, dados }).then(() => setModo("ver"))}
          onCancelar={() => setModo("ver")}
        />
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-2.5 p-3.5">
      <div className="flex items-center gap-3">
        <PillLabel label={label} />
        <span className="flex-1 font-raiz-mono text-raiz-legenda text-raiz-texto-terciario">
          {label.emUso ? `em ${plural(label.emUso)}` : "sem tópicos"}
        </span>
        {/* `aria-disabled`, e não `disabled`: o foco fica no botão depois de a linha chegar ao topo. */}
        <button
          type="button"
          aria-label={`Subir ${label.nome}`}
          aria-disabled={primeira}
          onClick={() => !primeira && onMover(-1)}
          className={botao}
        >
          ↑
        </button>
        <button
          type="button"
          aria-label={`Descer ${label.nome}`}
          aria-disabled={ultima}
          onClick={() => !ultima && onMover(1)}
          className={botao}
        >
          ↓
        </button>
        <button type="button" aria-label={`Editar ${label.nome}`} onClick={() => setModo("editar")} className={botao}>
          Editar
        </button>
        <button
          type="button"
          aria-label={`Excluir ${label.nome}`}
          onClick={() => {
            excluir.reset();
            setEmUsoServidor(null);
            setModo("excluir");
          }}
          className={`${botao} text-raiz-vinho`}
        >
          Excluir
        </button>
      </div>

      {modo === "excluir" &&
        (emUso > 0 ? (
          <div role="alert" className="flex flex-col gap-2 rounded-raiz-campo bg-raiz-vinho-suave px-3.5 py-2.5 text-raiz-corpo-sm text-raiz-vinho">
            <p>
              <strong>“{label.nome}” está em uso por {plural(emUso)}</strong>, concluídos inclusive. Troque a
              prioridade desses tópicos antes de excluí-la.
            </p>
            <button type="button" onClick={() => setModo("ver")} className="self-start font-semibold underline">
              Entendi
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-raiz-campo bg-raiz-sand px-3.5 py-2.5 text-raiz-corpo-sm">
            <span>Excluir a label “{label.nome}”?</span>
            <div className="flex gap-2">
              <Botao variante="secundario" onClick={() => setModo("ver")}>
                Cancelar
              </Botao>
              <Botao onClick={() => excluir.mutate()} disabled={excluir.isPending}>
                {excluir.isPending ? "Excluindo…" : "Excluir"}
              </Botao>
            </div>
          </div>
        ))}
      {modo === "excluir" && excluir.error && !(excluir.error instanceof ErroApi && excluir.error.status === 409) && (
        <p role="alert" className="text-raiz-corpo-sm font-semibold text-raiz-vinho">
          {excluir.error.message}
        </p>
      )}
    </li>
  );
}

type FormularioLabelProps = {
  inicial?: Pick<Label, "nome" | "cor">;
  rotuloEnviar: string;
  onEnviar: (dados: LabelDados) => Promise<unknown>;
  onCancelar?: () => void;
};

function FormularioLabel({ inicial, rotuloEnviar, onEnviar, onCancelar }: FormularioLabelProps) {
  const [nome, setNome] = useState(inicial?.nome ?? "");
  const [cor, setCor] = useState<CorLabel | null>(inicial?.cor ?? null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    const validacao = labelEntradaSchema.safeParse({ nome, cor: cor ?? undefined });
    if (!validacao.success) {
      setErros(Object.fromEntries(validacao.error.issues.map((i) => [i.path.join("."), i.message])));
      return;
    }
    setErros({});
    setEnviando(true);
    try {
      await onEnviar(validacao.data);
    } catch (erro) {
      if (erro instanceof ErroApi && erro.status === 409) setErros({ nome: erro.message });
      else if (erro instanceof ErroApi && erro.campos.length) {
        setErros(Object.fromEntries(erro.campos.map((c) => [c.caminho, c.mensagem])));
      } else setErros({ geral: erro instanceof Error ? erro.message : String(erro) });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-3">
      <Campo
        rotulo="Nome da label"
        value={nome}
        maxLength={30}
        autoFocus={Boolean(inicial)}
        onChange={(e) => setNome(e.target.value)}
        erro={erros.nome}
      />
      <SeletorCor valor={cor} onChange={setCor} erro={erros.cor} />
      {erros.geral && (
        <p role="alert" className="text-raiz-corpo-sm font-semibold text-raiz-vinho">
          {erros.geral}
        </p>
      )}
      <div className="flex justify-end gap-2.5">
        {onCancelar && (
          <Botao variante="secundario" onClick={onCancelar}>
            Cancelar
          </Botao>
        )}
        <Botao type="submit" disabled={enviando}>
          {enviando ? "Salvando…" : rotuloEnviar}
        </Botao>
      </div>
    </form>
  );
}

/** Só os seis papéis da paleta, com amostra e nome; não há cor livre (spec estudos). */
function SeletorCor({
  valor,
  onChange,
  erro,
}: {
  valor: CorLabel | null;
  onChange: (cor: CorLabel) => void;
  erro?: string;
}) {
  return (
    <fieldset aria-invalid={erro ? true : undefined} className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-raiz-corpo-sm font-semibold text-raiz-marrom">Cor</legend>
      <div className="flex flex-wrap gap-2">
        {CORES_LABEL.map((cor) => (
          <label key={cor} className="cursor-pointer">
            <input
              type="radio"
              name="cor"
              value={cor}
              checked={valor === cor}
              onChange={() => onChange(cor)}
              className="peer sr-only"
            />
            <span
              className={`inline-block rounded-full px-3 py-1 text-raiz-meta font-semibold outline-offset-2 peer-checked:outline-2 peer-checked:outline-raiz-marrom peer-focus-visible:ring-2 peer-focus-visible:ring-raiz-vinho peer-focus-visible:ring-offset-2 ${classesLabel(cor)}`}
            >
              {valor === cor && <span aria-hidden>✓ </span>}
              {CORES_LABEL_ESTILO[cor].nome}
            </span>
          </label>
        ))}
      </div>
      {erro && <p className="text-raiz-legenda font-semibold text-raiz-vinho">{erro}</p>}
    </fieldset>
  );
}
