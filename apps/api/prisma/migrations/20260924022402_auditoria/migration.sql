-- CreateTable
CREATE TABLE "auditoria" (
    "id" UUID NOT NULL,
    "ocorrido_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo_evento" TEXT NOT NULL,
    "recurso_tipo" TEXT,
    "recurso_id" TEXT,
    "ip" TEXT,
    "detalhe" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auditoria_ocorrido_em_idx" ON "auditoria"("ocorrido_em");

-- CreateIndex
CREATE INDEX "auditoria_recurso_tipo_recurso_id_idx" ON "auditoria"("recurso_tipo", "recurso_id");

-- Somente-inserção (spec auth, "Registro imutável").
--
-- O REVOKE sozinho não basta: o usuário que a aplicação usa hoje é o
-- superusuário criado pela imagem do Postgres, e superusuário ignora
-- privilégios. O gatilho é o que garante a regra para qualquer papel,
-- inclusive o dono da tabela; o REVOKE fica como segunda camada para quando a
-- aplicação passar a conectar com um papel sem privilégios de administrador.
REVOKE UPDATE, DELETE, TRUNCATE ON "auditoria" FROM PUBLIC;
REVOKE UPDATE, DELETE, TRUNCATE ON "auditoria" FROM CURRENT_USER;

CREATE FUNCTION auditoria_somente_insercao() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'auditoria é somente-inserção: % recusado', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER auditoria_sem_alteracao
  BEFORE UPDATE OR DELETE ON "auditoria"
  FOR EACH ROW EXECUTE FUNCTION auditoria_somente_insercao();

CREATE TRIGGER auditoria_sem_truncate
  BEFORE TRUNCATE ON "auditoria"
  FOR EACH STATEMENT EXECUTE FUNCTION auditoria_somente_insercao();
