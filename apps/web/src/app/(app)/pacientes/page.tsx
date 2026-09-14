import { AreaConteudo } from "@/components/shell/area-conteudo";
import { CabecalhoPagina } from "@/components/shell/cabecalho-pagina";
import { Botao } from "@/components/ui/botao";
import { Card } from "@/components/ui/card";

export default function PacientesPage() {
  return (
    <>
      <CabecalhoPagina
        titulo="Pacientes"
        descricao="Cadastro e histórico"
        acoes={<Botao>+ Novo paciente</Botao>}
      />
      <AreaConteudo>
        <Card>
          <p className="text-raiz-corpo text-raiz-texto-terciario">
            Listagem com busca, cadastro e perfil entram na seção 5 desta change.
          </p>
        </Card>
      </AreaConteudo>
    </>
  );
}
