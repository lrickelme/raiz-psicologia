import { listagemPacientesSchema, type Pagina, type Paciente } from "@raiz/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { AreaConteudo } from "@/components/shell/area-conteudo";
import { CabecalhoPagina } from "@/components/shell/cabecalho-pagina";
import { Card } from "@/components/ui/card";
import { FiltrosPacientes } from "@/features/pacientes/filtros-pacientes";
import { ListaPacientes } from "@/features/pacientes/lista-pacientes";
import { Paginacao } from "@/features/pacientes/paginacao";
import { buscarNaApi } from "@/lib/api-servidor";

export const metadata: Metadata = { title: "Pacientes · Raíz" };

const TAMANHO_PAGINA = 20;

export default async function PacientesPage({ searchParams }: PageProps<"/pacientes">) {
  const brutos = await searchParams;
  const texto = (nome: string) => (typeof brutos[nome] === "string" ? brutos[nome] : undefined);

  // O mesmo schema que a API usa normaliza a URL: valor estranho cai no padrão.
  const lido = listagemPacientesSchema.safeParse({
    busca: texto("busca"),
    status: texto("status"),
    page: texto("page"),
    size: TAMANHO_PAGINA,
  });
  const filtro = lido.success ? lido.data : listagemPacientesSchema.parse({});

  const query = (page: number) => {
    const params = new URLSearchParams({ page: String(page), size: String(filtro.size) });
    if (filtro.busca) params.set("busca", filtro.busca);
    params.set("status", filtro.status);
    return params;
  };
  const pagina = await buscarNaApi<Pagina<Paciente>>(`/pacientes?${query(filtro.page)}`);

  const hrefPagina = (page: number) => {
    const params = query(page);
    params.delete("size");
    if (filtro.status === "ATIVO") params.delete("status");
    return `/pacientes?${params}`;
  };

  return (
    <>
      <CabecalhoPagina
        titulo="Pacientes"
        descricao={`${pagina.total} ${pagina.total === 1 ? "paciente" : "pacientes"}${
          filtro.status === "ATIVO" ? " ativos" : filtro.status === "ARQUIVADO" ? " arquivados" : ""
        }`}
        acoes={
          <Link
            href="/pacientes/novo"
            className="inline-flex items-center rounded-full bg-raiz-vinho px-5 py-[11px] text-raiz-corpo font-semibold text-raiz-sobre-vinho hover:bg-raiz-vinho-escuro"
          >
            + Novo paciente
          </Link>
        }
      />
      <AreaConteudo>
        <FiltrosPacientes busca={filtro.busca ?? ""} status={filtro.status} />
        <Card>
          {pagina.itens.length ? (
            <>
              <ListaPacientes pacientes={pagina.itens} />
              <Paginacao
                page={pagina.page}
                size={pagina.size}
                total={pagina.total}
                href={hrefPagina}
              />
            </>
          ) : (
            <p className="py-6 text-center text-raiz-corpo text-raiz-texto-terciario">
              {filtro.busca
                ? `Nenhum paciente encontrado para “${filtro.busca}”.`
                : filtro.status === "ARQUIVADO"
                  ? "Nenhum paciente arquivado."
                  : "Nenhum paciente cadastrado ainda."}
            </p>
          )}
        </Card>
      </AreaConteudo>
    </>
  );
}
