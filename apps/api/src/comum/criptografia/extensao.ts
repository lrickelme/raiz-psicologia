import { Prisma } from "@prisma/client";
import type { CamposCriptografados } from "./campos";
import { cifrar, decifrar } from "./cifra";

/** Operações cujo `args.data` (ou `create`/`update`, no upsert) grava valores. */
const ESCRITAS = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
]);

/** Campo de relação → modelo de destino, por modelo. */
const RELACOES = new Map(
  Prisma.dmmf.datamodel.models.map((modelo) => [
    modelo.name,
    new Map(
      modelo.fields
        .filter((campo) => campo.kind === "object")
        .map((campo) => [campo.name, campo.type]),
    ),
  ]),
);

type Registro = Record<string, unknown>;

function ehRegistro(valor: unknown): valor is Registro {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

/**
 * Prisma Client Extension que cifra na escrita e decifra na leitura os campos
 * listados em `campos`. Atua em `$allModels`, e não só no modelo cifrado, para
 * decifrar também quando o registro chega por `include` de outro modelo.
 *
 * Fora do alcance, e por isso recusado em vez de ignorado:
 * - escrita aninhada em modelo cifrado (`paciente.update({ data: {
 *   atendimentos: { create } } })`) — gravaria em claro;
 * - filtro por campo cifrado em `where` — o IV aleatório faz a comparação
 *   nunca bater, e o erro silencioso seria pior que o explícito.
 * SQL cru (`$queryRaw`) também passa por fora; é o que os testes usam para
 * provar que a coluna está ilegível.
 */
export function criptografiaDeColuna(campos: CamposCriptografados, chave: Buffer) {
  const cifrados = (modelo: string) =>
    campos[modelo as Prisma.ModelName] ?? [];

  function cifrarDados(modelo: string, dados: unknown): unknown {
    if (Array.isArray(dados)) return dados.map((item) => cifrarDados(modelo, item));
    if (!ehRegistro(dados)) return dados;

    const saida: Registro = { ...dados };
    for (const campo of cifrados(modelo)) {
      const valor = saida[campo];
      const contexto = `${modelo}.${campo}`;
      if (typeof valor === "string") {
        saida[campo] = cifrar(valor, chave, contexto);
      } else if (ehRegistro(valor) && typeof valor.set === "string") {
        saida[campo] = { set: cifrar(valor.set, chave, contexto) };
      }
    }
    recusarEscritaAninhada(modelo, saida);
    return saida;
  }

  function recusarEscritaAninhada(modelo: string, valor: unknown): void {
    if (Array.isArray(valor)) {
      valor.forEach((item) => recusarEscritaAninhada(modelo, item));
      return;
    }
    if (!ehRegistro(valor)) return;

    for (const [chaveCampo, aninhado] of Object.entries(valor)) {
      // `where` só filtra; descer nele confundiria filtro de relação com escrita.
      if (chaveCampo === "where") continue;
      const destino = RELACOES.get(modelo)?.get(chaveCampo);
      if (destino && cifrados(destino).length) {
        throw new Error(
          `Escrita aninhada em ${destino} a partir de ${modelo} não é suportada: ` +
            `grave ${destino} pelo próprio modelo para que ${cifrados(destino).join(", ")} seja cifrado.`,
        );
      }
      recusarEscritaAninhada(destino ?? modelo, aninhado);
    }
  }

  function decifrarResultado(modelo: string, valor: unknown): void {
    if (Array.isArray(valor)) {
      valor.forEach((item) => decifrarResultado(modelo, item));
      return;
    }
    if (!ehRegistro(valor)) return;

    for (const campo of cifrados(modelo)) {
      if (typeof valor[campo] === "string") {
        valor[campo] = decifrar(valor[campo], chave, `${modelo}.${campo}`);
      }
    }
    for (const [campo, destino] of RELACOES.get(modelo) ?? []) {
      if (campo in valor) decifrarResultado(destino, valor[campo]);
    }
  }

  return Prisma.defineExtension({
    name: "criptografia-de-coluna",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const entrada = args as Registro;

          const { where } = entrada;
          if (ehRegistro(where)) {
            const filtrado = cifrados(model).find((campo) => campo in where);
            if (filtrado) {
              throw new Error(`${model}.${filtrado} é cifrado e não pode ser filtrado`);
            }
          }

          if (ESCRITAS.has(operation)) {
            for (const chaveArgs of ["data", "create", "update"] as const) {
              if (chaveArgs in entrada) {
                entrada[chaveArgs] = cifrarDados(model, entrada[chaveArgs]);
              }
            }
          }

          const resultado = await query(entrada);
          decifrarResultado(model, resultado);
          return resultado;
        },
      },
    },
  });
}
