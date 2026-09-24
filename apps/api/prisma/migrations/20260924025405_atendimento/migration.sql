-- CreateEnum
CREATE TYPE "StatusAtendimento" AS ENUM ('AGENDADO', 'REALIZADO', 'CANCELADO', 'REMARCADO', 'FALTA');

-- CreateTable
CREATE TABLE "atendimento" (
    "id" UUID NOT NULL,
    "paciente_id" UUID NOT NULL,
    "inicio" TIMESTAMPTZ NOT NULL,
    "fim" TIMESTAMPTZ NOT NULL,
    "status" "StatusAtendimento" NOT NULL DEFAULT 'AGENDADO',
    "valor" DECIMAL(10,2) NOT NULL,
    "motivo" TEXT,
    "remarcado_de_id" UUID,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "atendimento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "atendimento_remarcado_de_id_key" ON "atendimento"("remarcado_de_id");

-- CreateIndex
CREATE INDEX "atendimento_inicio_idx" ON "atendimento"("inicio");

-- CreateIndex
CREATE INDEX "atendimento_paciente_id_inicio_idx" ON "atendimento"("paciente_id", "inicio");

-- AddForeignKey
ALTER TABLE "atendimento" ADD CONSTRAINT "atendimento_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atendimento" ADD CONSTRAINT "atendimento_remarcado_de_id_fkey" FOREIGN KEY ("remarcado_de_id") REFERENCES "atendimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Duração entre 15 minutos (spec agenda) e 12 horas. O teto não vem da spec:
-- é o que permite a consulta por intervalo limitar `inicio` por baixo e usar
-- o índice (ver atendimento.repository.ts).
ALTER TABLE "atendimento" ADD CONSTRAINT "atendimento_duracao"
  CHECK (fim - inicio >= interval '15 minutes' AND fim - inicio <= interval '12 hours');

-- Os três encerramentos exigem motivo (spec agenda, "Encerramento sem motivo").
ALTER TABLE "atendimento" ADD CONSTRAINT "atendimento_motivo_nos_encerramentos"
  CHECK (status IN ('AGENDADO', 'REALIZADO') OR motivo IS NOT NULL);

-- Sem sobreposição entre atendimentos que ainda ocupam o horário (design.md,
-- "Sobreposição validada no banco"). O intervalo é [inicio, fim): um
-- atendimento pode começar exatamente quando o anterior termina. Violação
-- gera 23P01, que o serviço traduz para 409. btree_gist veio na migration
-- enable_btree_gist.
ALTER TABLE "atendimento" ADD CONSTRAINT "atendimento_sem_sobreposicao"
  EXCLUDE USING gist (tstzrange(inicio, fim) WITH &&)
  WHERE (status NOT IN ('CANCELADO', 'REMARCADO'));
