import { diaDaSemana, hojeLocal, type Atendimento } from "@raiz/shared";
import Link from "next/link";
import { AreaConteudo } from "@/components/shell/area-conteudo";
import { CabecalhoPagina } from "@/components/shell/cabecalho-pagina";
import { Avatar } from "@/components/ui/avatar";
import { BadgeStatus } from "@/components/ui/badge-status";
import { Card } from "@/components/ui/card";
import { DIAS_CURTOS, formatarDiaLongo, OCUPA } from "@/features/agenda/calendario";
import { faixaHoraria } from "@/features/agenda/horario";
import { buscarNaApi } from "@/lib/api-servidor";
import { formatarDinheiro } from "@/lib/formatar";

export const dynamic = "force-dynamic";

const botaoAgendar =
  "inline-flex items-center rounded-full bg-raiz-vinho px-5 py-[11px] text-raiz-corpo font-semibold text-raiz-sobre-vinho hover:bg-raiz-vinho-escuro";

export default async function DashboardPage() {
  // Hoje de São Paulo, qualquer que seja o fuso do servidor (spec agenda).
  const hoje = hojeLocal();
  const doDia = await buscarNaApi<Atendimento[]>(`/atendimentos?de=${hoje}&ate=${hoje}`);
  const ativos = doDia.filter((a) => OCUPA[a.status]);

  return (
    <>
      <CabecalhoPagina
        titulo="Dashboard"
        descricao={`${DIAS_CURTOS[diaDaSemana(hoje)]}, ${formatarDiaLongo(hoje)} · ${ativos.length} ${
          ativos.length === 1 ? "sessão" : "sessões"
        } hoje`}
        acoes={
          <Link href="/agenda?novo=1" className={botaoAgendar}>
            + Nova consulta
          </Link>
        }
      />
      <AreaConteudo>
        <Card titulo="Atendimentos de hoje">
          {doDia.length ? (
            <ul className="flex flex-col">
              {doDia.map((a) => (
                <li
                  key={a.id}
                  className={`flex items-center gap-3.5 border-b border-raiz-borda py-[11px] last:border-b-0 ${
                    OCUPA[a.status] ? "" : "opacity-60"
                  }`}
                >
                  <Avatar nome={a.paciente.nome} />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/pacientes/${a.paciente.id}`}
                      className="block truncate text-raiz-corpo font-semibold text-raiz-marrom hover:underline"
                    >
                      {a.paciente.nome}
                    </Link>
                    <div className="font-raiz-mono text-raiz-rotulo text-raiz-texto-terciario">
                      {faixaHoraria(a.inicio, a.fim)}
                    </div>
                  </div>
                  <BadgeStatus status={a.status} />
                  <div className="w-[84px] text-right font-raiz-mono text-[13px] text-raiz-marrom">
                    {formatarDinheiro(a.valor)}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            // Estado vazio sem grade em branco (spec agenda, "Dia vazio").
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-raiz-corpo text-raiz-texto-terciario">
                Nenhum atendimento agendado para hoje.
              </p>
              <Link href="/agenda?novo=1" className={botaoAgendar}>
                Agendar consulta
              </Link>
            </div>
          )}
        </Card>
        <p className="text-raiz-meta text-raiz-texto-terciario">
          Os indicadores financeiros entram na change 03.
        </p>
      </AreaConteudo>
    </>
  );
}
