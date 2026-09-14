import { useId, type InputHTMLAttributes } from "react";

type CampoProps = InputHTMLAttributes<HTMLInputElement> & {
  rotulo: string;
  erro?: string;
  descricao?: string;
};

export function Campo({
  rotulo,
  erro,
  descricao,
  id,
  className = "",
  ...props
}: CampoProps) {
  const gerado = useId();
  const campoId = id ?? gerado;
  const erroId = `${campoId}-erro`;
  const descricaoId = `${campoId}-descricao`;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label
        htmlFor={campoId}
        className="text-raiz-corpo-sm font-semibold text-raiz-marrom"
      >
        {rotulo}
      </label>
      <input
        id={campoId}
        aria-invalid={erro ? true : undefined}
        aria-describedby={
          [erro && erroId, descricao && descricaoId].filter(Boolean).join(" ") ||
          undefined
        }
        className={`rounded-raiz-campo border-[1.5px] bg-raiz-superficie px-3.5 py-[11px] text-raiz-corpo text-raiz-marrom placeholder:text-raiz-texto-terciario focus:outline-none ${
          erro
            ? "border-raiz-vinho"
            : "border-raiz-borda-forte focus:border-raiz-vinho"
        }`}
        {...props}
      />
      {descricao && !erro && (
        <p id={descricaoId} className="text-raiz-legenda text-raiz-texto-terciario">
          {descricao}
        </p>
      )}
      {erro && (
        <p id={erroId} className="text-raiz-legenda font-semibold text-raiz-vinho">
          {erro}
        </p>
      )}
    </div>
  );
}
