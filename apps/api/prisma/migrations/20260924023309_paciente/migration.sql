-- CreateEnum
CREATE TYPE "StatusPaciente" AS ENUM ('ATIVO', 'ARQUIVADO');

-- CreateTable
CREATE TABLE "paciente" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "email" TEXT,
    "nascimento" DATE,
    "valor_consulta_padrao" DECIMAL(10,2) NOT NULL,
    "observacoes" TEXT,
    "status" "StatusPaciente" NOT NULL DEFAULT 'ATIVO',
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "paciente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "paciente_status_idx" ON "paciente"("status");

-- Busca sem acento e sem diferença de maiúsculas (spec pacientes, "Busca
-- parcial"). `unaccent()` não é IMMUTABLE — depende do dicionário configurado —
-- e por isso não pode entrar em índice direto. A função abaixo fixa o
-- dicionário, o que a torna imutável de fato e indexável.
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE FUNCTION raiz_normalizar(texto text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $$ SELECT lower(public.unaccent('public.unaccent'::regdictionary, texto)) $$;

-- Telefone é guardado como digitado; a busca compara só os dígitos, para que
-- "99812" encontre "(83) 99812-4471".
CREATE FUNCTION raiz_digitos(texto text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $$ SELECT regexp_replace(texto, '\D', '', 'g') $$;

CREATE INDEX "paciente_nome_busca_idx"
  ON "paciente" USING gin (raiz_normalizar("nome") gin_trgm_ops);
CREATE INDEX "paciente_telefone_busca_idx"
  ON "paciente" USING gin (raiz_digitos("telefone") gin_trgm_ops);
