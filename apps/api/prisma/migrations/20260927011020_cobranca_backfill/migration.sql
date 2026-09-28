-- Cobrabilidade dos atendimentos encerrados antes da change 03 (spec agenda,
-- "Cobrabilidade congelada no encerramento"; design.md, "Backfill a partir da
-- trilha de auditoria").
--
-- O instante do encerramento vem da trilha: o ESCRITA da transição (rota de
-- cancelar, falta, realizar ou remarcar) ou o cancelamento por arquivamento do
-- paciente. `atualizado_em` não serve: qualquer alteração posterior o
-- sobrescreve. A regra é a de `comum/cobranca`, repetida aqui uma única vez
-- para os dados antigos:
--
--   REALIZADO e FALTA  sempre cobráveis
--   REMARCADO          nunca
--   CANCELADO          se cancelado no mesmo dia do início, em São Paulo
--
-- Sem registro na trilha, nada é inventado. Os três primeiros não dependem da
-- data: `cobravel` vem do status e `encerrado_em` fica nulo. CANCELADO fica
-- com `cobravel` nulo — fora da receita — e é listado abaixo para decisão da
-- profissional. Só toca atendimento ainda sem cobrabilidade: reexecutar não
-- muda o que já foi decidido.
DO $$
DECLARE
  sem_trilha text;
  sem_instante integer;
BEGIN
  WITH transicao AS (
    SELECT recurso_id::uuid AS id, min(ocorrido_em) AS em
      FROM auditoria
     WHERE recurso_tipo = 'ATENDIMENTO'
       AND tipo_evento = 'ESCRITA'
       AND (detalhe->>'rota' ~ '^/api/v1/atendimentos/:id/(cancelar|falta|realizar|remarcar)$'
            OR detalhe->>'operacao' = 'cancelamento por arquivamento do paciente')
     GROUP BY recurso_id
  ),
  decidido AS (
    SELECT a.id,
           t.em AS encerrado_em,
           CASE a.status
             WHEN 'REALIZADO' THEN true
             WHEN 'FALTA' THEN true
             WHEN 'REMARCADO' THEN false
             WHEN 'CANCELADO' THEN
               CASE WHEN t.em IS NULL THEN NULL
                    ELSE (t.em AT TIME ZONE 'America/Sao_Paulo')::date
                       = (a.inicio AT TIME ZONE 'America/Sao_Paulo')::date
               END
           END AS cobravel
      FROM atendimento a
      LEFT JOIN transicao t ON t.id = a.id
     WHERE a.status <> 'AGENDADO' AND a.cobravel IS NULL AND a.encerrado_em IS NULL
  )
  UPDATE atendimento a
     SET encerrado_em = d.encerrado_em, cobravel = d.cobravel
    FROM decidido d
   WHERE a.id = d.id;

  SELECT count(*) INTO sem_instante
    FROM atendimento
   WHERE status IN ('REALIZADO', 'FALTA', 'REMARCADO') AND encerrado_em IS NULL;
  IF sem_instante > 0 THEN
    RAISE NOTICE '% atendimento(s) realizado(s), com falta ou remarcado(s) sem registro na trilha: cobrabilidade pelo status, instante do encerramento desconhecido.', sem_instante;
  END IF;

  SELECT string_agg(
           format('  %s  paciente %s  início %s', id, paciente_id,
                  to_char(inicio AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')),
           E'\n' ORDER BY inicio)
    INTO sem_trilha
    FROM atendimento
   WHERE status = 'CANCELADO' AND cobravel IS NULL;
  IF sem_trilha IS NOT NULL THEN
    RAISE NOTICE E'Cancelamentos sem registro na trilha, com cobravel nulo até decisão:\n%', sem_trilha;
  END IF;
END;
$$;
