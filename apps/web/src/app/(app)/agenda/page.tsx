import { hojeLocal } from "@raiz/shared";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Agenda } from "@/features/agenda/agenda";
import { COOKIE_ENCERRADOS, COOKIE_VISAO, ehVisao } from "@/features/agenda/calendario";

export const metadata: Metadata = { title: "Agenda · Raíz" };

// Dado de paciente: nunca em cache estático (project.md).
export const dynamic = "force-dynamic";

export default async function AgendaPage({ searchParams }: PageProps<"/agenda">) {
  const preferencias = await cookies();
  const salva = preferencias.get(COOKIE_VISAO)?.value;
  const { novo } = await searchParams;
  return (
    <Agenda
      // Semanal é o padrão ao abrir o módulo (spec agenda).
      visaoInicial={ehVisao(salva) ? salva : "semana"}
      encerradosInicial={preferencias.get(COOKIE_ENCERRADOS)?.value === "1"}
      hojeServidor={hojeLocal()}
      abrirNovo={novo === "1"}
    />
  );
}
