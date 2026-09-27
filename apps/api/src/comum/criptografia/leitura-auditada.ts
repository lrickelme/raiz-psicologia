import type { Prisma, PrismaClient } from "@prisma/client";
import { EventoAuditoria } from "../../auditoria/eventos";
import { ipDaRequisicao } from "../contexto-requisicao";
import type { AoDecifrar } from "./extensao";

/**
 * `EVOLUCAO_LIDA` por evolução decifrada (spec prontuario, "Evolução
 * criptografada e auditada"). Amarrado à decifragem, e não às rotas, para que
 * qualquer caminho que leia texto de evolução — inclusive os que ainda não
 * existem — entre na trilha sem precisar lembrar de chamá-la.
 *
 * Grava pelo cliente sem a extensão: a auditoria não tem campo cifrado, e
 * passar pela extensão de novo só adicionaria uma volta. Motivo de
 * atendimento e rascunho não geram evento: a spec pede rastreamento por
 * evolução, e o motivo já é coberto pelo interceptor de rota.
 */
export function auditarLeituraDeEvolucao(cliente: PrismaClient): AoDecifrar {
  return async (decifrados) => {
    const registros: Prisma.AuditoriaCreateManyInput[] = decifrados
      .filter(({ modelo }) => modelo === "Evolucao")
      .map(({ registro }) => {
        const { id, pacienteId } = registro;
        // Sem id não há o que registrar, e decifrar sem registrar é
        // exatamente o que a trilha existe para impedir.
        if (typeof id !== "string" || typeof pacienteId !== "string") {
          throw new Error(
            "Leitura de Evolucao.texto sem id e pacienteId no resultado não pode ser auditada: " +
              "inclua os dois no select.",
          );
        }
        return {
          tipoEvento: EventoAuditoria.EVOLUCAO_LIDA,
          recursoTipo: "EVOLUCAO",
          recursoId: id,
          ip: ipDaRequisicao() ?? null,
          detalhe: { pacienteId },
        };
      });
    if (registros.length) await cliente.auditoria.createMany({ data: registros });
  };
}
