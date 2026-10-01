-- CreateEnum
CREATE TYPE "StatusTopico" AS ENUM ('A_ESTUDAR', 'EM_ESTUDO', 'CONCLUIDO');

-- CreateEnum
CREATE TYPE "CorLabel" AS ENUM ('VINHO', 'AMBAR', 'MUSGO', 'MUSGO_SUAVE', 'MARROM', 'BEGE');

-- CreateTable
CREATE TABLE "label_prioridade" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "cor" "CorLabel" NOT NULL,
    "ordem" INTEGER NOT NULL,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "label_prioridade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topico_estudo" (
    "id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "label_id" UUID,
    "status" "StatusTopico" NOT NULL DEFAULT 'A_ESTUDAR',
    "concluido_em" TIMESTAMPTZ,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "topico_estudo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "topico_estudo_status_idx" ON "topico_estudo"("status");

-- AddForeignKey
ALTER TABLE "topico_estudo" ADD CONSTRAINT "topico_estudo_label_id_fkey" FOREIGN KEY ("label_id") REFERENCES "label_prioridade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Concluído tem instante de conclusão, e só ele (spec estudos, "Estados do
-- tópico"). O serviço é quem grava; o CHECK protege caminhos futuros.
ALTER TABLE "topico_estudo" ADD CONSTRAINT "topico_conclusao_coerente"
  CHECK ((status = 'CONCLUIDO') = (concluido_em IS NOT NULL));

-- Nome único sem caixa nem acento, pela mesma função da migration `paciente`.
CREATE UNIQUE INDEX "label_prioridade_nome_unico"
  ON "label_prioridade" (raiz_normalizar("nome"));

-- Coluna "Concluídos" e histórico: mais recentes primeiro. Parcial porque só
-- essas consultas o usam; o Prisma não modela índice parcial.
CREATE INDEX "topico_estudo_concluidos_idx"
  ON "topico_estudo" ("concluido_em" DESC) WHERE status = 'CONCLUIDO';

-- Labels iniciais. Dado de referência, por isso aqui e não no seed, que só
-- provisiona credencial (design.md da 04). Ids fixos em UUID v7.
INSERT INTO "label_prioridade" ("id", "nome", "cor", "ordem", "atualizado_em") VALUES
  ('0199a000-0000-7000-8000-000000000001', 'Alta',  'VINHO', 1, CURRENT_TIMESTAMP),
  ('0199a000-0000-7000-8000-000000000002', 'Média', 'AMBAR', 2, CURRENT_TIMESTAMP),
  ('0199a000-0000-7000-8000-000000000003', 'Baixa', 'MUSGO', 3, CURRENT_TIMESTAMP);
