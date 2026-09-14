export type StatusAtendimento = "AGENDADO" | "REALIZADO" | "CANCELADO" | "FALTA";

const estilos: Record<StatusAtendimento, { rotulo: string; classes: string }> = {
  REALIZADO: { rotulo: "Realizada", classes: "bg-raiz-musgo-suave text-raiz-musgo" },
  AGENDADO: { rotulo: "Agendada", classes: "bg-raiz-ambar-suave text-raiz-ambar" },
  CANCELADO: { rotulo: "Cancelada", classes: "bg-raiz-vinho-suave text-raiz-vinho" },
  // Sem referência no design-ref; tom neutro até a change 03 (financeiro) decidir.
  FALTA: { rotulo: "Falta", classes: "bg-raiz-sand text-raiz-texto-terciario" },
};

type BadgeStatusProps = { status: StatusAtendimento; className?: string };

export function BadgeStatus({ status, className = "" }: BadgeStatusProps) {
  const { rotulo, classes } = estilos[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-[11px] py-1 text-raiz-rotulo font-semibold ${classes} ${className}`}
    >
      <span aria-hidden className="text-[8px]">
        ●
      </span>
      {rotulo}
    </span>
  );
}
