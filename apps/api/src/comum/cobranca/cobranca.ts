import { dataLocal, type StatusAtendimento } from "@raiz/shared";

export type StatusEncerrado = Exclude<StatusAtendimento, "AGENDADO">;

/**
 * Se um atendimento encerrado é cobrável (spec agenda, "Cobrabilidade
 * congelada no encerramento"), pela regra definida pela profissional:
 *
 * - `REALIZADO` e `FALTA`: sempre;
 * - `REMARCADO`: nunca;
 * - `CANCELADO`: só quando cancelado no mesmo dia de calendário do início,
 *   em `America/Sao_Paulo`.
 *
 * Compara datas locais, nunca a diferença em horas: cancelar no domingo às
 * 23h uma consulta de segunda às 9h não é cobrado, e cancelar na segunda às
 * 8h uma de segunda às 18h é — é a regra, literal (proposal, "Abordagem").
 *
 * O resultado é gravado no encerramento e nunca recalculado: mudar esta
 * função não pode reescrever a receita de meses já apurados.
 */
export function cobravel(inicio: Date, encerradoEm: Date, status: StatusEncerrado): boolean {
  switch (status) {
    case "REALIZADO":
    case "FALTA":
      return true;
    case "REMARCADO":
      return false;
    case "CANCELADO":
      return dataLocal(encerradoEm) === dataLocal(inicio);
  }
}

/** Campos gravados no mesmo UPDATE que encerra o atendimento. */
export function encerramento(inicio: Date, status: StatusEncerrado, agora = new Date()) {
  return { status, encerradoEm: agora, cobravel: cobravel(inicio, agora, status) };
}
