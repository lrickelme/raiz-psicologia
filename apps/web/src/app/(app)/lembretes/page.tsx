import { AreaConteudo } from "@/components/shell/area-conteudo";
import { CabecalhoPagina } from "@/components/shell/cabecalho-pagina";
import { Card } from "@/components/ui/card";

export default function LembretesPage() {
  return (
    <>
      <CabecalhoPagina titulo="Lembretes" descricao="Notas e pendências" />
      <AreaConteudo>
        <Card>
          <p className="text-raiz-corpo text-raiz-texto-terciario">
            Este módulo é construído na change 05 (lembretes).
          </p>
        </Card>
      </AreaConteudo>
    </>
  );
}
