"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  normalizarNome,
  pacienteEntradaSchema,
  type Pagina,
  type Paciente,
  type PacienteDados,
} from "@raiz/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { AreaTexto } from "@/components/ui/area-texto";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campo";
import { Modal } from "@/components/ui/modal";
import { chamarApi, ErroApi } from "@/lib/api-cliente";
import { formatarData } from "@/lib/formatar";

type Valores = z.input<typeof pacienteEntradaSchema>;

function valoresIniciais(paciente?: Paciente): Valores {
  return {
    nome: paciente?.nome ?? "",
    telefone: paciente?.telefone ?? "",
    email: paciente?.email ?? "",
    nascimento: paciente?.nascimento ?? "",
    // Exibido como se digita aqui; o schema aceita a vírgula.
    valorConsultaPadrao: paciente?.valorConsultaPadrao.replace(".", ",") ?? "",
    observacoes: paciente?.observacoes ?? "",
  };
}

/** Pacientes com o mesmo nome, ativos ou arquivados, exceto o próprio. */
async function buscarHomonimos(nome: string, exceto?: string): Promise<Paciente[]> {
  const params = new URLSearchParams({ busca: nome, status: "TODOS", size: "50" });
  const { itens } = await chamarApi<Pagina<Paciente>>(`/pacientes?${params}`);
  const alvo = normalizarNome(nome);
  return itens.filter((p) => p.id !== exceto && normalizarNome(p.nome) === alvo);
}

/**
 * Criação e edição. Valida com o mesmo schema da API; se a API ainda assim
 * recusar (422), o erro volta para o campo apontado sem limpar os demais.
 */
export function FormularioPaciente({ paciente }: { paciente?: Paciente }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [homonimos, setHomonimos] = useState<{ dados: PacienteDados; lista: Paciente[] } | null>(
    null,
  );

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Valores, unknown, PacienteDados>({
    resolver: zodResolver(pacienteEntradaSchema),
    defaultValues: valoresIniciais(paciente),
  });

  const salvar = useMutation({
    mutationFn: (dados: PacienteDados) =>
      paciente
        ? chamarApi<Paciente>(`/pacientes/${paciente.id}`, { method: "PATCH", corpo: dados })
        : chamarApi<Paciente>("/pacientes", { method: "POST", corpo: dados }),
    onSuccess: (salvo) => {
      queryClient.invalidateQueries({ queryKey: ["pacientes"] });
      router.push(`/pacientes/${salvo.id}`);
      router.refresh();
    },
    onError: (erro) => {
      setHomonimos(null);
      if (erro instanceof ErroApi && erro.status === 422 && erro.campos.length) {
        for (const { caminho, mensagem } of erro.campos) {
          setError(caminho as keyof Valores, { message: mensagem }, { shouldFocus: true });
        }
        return;
      }
      setErroGeral(erro.message);
    },
  });

  async function enviar(dados: PacienteDados) {
    setErroGeral(null);
    const nomeMudou = !paciente || normalizarNome(paciente.nome) !== normalizarNome(dados.nome);
    if (nomeMudou) {
      try {
        const lista = await queryClient.fetchQuery({
          queryKey: ["pacientes", "homonimos", normalizarNome(dados.nome), paciente?.id],
          queryFn: () => buscarHomonimos(dados.nome, paciente?.id),
          staleTime: 0,
        });
        if (lista.length) {
          setHomonimos({ dados, lista });
          return;
        }
      } catch (erro) {
        setErroGeral(erro instanceof Error ? erro.message : String(erro));
        return;
      }
    }
    salvar.mutate(dados);
  }

  const ocupado = isSubmitting || salvar.isPending;

  return (
    <>
      <form onSubmit={handleSubmit(enviar)} noValidate className="flex flex-col gap-4">
        <Campo rotulo="Nome completo" autoFocus={!paciente} erro={errors.nome?.message} {...register("nome")} />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
          <Campo
            rotulo="Valor da consulta (R$)"
            inputMode="decimal"
            placeholder="150,00"
            descricao="Novos agendamentos herdam este valor; os já marcados não mudam."
            erro={errors.valorConsultaPadrao?.message}
            {...register("valorConsultaPadrao")}
          />
          <Campo
            rotulo="Telefone"
            type="tel"
            placeholder="(83) 99999-0000"
            erro={errors.telefone?.message}
            {...register("telefone")}
          />
          <Campo rotulo="E-mail" type="email" erro={errors.email?.message} {...register("email")} />
          <Campo
            rotulo="Data de nascimento"
            type="date"
            erro={errors.nascimento?.message}
            {...register("nascimento")}
          />
        </div>
        <AreaTexto
          rotulo="Observações administrativas"
          descricao="Uso administrativo (ex.: horário preferido, forma de contato). Não registre aqui conteúdo clínico — isso é prontuário."
          erro={errors.observacoes?.message}
          {...register("observacoes")}
        />

        {erroGeral && (
          <p
            role="alert"
            className="rounded-raiz-campo bg-raiz-vinho-suave px-3.5 py-2.5 text-raiz-corpo-sm font-semibold text-raiz-vinho"
          >
            {erroGeral}
          </p>
        )}

        <div className="flex justify-end gap-2.5 pt-1">
          <Link
            href={paciente ? `/pacientes/${paciente.id}` : "/pacientes"}
            className="inline-flex items-center rounded-full border-[1.5px] border-raiz-borda-forte px-5 py-[10px] text-raiz-corpo font-semibold text-raiz-marrom hover:bg-raiz-sand"
          >
            Cancelar
          </Link>
          <Botao type="submit" disabled={ocupado}>
            {ocupado ? "Salvando…" : paciente ? "Salvar alterações" : "Cadastrar paciente"}
          </Botao>
        </div>
      </form>

      <Modal
        aberto={homonimos !== null}
        titulo="Já existe paciente com este nome"
        onFechar={() => setHomonimos(null)}
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setHomonimos(null)}>
              Voltar e revisar
            </Botao>
            <Botao
              disabled={salvar.isPending}
              onClick={() => homonimos && salvar.mutate(homonimos.dados)}
            >
              {paciente ? "Salvar mesmo assim" : "Cadastrar mesmo assim"}
            </Botao>
          </>
        }
      >
        <p>
          Homônimos são permitidos, mas confira se não é a mesma pessoa antes de
          continuar:
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {homonimos?.lista.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-raiz-campo border border-raiz-borda px-3.5 py-2.5"
            >
              <span>
                <span className="font-semibold text-raiz-marrom">{p.nome}</span>
                <span className="block text-raiz-legenda text-raiz-texto-terciario">
                  {[
                    p.telefone,
                    p.status === "ARQUIVADO" && "arquivado",
                    `cadastro ${formatarData(p.criadoEm)}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <Link
                href={`/pacientes/${p.id}`}
                target="_blank"
                className="text-raiz-corpo-sm font-semibold text-raiz-vinho hover:underline"
              >
                Ver perfil
              </Link>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
