import { PipeTransform, UnprocessableEntityException } from "@nestjs/common";
import type { ZodType } from "zod";

/**
 * Valida o payload com um schema Zod (vindo de packages/shared, a mesma
 * fonte de verdade usada pelo formulário do Next). Falha vira 422 em formato
 * RFC 7807 via ProblemDetailsFilter, apontando os campos inválidos.
 */
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw new UnprocessableEntityException({
        error: "Dados inválidos",
        message: "Um ou mais campos não passaram na validação",
        campos: result.error.issues.map((issue) => ({
          caminho: issue.path.join("."),
          mensagem: issue.message,
        })),
      });
    }

    return result.data;
  }
}
