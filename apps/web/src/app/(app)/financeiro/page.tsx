import { AreaConteudo } from "@/components/shell/area-conteudo";
import { CabecalhoPagina } from "@/components/shell/cabecalho-pagina";
import { Card } from "@/components/ui/card";

export default function FinanceiroPage() {
  return (
    <>
      <CabecalhoPagina titulo="Financeiro" descricao="Receita, sessões e projeções" />
      <AreaConteudo>
        <Card>
          <p className="text-raiz-corpo text-raiz-texto-terciario">
            Este módulo é construído na change 03 (financeiro), a partir dos
            atendimentos realizados.
          </p>
        </Card>
      </AreaConteudo>
    </>
  );
}
