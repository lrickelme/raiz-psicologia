import type { Metadata } from "next";
import { AreaConteudo } from "@/components/shell/area-conteudo";
import { CabecalhoPagina } from "@/components/shell/cabecalho-pagina";
import { Card } from "@/components/ui/card";
import { FormularioPaciente } from "@/features/pacientes/formulario-paciente";

export const metadata: Metadata = { title: "Novo paciente · Raíz" };

export default function NovoPacientePage() {
  return (
    <>
      <CabecalhoPagina
        titulo="Novo paciente"
        descricao="Só nome e valor da consulta são obrigatórios; o resto pode ser completado depois."
      />
      <AreaConteudo>
        <Card className="max-w-[760px]">
          <FormularioPaciente />
        </Card>
      </AreaConteudo>
    </>
  );
}
