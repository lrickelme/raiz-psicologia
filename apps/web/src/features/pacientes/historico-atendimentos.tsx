import { dataLocal, type Atendimento } from "@raiz/shared";
import { BadgeStatus } from "@/components/ui/badge-status";
import { duracaoMin, faixaHoraria } from "@/features/agenda/horario";
import { formatarData, formatarDinheiro } from "@/lib/formatar";

const ENCERRAMENTO: Partial<Record<Atendimento["status"], string>> = {
  CANCELADO: "Motivo do cancelamento",
  REMARCADO: "Motivo da remarcação",
  FALTA: "Motivo da falta",
};

function quando(a: Atendimento): string {
  return `${formatarData(dataLocal(a.inicio))}, ${faixaHoraria(a.inicio, a.fim)}`;
}

/**
 * Mais recente primeiro (spec pacientes). Cada elo de remarcação aponta para o
 * vizinho da cadeia por âncora, então a sequência original → remarcações →
 * vigente é legível e navegável sem omitir nenhum elo.
 */
export function HistoricoAtendimentos({ atendimentos }: { atendimentos: Atendimento[] }) {
  const porId = new Map(atendimentos.map((a) => [a.id, a]));
  const ordenados = [...atendimentos].sort((a, b) => b.inicio.localeCompare(a.inicio));

  if (!ordenados.length) {
    return (
      <p className="rounded-raiz-card border border-dashed border-raiz-borda-forte p-5 text-raiz-corpo text-raiz-texto-terciario">
        Nenhum atendimento registrado ainda.
      </p>
    );
  }

  return (
    <ol className="relative flex flex-col gap-4 pl-[26px]">
      <span aria-hidden className="absolute top-1.5 bottom-1.5 left-[5px] w-0.5 bg-raiz-borda-forte" />
      {ordenados.map((a) => {
        const substituto = a.remarcadoParaId ? porId.get(a.remarcadoParaId) : undefined;
        const original = a.remarcadoDeId ? porId.get(a.remarcadoDeId) : undefined;
        return (
          <li key={a.id} id={`atendimento-${a.id}`} className="relative scroll-mt-4">
            <span
              aria-hidden
              className={`absolute top-1 -left-[26px] size-3 rounded-full border-2 border-raiz-superficie ${
                a.status === "AGENDADO" ? "bg-raiz-vinho" : "bg-raiz-bege"
              }`}
            />
            <article className="flex flex-col gap-2 rounded-[14px] border border-raiz-borda bg-raiz-superficie px-[18px] py-4 target:border-raiz-vinho">
              <header className="flex flex-wrap items-center gap-2.5">
                <span className="font-raiz-mono text-raiz-meta font-medium text-raiz-marrom">
                  {formatarData(dataLocal(a.inicio))}
                </span>
                <span className="font-raiz-mono text-raiz-legenda text-raiz-texto-terciario">
                  {faixaHoraria(a.inicio, a.fim)} · {duracaoMin(a.inicio, a.fim)} min
                </span>
                <BadgeStatus status={a.status} />
                <span className="ml-auto font-raiz-mono text-raiz-meta text-raiz-marrom">
                  {formatarDinheiro(a.valor)}
                </span>
              </header>

              {ENCERRAMENTO[a.status] && a.motivo && (
                <p className="text-raiz-corpo leading-relaxed text-raiz-texto-secundario">
                  <span className="text-raiz-meta font-semibold text-raiz-texto-terciario">
                    {ENCERRAMENTO[a.status]}:{" "}
                  </span>
                  {a.motivo}
                </p>
              )}

              {(original || substituto) && (
                <div className="flex flex-col gap-0.5 text-raiz-meta text-raiz-texto-terciario">
                  {original && (
                    <a href={`#atendimento-${original.id}`} className="hover:text-raiz-vinho hover:underline">
                      ← Remarcação do atendimento de {quando(original)}
                    </a>
                  )}
                  {substituto && (
                    <a href={`#atendimento-${substituto.id}`} className="hover:text-raiz-vinho hover:underline">
                      → Remarcado para {quando(substituto)}
                    </a>
                  )}
                </div>
              )}
            </article>
          </li>
        );
      })}
    </ol>
  );
}
