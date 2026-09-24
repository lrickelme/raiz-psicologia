import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Folha } from "@/components/shell/folha";
import { destinoSeguro } from "@/features/auth/destino";
import { FormularioLogin } from "@/features/auth/formulario-login";
import { obterSessao } from "@/features/auth/sessao-servidor";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Entrar · Raíz" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { de } = await searchParams;
  const destino = destinoSeguro(typeof de === "string" ? de : null);

  // Quem já tem sessão válida não precisa ver o formulário — acontece, por
  // exemplo, ao abrir um link externo: o cookie `SameSite=Strict` não vai na
  // navegação vinda de outro site, o proxy manda para cá, e aqui ele já vai.
  if (await obterSessao()) redirect(destino);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-raiz-areia px-5 py-12">
      <div className="flex w-full max-w-[400px] flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3.5">
          <div className="flex items-center gap-3">
            <Folha tamanho={44} />
            <span className="font-raiz-display text-[30px] leading-none font-bold text-raiz-marrom">
              Raíz
            </span>
          </div>
          <span className="font-raiz-mono text-[10.5px] tracking-[0.34em] text-raiz-texto-terciario uppercase">
            Psicologia · Sistema de Gestão
          </span>
        </div>

        <section className="w-full rounded-raiz-painel border border-raiz-borda bg-raiz-superficie p-8 shadow-raiz-moldura">
          <h1 className="font-raiz-display text-raiz-titulo font-semibold text-raiz-marrom">
            Entrar
          </h1>
          <p className="mt-1 mb-6 text-raiz-corpo-sm text-raiz-texto-terciario">
            Acesso restrito à profissional responsável.
          </p>
          <FormularioLogin destino={destino} />
        </section>
      </div>
    </main>
  );
}
