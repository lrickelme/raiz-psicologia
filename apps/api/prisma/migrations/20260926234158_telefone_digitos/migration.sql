-- Telefone só com dígitos (spec pacientes, "Telefone normalizado"; design.md,
-- "Telefone"). Até aqui ele era gravado como digitado.
--
-- Mesma regra de `normalizarTelefone` em packages/shared: tira tudo que não é
-- dígito e descarta o 55 só quando sobram 12 ou 13 dígitos — DDD 55 é número
-- nacional. Sem dígito nenhum vira NULL. O que não fechar 10 ou 11 dígitos
-- fica com os dígitos que tem: apagar perderia dado, completar seria inventar.
-- A API exige a correção na próxima edição do cadastro.
DO $$
DECLARE
  fora_do_padrao integer;
BEGIN
  UPDATE paciente
     SET telefone = CASE
           WHEN d = '' THEN NULL
           WHEN length(d) IN (12, 13) AND d LIKE '55%' THEN substr(d, 3)
           ELSE d
         END
    FROM (SELECT id AS alvo, regexp_replace(telefone, '\D', '', 'g') AS d
            FROM paciente
           WHERE telefone IS NOT NULL) AS normalizado
   WHERE id = normalizado.alvo;

  SELECT count(*) INTO fora_do_padrao
    FROM paciente
   WHERE telefone IS NOT NULL AND length(telefone) NOT IN (10, 11);
  IF fora_do_padrao > 0 THEN
    RAISE NOTICE '% paciente(s) com telefone fora de 10 ou 11 dígitos, mantido(s) para correção na próxima edição', fora_do_padrao;
  END IF;
END;
$$;

-- A quantidade fica fora do CHECK de propósito: os legados acima a violariam.
ALTER TABLE "paciente" ADD CONSTRAINT "paciente_telefone_digitos"
  CHECK (telefone ~ '^[0-9]+$');
