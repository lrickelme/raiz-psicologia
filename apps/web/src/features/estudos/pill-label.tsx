import type { Label } from "@raiz/shared";
import { classesLabel } from "./cores-label";

/** O nome vai sempre escrito: a cor nunca é o único sinal (spec estudos). */
export function PillLabel({ label }: { label: Pick<Label, "nome" | "cor"> }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-[3px] text-[10.5px] font-semibold whitespace-nowrap ${classesLabel(label.cor)}`}
    >
      {label.nome}
    </span>
  );
}
