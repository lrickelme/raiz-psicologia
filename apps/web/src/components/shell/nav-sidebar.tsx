"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type Item = { href: string; rotulo: string; icone: ReactNode };

const svgProps = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const itens: Item[] = [
  {
    href: "/",
    rotulo: "Dashboard",
    icone: (
      <svg {...svgProps}>
        <path d="M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z" />
      </svg>
    ),
  },
  {
    href: "/agenda",
    rotulo: "Agenda",
    icone: (
      <svg {...svgProps}>
        <path d="M7 2v3M17 2v3M3 8h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
      </svg>
    ),
  },
  {
    href: "/pacientes",
    rotulo: "Pacientes",
    icone: (
      <svg {...svgProps}>
        <path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
      </svg>
    ),
  },
  {
    href: "/estudos",
    rotulo: "Estudos",
    icone: (
      <svg {...svgProps}>
        <path d="M4 4h11a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4V4Zm0 0v14" />
      </svg>
    ),
  },
  {
    href: "/lembretes",
    rotulo: "Lembretes",
    icone: (
      <svg {...svgProps}>
        <path d="M5 4h14v10l-5 5H5V4Zm9 15v-5h5" />
      </svg>
    ),
  },
  {
    href: "/financeiro",
    rotulo: "Financeiro",
    icone: (
      <svg {...svgProps}>
        <path d="M3 3v18h18M7 14l3-3 3 3 5-6" />
      </svg>
    ),
  },
];

export function NavSidebar() {
  const pathname = usePathname();

  return (
    <nav aria-label="Principal" className="flex flex-col gap-1">
      {itens.map(({ href, rotulo, icone }) => {
        const ativo = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={ativo ? "page" : undefined}
            className={`flex items-center gap-3 rounded-raiz-campo px-[13px] py-2.5 text-raiz-nav transition-colors ${
              ativo
                ? "bg-raiz-vinho font-semibold text-raiz-sobre-vinho [&_svg]:stroke-2"
                : "font-medium text-raiz-texto-inativo hover:bg-raiz-linho-claro/8 [&_svg]:stroke-[1.7]"
            }`}
          >
            {icone}
            <span>{rotulo}</span>
          </Link>
        );
      })}
    </nav>
  );
}
