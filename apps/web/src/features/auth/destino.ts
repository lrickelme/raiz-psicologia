/**
 * Caminho para onde voltar depois do login. Só aceita caminho interno: um
 * `?de=//outro.site` ou `?de=https://...` viraria redirecionamento aberto.
 */
export function destinoSeguro(de: string | null | undefined): string {
  if (!de || !de.startsWith("/") || de.startsWith("//") || de.startsWith("/\\")) {
    return "/";
  }
  return de;
}
