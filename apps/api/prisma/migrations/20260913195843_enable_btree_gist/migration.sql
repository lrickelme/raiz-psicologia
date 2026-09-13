-- Habilita btree_gist: pré-requisito para a constraint EXCLUDE USING gist
-- que vai impedir sobreposição de horário na tabela de atendimento (change
-- 01-fundacao, seção 6 — Agenda). Ver design.md, "Sobreposição validada no banco".
CREATE EXTENSION IF NOT EXISTS btree_gist;
