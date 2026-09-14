import { AreaConteudo } from "@/components/shell/area-conteudo";
import { CabecalhoPagina } from "@/components/shell/cabecalho-pagina";
import { Card } from "@/components/ui/card";

export default function EstudosPage() {
  return (
    <>
      <CabecalhoPagina titulo="Estudos" descricao="Tópicos e labels de prioridade" />
      <AreaConteudo>
        <Card>
          <p className="text-raiz-corpo text-raiz-texto-terciario">
            Este módulo é construído na change 04 (estudos).
          </p>
        </Card>
      </AreaConteudo>
    </>
  );
}
