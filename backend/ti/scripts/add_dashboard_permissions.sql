-- Script SQL para adicionar suporte a permissões na tabela powerbi_dashboard
-- Executar no banco de dados 'infra'

-- =============================================================================
-- OPÇÃO 1: Adicionar colunas de permissões (JSON)
-- =============================================================================

-- Coluna JSON para armazenar permissões
-- Formato esperado:
-- {
--   "roles": ["Administrador", "Gestor", "Funcionário"],
--   "users": [1, 2, 3],
--   "public": false
-- }
ALTER TABLE powerbi_dashboard 
ADD COLUMN permissoes JSON DEFAULT NULL COMMENT 'Armazena permissões de acesso (roles e users)';

-- Coluna para rastrear última atualização de permissões
ALTER TABLE powerbi_dashboard 
ADD COLUMN permissoes_atualizadas_em DATETIME DEFAULT CURRENT_TIMESTAMP 
ON UPDATE CURRENT_TIMESTAMP COMMENT 'Última atualização das permissões';

-- Índice para melhorar performance
ALTER TABLE powerbi_dashboard 
ADD KEY idx_category (category),
ADD KEY idx_permissoes_updated (permissoes_atualizadas_em);

-- =============================================================================
-- OPÇÃO 2: Criar tabela separada de permissões (mais estruturado)
-- =============================================================================

CREATE TABLE IF NOT EXISTS dashboard_permission (
    id INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID único',
    dashboard_id VARCHAR(100) NOT NULL COMMENT 'ID do dashboard',
    permission_type ENUM('role', 'user', 'public') NOT NULL COMMENT 'Tipo: role, user ou público',
    permission_value VARCHAR(255) NOT NULL COMMENT 'Valor: nome da role, ID do usuário ou vazio para público',
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Data de criação',
    FOREIGN KEY (dashboard_id) REFERENCES powerbi_dashboard(dashboard_id) ON DELETE CASCADE,
    UNIQUE KEY unique_permission (dashboard_id, permission_type, permission_value),
    KEY idx_dashboard (dashboard_id),
    KEY idx_type (permission_type),
    KEY idx_value (permission_value)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Tabela de permissões granulares de dashboards';

-- =============================================================================
-- Exemplo: Inicializar alguns dashboards com permissões básicas
-- =============================================================================

-- Para usar OPÇÃO 1 (JSON):
UPDATE powerbi_dashboard 
SET permissoes = JSON_OBJECT(
    'roles', JSON_ARRAY('Administrador'),
    'users', JSON_ARRAY(),
    'public', false
)
WHERE permissoes IS NULL;

-- Para usar OPÇÃO 2 (Tabela):
-- INSERT INTO dashboard_permission (dashboard_id, permission_type, permission_value)
-- SELECT dashboard_id, 'role', 'Administrador' FROM powerbi_dashboard;

-- =============================================================================
-- Verificar estrutura final
-- =============================================================================

-- Ver colunas adicionadas:
-- SHOW COLUMNS FROM powerbi_dashboard;

-- Ver dados de permissões (OPÇÃO 1):
-- SELECT id, title, permissoes, permissoes_atualizadas_em FROM powerbi_dashboard LIMIT 5;

-- Ver tabela de permissões (OPÇÃO 2):
-- SELECT * FROM dashboard_permission LIMIT 5;
