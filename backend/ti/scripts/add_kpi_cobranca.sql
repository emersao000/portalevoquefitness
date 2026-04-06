-- ============================================================
-- Adicionar dashboard KPI Cobrança
-- Execute este script no banco de dados para registrar o dashboard
-- ============================================================

INSERT INTO powerbi_dashboard (
    dashboard_id,
    title,
    description,
    report_id,
    dataset_id,
    category,
    category_name,
    "order",
    ativo,
    criado_em,
    atualizado_em,
    permissoes
)
VALUES (
    'kpi-cobranca',
    'KPI Cobrança',
    'Dashboard de indicadores de performance de cobrança',
    '6fb5a5c7-53ea-4661-a8ec-53624dd930f0',
    NULL,
    'financeiro',
    'Financeiro',
    0,
    TRUE,
    NOW(),
    NOW(),
    '{"roles": [], "users": [], "public": false}'
)
ON CONFLICT (dashboard_id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    report_id = EXCLUDED.report_id,
    category = EXCLUDED.category,
    category_name = EXCLUDED.category_name,
    ativo = EXCLUDED.ativo,
    atualizado_em = NOW();
