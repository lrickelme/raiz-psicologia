import { historicoConcluidosSchema } from "@raiz/shared";
import type { Metadata } from "next";
import { HistoricoConcluidos } from "@/features/estudos/historico-concluidos";

export const metadata: Metadata = { title: "Histórico de estudos · Raíz" };

export default async function HistoricoPage({ searchParams }: PageProps<"/estudos/historico">) {
  // O mesmo schema que a API usa: página estranha cai na primeira.
  const lido = historicoConcluidosSchema.safeParse({ pagina: (await searchParams).pagina });
  return <HistoricoConcluidos pagina={lido.success ? lido.data.pagina : 1} />;
}
