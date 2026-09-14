import type { ReactNode } from "react";

export function AreaConteudo({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 px-raiz-conteudo-x pt-5 pb-7">{children}</div>
  );
}
