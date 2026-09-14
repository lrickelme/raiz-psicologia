import { Sidebar } from "@/components/shell/sidebar";

// Toda rota autenticada é dinâmica (project.md): nada aqui entra em cache estático.
export const dynamic = "force-dynamic";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-dvh bg-raiz-areia">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col bg-raiz-areia">{children}</main>
    </div>
  );
}
