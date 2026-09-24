import { iniciais } from "@/lib/formatar";

type AvatarProps = { nome: string; tamanho?: "pequeno" | "grande" };

/** Iniciais sobre bege, como na receita por paciente e no perfil do design-ref. */
export function Avatar({ nome, tamanho = "pequeno" }: AvatarProps) {
  const classes =
    tamanho === "grande"
      ? "size-[74px] font-raiz-display text-raiz-numero font-bold"
      : "size-[30px] text-raiz-rotulo font-semibold";
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-raiz-bege text-raiz-marrom ${classes}`}
    >
      {iniciais(nome)}
    </span>
  );
}
