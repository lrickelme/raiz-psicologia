import { AreaConteudo } from "@/components/shell/area-conteudo";
import { CabecalhoPagina } from "@/components/shell/cabecalho-pagina";
import { Botao } from "@/components/ui/botao";
import { Card } from "@/components/ui/card";

export default function AgendaPage() {
  return (
    <>
      <CabecalhoPagina
        titulo="Agenda"
        descricao="Visão semanal dos atendimentos"
        acoes={<Botao>+ Nova consulta</Botao>}
      />
      <AreaConteudo>
        <Card>
          <p className="text-raiz-corpo text-raiz-texto-terciario">
            O calendário (visões diária, semanal e mensal) é construído na seção 6
            desta change.
          </p>
        </Card>
      </AreaConteudo>
    </>
  );
}
