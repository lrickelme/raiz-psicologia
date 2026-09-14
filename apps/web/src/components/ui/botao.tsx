import type { ButtonHTMLAttributes } from "react";

type Variante = "primario" | "secundario" | "sucesso";

const variantes: Record<Variante, string> = {
  primario:
    "bg-raiz-vinho text-raiz-sobre-vinho py-[11px] hover:bg-raiz-vinho-escuro",
  secundario:
    "border-[1.5px] border-raiz-borda-forte text-raiz-marrom py-[10px] hover:bg-raiz-sand",
  sucesso:
    "bg-raiz-musgo text-raiz-sobre-musgo py-[11px] hover:bg-raiz-musgo-claro",
};

type BotaoProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
};

export function Botao({
  variante = "primario",
  className = "",
  type = "button",
  ...props
}: BotaoProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 font-raiz-corpo text-raiz-corpo font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-raiz-vinho disabled:cursor-not-allowed disabled:opacity-50 ${variantes[variante]} ${className}`}
      {...props}
    />
  );
}
