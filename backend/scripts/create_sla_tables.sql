-- =====================================================================
-- SCRIPT DE CRIAÇÃO DAS TABELAS DE SLA
-- =====================================================================
-- Este script cria todas as tabelas necessárias para o sistema de SLA
-- Copie e execute no MySQL Workbench
-- =====================================================================

-- =====================================================================
-- 1. TABELA sla_configuration
-- =====================================================================
CREATE TABLE IF NOT EXISTS `sla_configuration` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID da configuração',
    `prioridade` VARCHAR(50) NOT NULL UNIQUE COMMENT 'Nível de prioridade (Crítica, Urgente, Alta, Normal)',
    `tempo_resposta_horas` FLOAT NOT NULL COMMENT 'Tempo máximo para primeira resposta em horas',
    `tempo_resolucao_horas` FLOAT NOT NULL COMMENT 'Tempo máximo para resolução total em horas',
    `descricao` TEXT NULL COMMENT 'Descrição da configuração',
    `ativo` BOOLEAN DEFAULT TRUE COMMENT 'Indica se a configuração está ativa',
    `criado_em` DATETIME NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Data de criação',
    `atualizado_em` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Data da última atualização',
    INDEX `idx_prioridade` (`prioridade`),
    INDEX `idx_ativo` (`ativo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Configuração de SLA por nível de prioridade';

-- =====================================================================
-- 2. TABELA sla_business_hours
-- =====================================================================
CREATE TABLE IF NOT EXISTS `sla_business_hours` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID do horário',
    `dia_semana` INT NOT NULL COMMENT 'Dia da semana (0=Seg, 1=Ter, 2=Qua, 3=Qui, 4=Sex)',
    `hora_inicio` VARCHAR(5) NOT NULL COMMENT 'Hora de início no formato HH:MM',
    `hora_fim` VARCHAR(5) NOT NULL COMMENT 'Hora de fim no formato HH:MM',
    `ativo` BOOLEAN DEFAULT TRUE COMMENT 'Indica se o horário está ativo',
    `criado_em` DATETIME NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Data de criação',
    `atualizado_em` DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Data da última atualização',
    UNIQUE KEY `uq_dia_semana` (`dia_semana`),
    INDEX `idx_ativo` (`ativo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Horário comercial para cálculo de SLA por dia da semana';

-- =====================================================================
-- 3. TABELA historico_sla
-- =====================================================================
CREATE TABLE IF NOT EXISTS `historico_sla` (
    `id` INT AUTO_INCREMENT PRIMARY KEY COMMENT 'ID do histórico',
    `chamado_id` INT NOT NULL COMMENT 'ID do chamado relacionado',
    `usuario_id` INT NULL COMMENT 'ID do usuário que causou a mudança de SLA',
    `acao` VARCHAR(100) NOT NULL COMMENT 'Ação realizada (ex: sincronizacao_inicial, mudanca_status, recalculo_painel)',
    `status_anterior` VARCHAR(50) NULL COMMENT 'Status anterior do chamado',
    `status_novo` VARCHAR(50) NULL COMMENT 'Status novo do chamado',
    `data_conclusao_anterior` DATETIME NULL COMMENT 'Data de conclusão anterior',
    `data_conclusao_nova` DATETIME NULL COMMENT 'Data de conclusão nova',
    `tempo_resolucao_horas` FLOAT NULL COMMENT 'Tempo de resolução em horas',
    `limite_sla_horas` FLOAT NULL COMMENT 'Limite de SLA em horas',
    `status_sla` VARCHAR(50) NULL COMMENT 'Status do SLA (ok, atencao, vencido, sem_configuracao)',
    `criado_em` DATETIME NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Data de criação do registro',
    INDEX `idx_chamado_id` (`chamado_id`),
    INDEX `idx_usuario_id` (`usuario_id`),
    INDEX `idx_status_sla` (`status_sla`),
    INDEX `idx_criado_em` (`criado_em`),
    INDEX `idx_acao` (`acao`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Histórico de mudanças de SLA dos chamados';

-- =====================================================================
-- 4. INSERIR VALORES PADRÃO DE CONFIGURAÇÃO DE SLA
-- =====================================================================
INSERT INTO `sla_configuration` (
    `prioridade`, 
    `tempo_resposta_horas`, 
    `tempo_resolucao_horas`, 
    `descricao`,
    `ativo`
) VALUES
(
    'Crítica',
    1,
    4,
    'Problemas críticos que afetam a produção ou múltiplos usuários',
    TRUE
),
(
    'Urgente',
    2,
    8,
    'Problemas que afetam a funcionalidade principal',
    TRUE
),
(
    'Alta',
    4,
    24,
    'Problemas que afetam uma funcionalidade específica',
    TRUE
),
(
    'Normal',
    8,
    48,
    'Problemas menores ou dúvidas',
    TRUE
) ON DUPLICATE KEY UPDATE
    `tempo_resposta_horas` = VALUES(`tempo_resposta_horas`),
    `tempo_resolucao_horas` = VALUES(`tempo_resolucao_horas`),
    `descricao` = VALUES(`descricao`),
    `ativo` = VALUES(`ativo`);

-- =====================================================================
-- 5. INSERIR HORÁRIO COMERCIAL PADRÃO
-- =====================================================================
INSERT INTO `sla_business_hours` (
    `dia_semana`,
    `hora_inicio`,
    `hora_fim`,
    `ativo`
) VALUES
(0, '08:00', '18:00', TRUE),  -- Segunda-feira
(1, '08:00', '18:00', TRUE),  -- Terça-feira
(2, '08:00', '18:00', TRUE),  -- Quarta-feira
(3, '08:00', '18:00', TRUE),  -- Quinta-feira
(4, '08:00', '18:00', TRUE)   -- Sexta-feira
ON DUPLICATE KEY UPDATE
    `hora_inicio` = VALUES(`hora_inicio`),
    `hora_fim` = VALUES(`hora_fim`),
    `ativo` = VALUES(`ativo`);

-- =====================================================================
-- 6. VERIFICAR SE COLUNAS EXISTEM NA TABELA CHAMADO
-- =====================================================================
-- As seguintes colunas já devem existir na tabela chamado:
-- - data_abertura (DATETIME) - Data de abertura do chamado
-- - data_primeira_resposta (DATETIME) - Data da primeira resposta
-- - data_conclusao (DATETIME) - Data de conclusão
-- - sla_em_risco (BOOLEAN ou INT) - Flag indicando SLA em risco
-- - sla_vencido (BOOLEAN ou INT) - Flag indicando SLA vencido
-- - prioridade (VARCHAR) - Nível de prioridade do chamado

-- Se alguma coluna não existir, descomente e execute:
-- ALTER TABLE `chamado` ADD COLUMN `data_primeira_resposta` DATETIME NULL AFTER `data_abertura`;
-- ALTER TABLE `chamado` ADD COLUMN `sla_em_risco` BOOLEAN DEFAULT FALSE AFTER `data_conclusao`;
-- ALTER TABLE `chamado` ADD COLUMN `sla_vencido` BOOLEAN DEFAULT FALSE AFTER `sla_em_risco`;

-- =====================================================================
-- 7. CRIAR ÍNDICES ÚTEIS NA TABELA CHAMADO
-- =====================================================================
ALTER TABLE `chamado` ADD INDEX IF NOT EXISTS `idx_data_abertura` (`data_abertura`);
ALTER TABLE `chamado` ADD INDEX IF NOT EXISTS `idx_data_primeira_resposta` (`data_primeira_resposta`);
ALTER TABLE `chamado` ADD INDEX IF NOT EXISTS `idx_data_conclusao` (`data_conclusao`);
ALTER TABLE `chamado` ADD INDEX IF NOT EXISTS `idx_sla_em_risco` (`sla_em_risco`);
ALTER TABLE `chamado` ADD INDEX IF NOT EXISTS `idx_sla_vencido` (`sla_vencido`);
ALTER TABLE `chamado` ADD INDEX IF NOT EXISTS `idx_prioridade` (`prioridade`);
ALTER TABLE `chamado` ADD INDEX IF NOT EXISTS `idx_status` (`status`);

-- =====================================================================
-- 8. CRIAR TRIGGER PARA ATUALIZAR data_primeira_resposta
-- =====================================================================
-- Este trigger atualiza a data de primeira resposta quando o status muda para um status de resposta
DELIMITER $$

CREATE TRIGGER IF NOT EXISTS `tr_set_primeira_resposta` 
BEFORE UPDATE ON `chamado`
FOR EACH ROW
BEGIN
    -- Se data_primeira_resposta ainda não foi preenchida e o novo status é de resposta
    IF NEW.data_primeira_resposta IS NULL 
       AND OLD.status IN ('Aberto', 'Cancelado') 
       AND NEW.status IN ('Em Atendimento', 'Em análise', 'Em andamento')
    THEN
        SET NEW.data_primeira_resposta = NOW();
    END IF;
END$$

DELIMITER ;

-- =====================================================================
-- 9. CRIAR STORED PROCEDURE PARA RECALCULAR SLA DE TODOS OS CHAMADOS
-- =====================================================================
DELIMITER $$

CREATE PROCEDURE IF NOT EXISTS `sp_recalcular_sla_todos_chamados`()
BEGIN
    DECLARE v_chamado_id INT;
    DECLARE v_done INT DEFAULT FALSE;
    DECLARE chamados_cursor CURSOR FOR 
        SELECT id FROM chamado WHERE status NOT IN ('Cancelado', 'Concluído', 'Concluido');
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = TRUE;

    OPEN chamados_cursor;
    
    read_loop: LOOP
        FETCH chamados_cursor INTO v_chamado_id;
        IF v_done THEN
            LEAVE read_loop;
        END IF;
        
        -- Chamar stored procedure para atualizar um chamado específico
        CALL sp_atualizar_flags_sla(v_chamado_id);
    END LOOP;
    
    CLOSE chamados_cursor;
    
    SELECT CONCAT('SLA de ', ROW_COUNT(), ' chamados foi recalculado') AS resultado;
END$$

DELIMITER ;

-- =====================================================================
-- 10. CRIAR STORED PROCEDURE PARA ATUALIZAR FLAGS DE SLA
-- =====================================================================
DELIMITER $$

CREATE PROCEDURE IF NOT EXISTS `sp_atualizar_flags_sla`(IN p_chamado_id INT)
BEGIN
    DECLARE v_prioridade VARCHAR(50);
    DECLARE v_tempo_resposta_horas FLOAT;
    DECLARE v_tempo_resolucao_horas FLOAT;
    DECLARE v_tempo_resposta_decorrido FLOAT;
    DECLARE v_tempo_resolucao_decorrido FLOAT;
    DECLARE v_data_abertura DATETIME;
    DECLARE v_data_primeira_resposta DATETIME;
    DECLARE v_data_conclusao DATETIME;
    DECLARE v_agora DATETIME;
    DECLARE v_sla_em_risco BOOLEAN DEFAULT FALSE;
    DECLARE v_sla_vencido BOOLEAN DEFAULT FALSE;

    -- Buscar dados do chamado
    SELECT prioridade, data_abertura, data_primeira_resposta, data_conclusao, status
    INTO v_prioridade, v_data_abertura, v_data_primeira_resposta, v_data_conclusao, @status
    FROM chamado
    WHERE id = p_chamado_id;

    -- Se o chamado não existe, sair
    IF v_prioridade IS NULL THEN
        LEAVE;
    END IF;

    -- Buscar configuração de SLA
    SELECT tempo_resposta_horas, tempo_resolucao_horas
    INTO v_tempo_resposta_horas, v_tempo_resolucao_horas
    FROM sla_configuration
    WHERE prioridade = v_prioridade AND ativo = TRUE
    LIMIT 1;

    -- Se não encontrar configuração, usar padrão
    IF v_tempo_resposta_horas IS NULL THEN
        CASE v_prioridade
            WHEN 'Crítica' THEN
                SET v_tempo_resposta_horas = 1, v_tempo_resolucao_horas = 4;
            WHEN 'Urgente' THEN
                SET v_tempo_resposta_horas = 2, v_tempo_resolucao_horas = 8;
            WHEN 'Alta' THEN
                SET v_tempo_resposta_horas = 4, v_tempo_resolucao_horas = 24;
            ELSE
                SET v_tempo_resposta_horas = 8, v_tempo_resolucao_horas = 48;
        END CASE;
    END IF;

    SET v_agora = NOW();

    -- Calcular tempo de resolução
    IF v_data_conclusao IS NOT NULL THEN
        SET v_tempo_resolucao_decorrido = TIMESTAMPDIFF(HOUR, v_data_abertura, v_data_conclusao);
    ELSE
        SET v_tempo_resolucao_decorrido = TIMESTAMPDIFF(HOUR, v_data_abertura, v_agora);
    END IF;

    -- Verificar se vencido
    IF v_tempo_resolucao_decorrido > v_tempo_resolucao_horas THEN
        SET v_sla_vencido = TRUE;
    END IF;

    -- Verificar se em risco (80% do limite)
    IF v_tempo_resolucao_decorrido > (v_tempo_resolucao_horas * 0.8) AND NOT v_sla_vencido THEN
        SET v_sla_em_risco = TRUE;
    END IF;

    -- Atualizar chamado
    UPDATE chamado
    SET sla_em_risco = v_sla_em_risco,
        sla_vencido = v_sla_vencido
    WHERE id = p_chamado_id;
END$$

DELIMITER ;

-- =====================================================================
-- 11. CRIAR ÍNDICES NA TABELA historico_status (se precisar)
-- =====================================================================
ALTER TABLE `historico_status` ADD INDEX IF NOT EXISTS `idx_chamado_id_status` (`chamado_id`, `status`);
ALTER TABLE `historico_status` ADD INDEX IF NOT EXISTS `idx_created_at` (`created_at`);
ALTER TABLE `historico_status` ADD INDEX IF NOT EXISTS `idx_data_inicio` (`data_inicio`);

-- =====================================================================
-- FIM DO SCRIPT DE CRIAÇÃO DE SLA
-- =====================================================================
-- Próximos passos:
-- 1. Executar este script no MySQL Workbench
-- 2. Verificar se todas as tabelas foram criadas com sucesso
-- 3. Executar: CALL sp_recalcular_sla_todos_chamados();
-- 4. Verificar os logs do servidor Flask/Python para erros
-- =====================================================================
