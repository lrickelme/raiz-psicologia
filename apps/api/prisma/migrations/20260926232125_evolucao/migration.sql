-- CreateTable
CREATE TABLE "evolucao" (
    "id" UUID NOT NULL,
    "paciente_id" UUID NOT NULL,
    "atendimento_id" UUID,
    "texto" TEXT NOT NULL,
    "registrado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retifica_de_id" UUID,
    "vigente" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evolucao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rascunho_evolucao" (
    "id" UUID NOT NULL,
    "paciente_id" UUID NOT NULL,
    "atendimento_id" UUID,
    "texto" TEXT NOT NULL,
    "atualizado_em" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "rascunho_evolucao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "evolucao_retifica_de_id_key" ON "evolucao"("retifica_de_id");

-- CreateIndex
CREATE INDEX "evolucao_paciente_id_registrado_em_idx" ON "evolucao"("paciente_id", "registrado_em");

-- CreateIndex
CREATE INDEX "evolucao_atendimento_id_idx" ON "evolucao"("atendimento_id");

-- CreateIndex
-- NULLS NOT DISTINCT: sem isso, o rascunho avulso (atendimento_id nulo) não
-- teria unicidade e cada salvamento poderia criar uma linha nova.
CREATE UNIQUE INDEX "rascunho_evolucao_paciente_id_atendimento_id_key" ON "rascunho_evolucao"("paciente_id", "atendimento_id") NULLS NOT DISTINCT;

-- AddForeignKey
ALTER TABLE "evolucao" ADD CONSTRAINT "evolucao_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evolucao" ADD CONSTRAINT "evolucao_atendimento_id_fkey" FOREIGN KEY ("atendimento_id") REFERENCES "atendimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evolucao" ADD CONSTRAINT "evolucao_retifica_de_id_fkey" FOREIGN KEY ("retifica_de_id") REFERENCES "evolucao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rascunho_evolucao" ADD CONSTRAINT "rascunho_evolucao_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rascunho_evolucao" ADD CONSTRAINT "rascunho_evolucao_atendimento_id_fkey" FOREIGN KEY ("atendimento_id") REFERENCES "atendimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Evolução não se edita nem se exclui (spec prontuario, "Retificação
-- versionada"). A API não tem rota para isso; o gatilho garante a regra também
-- para quem chega ao banco por fora dela. A única alteração aceita é a que a
-- retificação faz: encerrar a versão vigente, sem tocar em mais nada.
--
-- TRUNCATE fica de fora de propósito, diferente da auditoria: `evolucao`
-- depende de `paciente`, e o `TRUNCATE paciente CASCADE` que isola os testes
-- de integração precisa alcançá-la. TRUNCATE é ato administrativo explícito;
-- nenhum caminho da aplicação o emite.
CREATE FUNCTION evolucao_imutavel() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.vigente AND NOT NEW.vigente
     AND (to_jsonb(NEW) - 'vigente') = (to_jsonb(OLD) - 'vigente') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'evolucao é imutável: % recusado', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER evolucao_sem_alteracao
  BEFORE UPDATE OR DELETE ON "evolucao"
  FOR EACH ROW EXECUTE FUNCTION evolucao_imutavel();
