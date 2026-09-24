import Link from "next/link";

type PaginacaoProps = {
  page: number;
  size: number;
  total: number;
  /** Monta o href de uma página preservando os filtros. */
  href: (page: number) => string;
};

export function Paginacao({ page, size, total, href }: PaginacaoProps) {
  const paginas = Math.max(1, Math.ceil(total / size));
  if (paginas === 1) return null;

  const classe =
    "rounded-full border-[1.5px] border-raiz-borda-forte px-4 py-1.5 text-raiz-corpo-sm font-semibold text-raiz-marrom hover:bg-raiz-sand";
  const inativo = "pointer-events-none opacity-40";

  return (
    <nav aria-label="Paginação" className="flex items-center justify-between gap-3 pt-3">
      <Link
        href={href(page - 1)}
        aria-disabled={page <= 1}
        className={`${classe} ${page <= 1 ? inativo : ""}`}
      >
        ← Anterior
      </Link>
      <span className="font-raiz-mono text-raiz-legenda text-raiz-texto-terciario">
        página {page} de {paginas}
      </span>
      <Link
        href={href(page + 1)}
        aria-disabled={page >= paginas}
        className={`${classe} ${page >= paginas ? inativo : ""}`}
      >
        Próxima →
      </Link>
    </nav>
  );
}
