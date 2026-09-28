-- AlterTable
ALTER TABLE "atendimento" ADD COLUMN     "cobranca_dispensada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cobravel" BOOLEAN,
ADD COLUMN     "encerrado_em" TIMESTAMPTZ,
ADD COLUMN     "motivo_dispensa" TEXT;

-- Atendimento aberto não tem encerramento nem cobrabilidade decididos (spec
-- agenda, "Cobrabilidade congelada no encerramento"). Só nesse sentido: um
-- cancelamento antigo sem registro na trilha fica encerrado com os dois nulos
-- até decisão da profissional (migration `cobranca_backfill`).
ALTER TABLE "atendimento" ADD CONSTRAINT "atendimento_aberto_sem_cobranca"
  CHECK (status <> 'AGENDADO' OR (cobravel IS NULL AND encerrado_em IS NULL));

-- Caminho quente da receita realizada: a consulta sempre filtra pelos dois
-- predicados, então o índice parcial fica pequeno e serve só a ela
-- (design.md, "Modelo de dados"). O Prisma não modela índice parcial.
CREATE INDEX "atendimento_receita_idx" ON "atendimento" ("inicio")
  WHERE cobravel = true AND cobranca_dispensada = false;
