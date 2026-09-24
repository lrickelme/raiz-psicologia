import Link from "next/link";
import { BotaoSair } from "@/features/auth/botao-sair";
import { Folha } from "./folha";
import { NavSidebar } from "./nav-sidebar";

type Perfil = { nome: string; registro: string; iniciais: string };

export function Sidebar({ perfil }: { perfil: Perfil }) {
  return (
    <aside className="sticky top-0 flex h-dvh w-raiz-sidebar shrink-0 flex-col gap-[22px] bg-raiz-marrom px-4 py-[22px]">
      {/* Contorno em areia: o vinho usado no resto do app some sobre o marrom. */}
      <Link
        href="/"
        aria-label="Raíz — ir para o Dashboard"
        className="flex items-center gap-[11px] self-start rounded-raiz-campo px-1.5 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-raiz-areia"
      >
        <Folha tamanho={34} />
        <span className="font-raiz-display text-raiz-marca font-bold text-raiz-areia">
          Raíz
        </span>
      </Link>

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
        <BotaoSair />
      </div>
    </aside>
  );
}
