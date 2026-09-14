type FolhaProps = { tamanho?: number; className?: string };

export function Folha({ tamanho = 34, className = "" }: FolhaProps) {
  return (
    <span
      aria-hidden
      style={{ width: tamanho, height: tamanho }}
      className={`relative block shrink-0 rounded-[54%_8%_54%_8%] bg-linear-140 from-raiz-folha to-raiz-marrom after:absolute after:top-[14%] after:bottom-[14%] after:left-1/2 after:w-[1.5px] after:-translate-x-1/2 after:bg-raiz-linho-claro/50 after:content-[''] ${className}`}
    />
  );
}
