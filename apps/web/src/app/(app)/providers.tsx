"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  // Um cliente por montagem do layout: no servidor, nunca compartilhado entre
  // requisições; no navegador, estável entre renderizações.
  const [cliente] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: false } },
      }),
  );
  return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
}
