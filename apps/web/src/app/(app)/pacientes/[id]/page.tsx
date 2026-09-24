import type { Atendimento, Paciente } from "@raiz/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { CabecalhoPagina } from "@/components/shell/cabecalho-pagina";
import { AcoesSituacao } from "@/features/pacientes/acoes-situacao";
import { HistoricoAtendimentos } from "@/features/pacientes/historico-atendimentos";
import { buscarNaApi } from "@/lib/api-servidor";
import { formatarData, formatarDinheiro, idade } from "@/lib/formatar";

export const metadata: Metadata = { title: "Paciente · Raíz" };

// O histórico traz o motivo dos encerramentos, dado clínico: a rota é
// dinâmica e sem cache, explicitamente (project.md, restrição 6).
export const dynamic = "force-dynamic";

function Dado({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-raiz-borda pb-[9px]">
      <dt className="text-raiz-meta text-raiz-texto-terciario">{rotulo}</dt>
      <dd className="text-right text-raiz-corpo-sm font-medium break-all text-raiz-marrom">
        {valor ?? "—"}
      </dd>
    </div>
  );
}

export default async function PacientePage({ params }: PageProps<"/pacientes/[id]">) {
  const { id } = await params;
  const paciente = await buscarNaApi<Paciente>(`/pacientes/${encodeURIComponent(id)}`);
  const atendimentos = await buscarNaApi<Atendimento[]>(
    `/atendimentos?pacienteId=${encodeURIComponent(paciente.id)}`,
  );
  const encerrados = atendimentos.filter((a) => a.status !== "AGENDADO").length;
  const arquivado = paciente.status === "ARQUIVADO";

  return (
    <>
      <CabecalhoPagina
        titulo={paciente.nome}
        descricao={`Paciente desde ${formatarData(paciente.criadoEm)}${arquivado ? " · arquivado" : ""}`}
        acoes={
          <>
            <AcoesSituacao paciente={paciente} />
            <Link
              href={`/pacientes/${paciente.id}/editar`}
              className="inline-flex items-center rounded-full bg-raiz-vinho px-5 py-[11px] text-raiz-corpo font-semibold text-raiz-sobre-vinho hover:bg-raiz-vinho-escuro"
            >
              Editar dados
            </Link>
          </>
        }
      />
      <div className="flex flex-1 flex-wrap">
        <aside className="flex w-full max-w-[300px] shrink-0 flex-col gap-5 border-r border-raiz-borda bg-raiz-superficie p-6">
          <div className="flex flex-col items-center gap-2.5 text-center">
            <Avatar nome={paciente.nome} tamanho="grande" />
            <div>
              <div className="font-raiz-display text-raiz-titulo-secao font-semibold text-raiz-marrom">
                {paciente.nome}
              </div>
              {paciente.nascimento && (
                <div className="text-raiz-meta text-raiz-texto-terciario">
                  {idade(paciente.nascimento)} anos
                </div>
              )}
            </div>
          </div>

          <dl className="flex flex-col gap-[13px]">
            <Dado rotulo="Telefone" valor={paciente.telefone} />
            <Dado rotulo="E-mail" valor={paciente.email} />
            <Dado
              rotulo="Nascimento"
              valor={paciente.nascimento && formatarData(paciente.nascimento)}
            />
            <Dado rotulo="Valor/sessão" valor={formatarDinheiro(paciente.valorConsultaPadrao)} />
            <Dado rotulo="Cadastro" valor={formatarData(paciente.criadoEm)} />
          </dl>

          {paciente.observacoes && (
            <div className="flex flex-col gap-1.5">
              <span className="text-raiz-meta text-raiz-texto-terciario">
                Observações administrativas
              </span>
              <p className="text-raiz-corpo-sm leading-relaxed whitespace-pre-line text-raiz-texto-secundario">
                {paciente.observacoes}
              </p>
            </div>
          )}

          <div className="flex items-start gap-2.5 rounded-raiz-campo bg-raiz-vinho-suave p-[13px]">
            <svg
              aria-hidden
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="mt-px shrink-0 text-raiz-vinho"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <p className="text-raiz-rotulo leading-[1.45] text-raiz-vinho-escuro">
              Motivos de encerramento são cifrados e todo acesso a este perfil é registrado na
              trilha de auditoria.
            </p>
          </div>
        </aside>

        <section className="min-w-0 flex-1 bg-raiz-areia px-raiz-conteudo-x py-6">
          <div className="mb-[18px] flex items-center justify-between">
            <h2 className="font-raiz-display text-[17px] font-semibold text-raiz-marrom">
              Histórico de atendimentos
            </h2>
            <span className="font-raiz-mono text-raiz-legenda text-raiz-texto-terciario">
              {atendimentos.length} {atendimentos.length === 1 ? "registro" : "registros"} ·{" "}
              {encerrados} {encerrados === 1 ? "encerrado" : "encerrados"}
            </span>
          </div>
          <HistoricoAtendimentos atendimentos={atendimentos} />
        </section>
      </div>
    </>
  );
}
