import { AreaConteudo } from "@/components/shell/area-conteudo";
import { CabecalhoPagina } from "@/components/shell/cabecalho-pagina";
import { Botao } from "@/components/ui/botao";
import { Card } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <>
      <CabecalhoPagina
        titulo="Dashboard"
        descricao="Resumo do dia e do mês"
        acoes={<Botao>+ Nova consulta</Botao>}
      />
      <AreaConteudo>
        <Card titulo="Atendimentos de hoje">
          <p className="text-raiz-corpo text-raiz-texto-terciario">
            O painel do dia entra na seção 6 desta change (agenda). Os indicadores
            financeiros vêm na change 03.
          </p>
        </Card>
      </AreaConteudo>
    </>
  );
}
