import { dataLocal, type DataLocal } from "@raiz/shared";

export const MAIORIDADE_ANOS = 18;

/**
 * Data a partir da qual o prontuário pode ser descartado (spec prontuario,
 * "Prazo de guarda configurável"). A contagem parte do último registro do
 * paciente ou, se ele ainda era menor de idade nessa data, do dia em que
 * completa 18 anos — o que vier depois. Sem data de nascimento, só o último
 * registro conta.
 *
 * `ultimoRegistro` é um instante e vira data no fuso da clínica;
 * `nascimento` é a coluna `@db.Date`, que o Prisma entrega à meia-noite UTC.
 * O resultado é data de calendário: nunca é persistido, porque depende do
 * prazo configurado.
 */
export function dataDeElegibilidade(
  ultimoRegistro: Date,
  nascimento: Date | null,
  prazoAnos: number,
): DataLocal {
  const registro = dataLocal(ultimoRegistro);
  const maioridade = nascimento
    ? somarAnos(nascimento.toISOString().slice(0, 10), MAIORIDADE_ANOS)
    : null;
  const inicio = maioridade && maioridade > registro ? maioridade : registro;
  return somarAnos(inicio, prazoAnos);
}

/**
 * Prazo em anos pelo Código Civil (art. 132, § 3º): vence no dia de igual
 * número ou, se ele não existir, no imediato. 29/02 + 1 ano é 01/03 — nunca
 * antes do prazo completo.
 */
function somarAnos(data: DataLocal, anos: number): DataLocal {
  const [a, m, d] = data.split("-").map(Number);
  return new Date(Date.UTC(a + anos, m - 1, d)).toISOString().slice(0, 10);
}
