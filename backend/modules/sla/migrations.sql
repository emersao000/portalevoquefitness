-- =============================================
-- MIGRATIONS PARA O SISTEMA SLA
-- =============================================

-- 1. Criar tabela de configuração SLA
CREATE TABLE IF NOT EXISTS `sla_configuration` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `prioridade` VARCHAR(50) NOT NULL UNIQUE,
    `tempo_resposta_horas` FLOAT NOT NULL,
    `tempo_resolucao_horas` FLOAT NOT NULL,
    `descricao` TEXT,
    `ativo` TINYINT(1) DEFAULT 1,
    `criado_em` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `atualizado_em` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    `ultimo_reset_em` DATETIME NULL,
    INDEX `idx_prioridade` (`prioridade`),
    INDEX `idx_ativo` (`ativo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Criar tabela de feriados
CREATE TABLE IF NOT EXISTS `sla_feriados` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `data` DATETIME NOT NULL UNIQUE,
    `nome` VARCHAR(100) NOT NULL,
    `descricao` TEXT,
    `ativo` TINYINT(1) DEFAULT 1,
    `criado_em` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `atualizado_em` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_data` (`data`),
    INDEX `idx_ativo` (`ativo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Criar tabela de horário comercial
CREATE TABLE IF NOT EXISTS `sla_business_hours` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `dia_semana` INT NOT NULL,
    `hora_inicio` VARCHAR(5) NOT NULL DEFAULT '08:00',
    `hora_fim` VARCHAR(5) NOT NULL DEFAULT '18:00',
    `ativo` TINYINT(1) DEFAULT 1,
    INDEX `idx_dia_semana` (`dia_semana`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Criar tabela de pausas SLA
CREATE TABLE IF NOT EXISTS `sla_pausas` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `chamado_id` INT NOT NULL,
    `pausado_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `retomado_em` DATETIME NULL,
    `motivo` VARCHAR(100) DEFAULT 'Em análise',
    `duracao_minutos` INT NULL,
    `ativa` TINYINT(1) DEFAULT 1,
    `criado_por_id` INT NULL,
    `criado_em` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `atualizado_em` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_sla_pausa_chamado` (`chamado_id`),
    INDEX `idx_sla_pausa_ativa` (`chamado_id`, `ativa`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Criar tabela de logs de cálculo SLA
CREATE TABLE IF NOT EXISTS `sla_calculation_log` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `calculation_type` VARCHAR(50) NOT NULL,
    `last_calculated_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `last_calculated_chamado_id` INT NULL,
    `chamados_count` INT DEFAULT 0,
    `chamados_em_risco` INT DEFAULT 0,
    `chamados_vencidos` INT DEFAULT 0,
    `chamados_pausados` INT DEFAULT 0,
    `execution_time_ms` FLOAT NULL,
    `success` TINYINT(1) DEFAULT 1,
    `error_message` TEXT NULL,
    INDEX `idx_tipo` (`calculation_type`),
    INDEX `idx_data` (`last_calculated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Adicionar campos de SLA na tabela chamado
ALTER TABLE `chamado` ADD COLUMN IF NOT EXISTS `sla_em_risco` TINYINT(1) DEFAULT 0;
ALTER TABLE `chamado` ADD COLUMN IF NOT EXISTS `sla_vencido` TINYINT(1) DEFAULT 0;
ALTER TABLE `chamado` ADD COLUMN IF NOT EXISTS `sla_tempo_decorrido_horas` FLOAT DEFAULT 0;
ALTER TABLE `chamado` ADD COLUMN IF NOT EXISTS `sla_tempo_pausado_horas` FLOAT DEFAULT 0;
ALTER TABLE `chamado` ADD COLUMN IF NOT EXISTS `sla_percentual_consumido` FLOAT DEFAULT 0;
ALTER TABLE `chamado` ADD COLUMN IF NOT EXISTS `sla_atualizado_em` DATETIME NULL;
ALTER TABLE `chamado` ADD COLUMN IF NOT EXISTS `sla_ultimo_escalonamento` DATETIME NULL;

-- 7. Criar índices de performance
CREATE INDEX IF NOT EXISTS `idx_chamado_data_abertura` ON `chamado`(`data_abertura`);
CREATE INDEX IF NOT EXISTS `idx_chamado_status` ON `chamado`(`status`);
CREATE INDEX IF NOT EXISTS `idx_chamado_prioridade` ON `chamado`(`prioridade`);
CREATE INDEX IF NOT EXISTS `idx_chamado_sla_risco` ON `chamado`(`sla_em_risco`);
CREATE INDEX IF NOT EXISTS `idx_chamado_sla_vencido` ON `chamado`(`sla_vencido`);

-- 8. Inserir configurações padrão
INSERT IGNORE INTO `sla_configuration` 
    (`prioridade`, `tempo_resposta_horas`, `tempo_resolucao_horas`, `descricao`, `ativo`)
VALUES 
    ('alta', 2, 8, 'Prioridade alta - resposta em 2h, resolução em 8h', 1),
    ('media', 4, 24, 'Prioridade média - resposta em 4h, resolução em 24h', 1),
    ('baixa', 8, 48, 'Prioridade baixa - resposta em 8h, resolução em 48h', 1);

-- 9. Inserir horário comercial padrão
INSERT IGNORE INTO `sla_business_hours` 
    (`dia_semana`, `hora_inicio`, `hora_fim`, `ativo`)
VALUES 
    (0, '08:00', '18:00', 1),
    (1, '08:00', '18:00', 1),
    (2, '08:00', '18:00', 1),
    (3, '08:00', '18:00', 1),
    (4, '08:00', '18:00', 1);
