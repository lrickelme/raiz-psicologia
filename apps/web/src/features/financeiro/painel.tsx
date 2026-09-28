import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

/** Card de painel com o estado vazio próprio: nunca um gráfico sem dados (spec financeiro). */
export function Painel({
  titulo,
  acoes,
  vazio,
  children,
  className = "",
}: {
  titulo: ReactNode;
  acoes?: ReactNode;
  /** Mensagem no lugar do conteúdo quando não há o que mostrar. */
  vazio?: string | false;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card titulo={titulo} acoes={acoes} className={className}>
      {vazio ? <Vazio>{vazio}</Vazio> : children}
    </Card>
  );
}

export function Vazio({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-raiz-campo border border-dashed border-raiz-borda-forte px-4 py-8 text-center text-raiz-corpo text-raiz-texto-terciario">
      {children}
    </p>
  );
}

export function Carregando() {
  return (
    <p role="status" className="py-8 text-center text-raiz-corpo-sm text-raiz-texto-terciario">
      Carregando…
    </p>
  );
}

export function Falha({ mensagem }: { mensagem: string }) {
  return (
    <p role="alert" className="py-8 text-center text-raiz-corpo-sm font-semibold text-raiz-vinho">
      {mensagem}
    </p>
  );
}
