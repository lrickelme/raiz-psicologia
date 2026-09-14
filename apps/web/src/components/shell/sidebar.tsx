import { Folha } from "./folha";
import { NavSidebar } from "./nav-sidebar";

type Perfil = { nome: string; registro: string; iniciais: string };

// Preenchido pela sessão (GET /api/v1/auth/sessao) a partir da seção 3.
const perfilPlaceholder: Perfil = { nome: "Profissional", registro: "CRP —", iniciais: "PR" };

export function Sidebar({ perfil = perfilPlaceholder }: { perfil?: Perfil }) {
  return (
    <aside className="sticky top-0 flex h-dvh w-raiz-sidebar shrink-0 flex-col gap-[22px] bg-raiz-marrom px-4 py-[22px]">
      <div className="flex items-center gap-[11px] px-1.5 py-1">
        <Folha tamanho={34} />
        <span className="font-raiz-display text-raiz-marca font-bold text-raiz-areia">
          Raíz
        </span>
      </div>

      <NavSidebar />

      <div className="flex-1" />

      <div className="flex items-center gap-[11px] border-t border-raiz-linho-claro/12 p-2.5">
        <span
          aria-hidden
          className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-raiz-musgo text-[12.5px] font-semibold text-raiz-sobre-musgo"
        >
          {perfil.iniciais}
        </span>
        <div className="min-w-0">
          <div className="truncate text-raiz-corpo-sm font-semibold text-raiz-areia">
            {perfil.nome}
          </div>
          <div className="text-raiz-legenda text-raiz-texto-inativo">{perfil.registro}</div>
        </div>
      </div>
    </aside>
  );
}
