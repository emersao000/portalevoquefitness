-- ============================================================
-- Migração: Corrige timestamps UTC em historico_status
-- Contexto: Registros antigos foram gravados em UTC em vez de
--           horário de Brasília (UTC-3). Subtraímos 3 horas
--           para normalizar tudo para UTC-3.
--
-- Execute este script UMA VEZ no banco de produção.
-- Afeta apenas registros com descricao LIKE 'Mudança automática%'
-- que provavelmente foram gerados por código legado em UTC.
-- ============================================================

-- Preview: veja quantos registros serão afetados
SELECT
  COUNT(*) AS total_afetados,
  MIN(created_at) AS mais_antigo,
  MAX(created_at) AS mais_recente
FROM historico_status
WHERE descricao LIKE 'Mudança automática%';

-- Aplica a correção: subtrai 3 horas (UTC → UTC-3 / Brasília)
UPDATE historico_status
SET
  created_at  = created_at  - INTERVAL '3 hours',
  updated_at  = updated_at  - INTERVAL '3 hours',
  data_inicio = data_inicio - INTERVAL '3 hours'
WHERE descricao LIKE 'Mudança automática%';

-- Confirme o resultado
SELECT id, descricao, created_at
FROM historico_status
WHERE descricao LIKE 'Mudança automática%'
ORDER BY created_at DESC
LIMIT 20;
