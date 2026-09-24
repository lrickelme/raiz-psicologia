import { NextRequest, NextResponse } from "next/server";
import { sincronizarCookieExpira } from "@/features/auth/cookie-expira";
import { API_INTERNAL_URL } from "@/lib/api-interna";

/**
 * BFF: o navegador só fala com o Next. Essa rota repassa para o NestJS em
 * rede interna, encaminhando cookie de sessão na ida e Set-Cookie na volta.
 * Ver design.md, "Next.js como BFF, NestJS fechado".
 *
 * Nunca cacheado: toda rota autenticada é dinâmica (project.md).
 */
export const dynamic = "force-dynamic";

async function proxy(request: NextRequest, path: string[]): Promise<Response> {
  const targetUrl = `${API_INTERNAL_URL}/api/${path.join("/")}${request.nextUrl.search}`;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("content-length");

  const hasBody = !["GET", "HEAD"].includes(request.method);
  const body = hasBody ? await request.arrayBuffer() : undefined;

  const upstream = await fetch(targetUrl, {
    method: request.method,
    headers,
    body,
  });

  // A cópia já leva os Set-Cookie da API, um por um.
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");
  responseHeaders.delete("transfer-encoding");
  // Resposta com dado de paciente não pode ficar em cache de navegador nem de
  // proxy intermediário; `force-dynamic` só cobre o cache do próprio Next.
  responseHeaders.set("cache-control", "private, no-store");

  const response = new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
  sincronizarCookieExpira(upstream, response);
  return response;
}

type RouteParams = { params: Promise<{ path: string[] }> };

async function handle(request: NextRequest, { params }: RouteParams) {
  const { path } = await params;
  return proxy(request, path);
}

export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
};
