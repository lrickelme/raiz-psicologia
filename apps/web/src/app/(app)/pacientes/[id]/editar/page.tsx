import type { Paciente } from "@raiz/shared";
import type { Metadata } from "next";
import { AreaConteudo } from "@/components/shell/area-conteudo";
import { CabecalhoPagina } from "@/components/shell/cabecalho-pagina";
import { Card } from "@/components/ui/card";
import { FormularioPaciente } from "@/features/pacientes/formulario-paciente";
import { buscarNaApi } from "@/lib/api-servidor";

export const metadata: Metadata = { title: "Editar paciente · Raíz" };

export default async function EditarPacientePage({
  params,
}: PageProps<"/pacientes/[id]/editar">) {
  const { id } = await params;
  const paciente = await buscarNaApi<Paciente>(`/pacientes/${encodeURIComponent(id)}`);

  return (
    <>
      <CabecalhoPagina titulo={`Editar ${paciente.nome}`} />
      <AreaConteudo>
        <Card className="max-w-[760px]">
          <FormularioPaciente paciente={paciente} />
        </Card>
      </AreaConteudo>
    </>
  );
}
