import type { Paciente } from "@raiz/shared";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { formatarDinheiro } from "@/lib/formatar";

/**
 * Linhas em grid, não `<table>`: na change 06 cada linha vira cartão no
 * celular sem reescrever a marcação (project.md, desktop primeiro).
 */
export function ListaPacientes({ pacientes }: { pacientes: Paciente[] }) {
  return (
    <ul className="flex flex-col">
      <li
        aria-hidden
        className="grid grid-cols-[1.6fr_1fr_0.8fr] gap-3 border-b-[1.5px] border-raiz-borda-forte py-2 text-raiz-legenda font-semibold tracking-[0.05em] text-raiz-texto-terciario uppercase"
      >
        <span>Paciente</span>
        <span>Telefone</span>
        <span className="text-right">Valor/sessão</span>
      </li>
      {pacientes.map((paciente) => (
        <li key={paciente.id} className="border-b border-raiz-borda last:border-b-0">
          <Link
            href={`/pacientes/${paciente.id}`}
            className="grid grid-cols-[1.6fr_1fr_0.8fr] items-center gap-3 rounded-raiz-campo py-3 hover:bg-raiz-areia focus-visible:outline-2 focus-visible:outline-raiz-vinho"
          >
            <span className="flex min-w-0 items-center gap-[11px]">
              <Avatar nome={paciente.nome} />
              <span className="truncate text-raiz-corpo font-semibold text-raiz-marrom">
                {paciente.nome}
              </span>
              {paciente.status === "ARQUIVADO" && (
                <span className="rounded-full bg-raiz-sand px-2.5 py-0.5 text-raiz-legenda font-semibold text-raiz-texto-terciario">
                  Arquivado
                </span>
              )}
            </span>
            <span className="truncate text-raiz-corpo-sm text-raiz-texto-secundario">
              {paciente.telefone ?? "—"}
            </span>
            <span className="text-right font-raiz-mono text-[12.5px] text-raiz-texto-terciario">
              {formatarDinheiro(paciente.valorConsultaPadrao)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
