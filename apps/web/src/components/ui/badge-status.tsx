import type { StatusAtendimento } from "@raiz/shared";

export type { StatusAtendimento };

/**
 * Falta é pill cheio em vinho: é evento cobrado e precisa pesar mais que o
 * cancelamento, que usa o mesmo vinho em tom suave. Remarcada fica neutra em
 * bege, para não ser lida como cancelamento. (Cores aprovadas em 24/09/2026.)
 */
export const ESTILO_STATUS: Record<StatusAtendimento, { rotulo: string; classes: string }> = {
  REALIZADO: { rotulo: "Realizada", classes: "bg-raiz-musgo-suave text-raiz-musgo" },
  AGENDADO: { rotulo: "Agendada", classes: "bg-raiz-ambar-suave text-raiz-ambar" },
  CANCELADO: { rotulo: "Cancelada", classes: "bg-raiz-vinho-suave text-raiz-vinho" },
  FALTA: { rotulo: "Falta", classes: "bg-raiz-vinho text-raiz-sobre-vinho" },
  REMARCADO: { rotulo: "Remarcada", classes: "bg-raiz-bege text-raiz-texto-secundario" },
};

type BadgeStatusProps = { status: StatusAtendimento; className?: string };

export function BadgeStatus({ status, className = "" }: BadgeStatusProps) {
  const { rotulo, classes } = ESTILO_STATUS[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-[11px] py-1 text-raiz-rotulo font-semibold whitespace-nowrap ${classes} ${className}`}
    >
      <span aria-hidden className="text-[8px]">
        ●
      </span>
      {rotulo}
    </span>
  );
}
