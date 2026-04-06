-- ============================================================
-- SCRIPT: Limpeza de "Mudanca automatica" em historico_status
-- Execute ETAPA 1 primeiro para conferir, depois ETAPA 2
-- ============================================================

-- ETAPA 1: Ver quantos registros serao afetados
SELECT id, chamado_id, status, descricao, created_at
FROM historico_status
WHERE descricao LIKE 'Mudança automática:%'
   OR descricao LIKE 'Mudanca automatica:%'
ORDER BY created_at DESC;

-- ETAPA 2: Deletar registros automaticos (execute apos confirmar ETAPA 1)
DELETE FROM historico_status
WHERE descricao LIKE 'Mudança automática:%'
   OR descricao LIKE 'Mudanca automatica:%';

-- ETAPA 3: Confirmar resultado (deve retornar 0)
SELECT COUNT(*) AS restantes FROM historico_status
WHERE descricao LIKE 'Mudança automática:%'
   OR descricao LIKE 'Mudanca automatica:%';
