import { redirect } from "next/navigation";
import { Sidebar } from "@/components/shell/sidebar";
import { AvisoExpiracao } from "@/features/auth/aviso-expiracao";
import { obterSessao } from "@/features/auth/sessao-servidor";
import { iniciais } from "@/lib/formatar";
import { Providers } from "./providers";

// Toda rota autenticada é dinâmica (project.md): nada aqui entra em cache estático.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  // O proxy já barrou quem chega sem sessão; aqui é a checagem que vale também
  // para o prefetch, que o proxy deixa passar.
  const sessao = await obterSessao();
  if (!sessao) redirect("/login");

  const { nome } = sessao.usuario;

  return (
    <div className="flex min-h-dvh bg-raiz-areia">
      <Sidebar perfil={{ nome, registro: "CRP —", iniciais: iniciais(nome) }} />
      <main className="flex min-w-0 flex-1 flex-col bg-raiz-areia">
        <Providers>{children}</Providers>
      </main>
      <AvisoExpiracao />
    </div>
  );
}
