import { hojeLocal } from "@raiz/shared";
import type { Metadata } from "next";
import { Financeiro } from "@/features/financeiro/financeiro";

export const metadata: Metadata = { title: "Financeiro · Raíz" };

// Receita por paciente traz nomes: nunca em cache estático (project.md).
export const dynamic = "force-dynamic";

export default function FinanceiroPage() {
  // "Hoje" do servidor, para o período padrão não divergir na hidratação.
  return <Financeiro hoje={hojeLocal()} />;
}
