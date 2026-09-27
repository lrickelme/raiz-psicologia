import type { Atendimento, Paciente } from "@raiz/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { CabecalhoPagina } from "@/components/shell/cabecalho-pagina";
import { Avatar } from "@/components/ui/avatar";
import { Prontuario } from "@/features/prontuario/prontuario";
import { buscarNaApi } from "@/lib/api-servidor";
import { formatarData, idade } from "@/lib/formatar";

export const metadata: Metadata = { title: "Prontuário · Raíz" };

// Rota de prontuário: dinâmica e sem cache, explicitamente (project.md,
// restrição 6). O texto das evoluções nem passa por aqui — é buscado pelo
// cliente, uma evolução por vez —, mas o histórico traz motivos clínicos.
export const dynamic = "force-dynamic";

export default async function ProntuarioPage({
  params,
  searchParams,
}: PageProps<"/pacientes/[id]/prontuario">) {
  const { id } = await params;
  const { atendimento: atendimentoPedido } = await searchParams;
  const paciente = await buscarNaApi<Paciente>(`/pacientes/${encodeURIComponent(id)}`);
  const atendimentos = await buscarNaApi<Atendimento[]>(
    `/atendimentos?pacienteId=${encodeURIComponent(paciente.id)}`,
  );
  const ativo = paciente.status === "ATIVO";

  // Evolução a partir de um atendimento: só um realizado deste paciente.
  const origem = atendimentos.find(
    (a) => a.id === atendimentoPedido && a.status === "REALIZADO",
  );

  return (
    <>
      <CabecalhoPagina
        titulo={paciente.nome}
        descricao={`Prontuário · paciente desde ${formatarData(paciente.criadoEm)}${ativo ? "" : " · arquivado"}`}
        acoes={
          <>
            <Link
              href={`/pacientes/${paciente.id}`}
              className="inline-flex items-center rounded-full border-[1.5px] border-raiz-borda-forte px-5 py-[10px] text-raiz-corpo font-semibold text-raiz-marrom hover:bg-raiz-sand"
            >
              Voltar ao perfil
            </Link>
            {/* Pelo BFF: o navegador nunca fala com a API. */}
            <a
              href={`/api/v1/pacientes/${paciente.id}/prontuario.pdf`}
              download
              className="inline-flex items-center rounded-full bg-raiz-vinho px-5 py-[11px] text-raiz-corpo font-semibold text-raiz-sobre-vinho hover:bg-raiz-vinho-escuro"
            >
              Exportar prontuário (PDF)
            </a>
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
              Prontuário criptografado. Cada evolução aberta e cada exportação ficam registradas
              na trilha de auditoria, conforme o sigilo exigido pelo CFP.
            </p>
          </div>
        </aside>

        <section className="min-w-0 flex-1 bg-raiz-areia px-raiz-conteudo-x py-6">
          <Prontuario
            pacienteId={paciente.id}
            ativo={ativo}
            atendimentos={Object.fromEntries(atendimentos.map((a) => [a.id, a.inicio]))}
            atendimento={origem ? { id: origem.id, inicio: origem.inicio } : null}
          />
        </section>
      </div>
    </>
  );
}
