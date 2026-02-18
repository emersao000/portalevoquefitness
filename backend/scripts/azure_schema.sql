-- ============================================
-- Evoque Fitness - Azure Database for MySQL
-- Script para criar schema completo
-- ============================================

-- Criar database (se não existir)
CREATE DATABASE IF NOT EXISTS evoque_fitness CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE evoque_fitness;

-- ============================================
-- Tabelas Base
-- ============================================

-- Tabela: user
CREATE TABLE IF NOT EXISTS `user` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nome` VARCHAR(150) NOT NULL,
  `sobrenome` VARCHAR(150) NOT NULL,
  `usuario` VARCHAR(80) NOT NULL UNIQUE,
  `email` VARCHAR(120) NOT NULL UNIQUE,
  `senha_hash` VARCHAR(128) NOT NULL,
  `alterar_senha_primeiro_acesso` TINYINT(1) DEFAULT 0,
  `nivel_acesso` VARCHAR(50) NOT NULL,
  `setor` VARCHAR(255) NULL,
  `_setores` LONGTEXT NULL COMMENT 'JSON array de setores',
  `bloqueado` TINYINT(1) DEFAULT 0,
  `data_criacao` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `ultimo_acesso` DATETIME NULL,
  `tentativas_login` INT DEFAULT 0,
  `bloqueado_ate` DATETIME NULL,
  `session_revoked_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `usuario` (`usuario`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_nivel_acesso` (`nivel_acesso`),
  KEY `idx_bloqueado` (`bloqueado`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela: unidade
CREATE TABLE IF NOT EXISTS `unidade` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nome` VARCHAR(120) NOT NULL UNIQUE,
  `cidade` VARCHAR(120) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nome` (`nome`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela: problema
CREATE TABLE IF NOT EXISTS `problema` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nome` VARCHAR(120) NOT NULL UNIQUE,
  `descricao` TEXT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nome` (`nome`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela: chamado
CREATE TABLE IF NOT EXISTS `chamado` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `codigo` VARCHAR(20) NOT NULL UNIQUE,
  `protocolo` VARCHAR(20) NOT NULL UNIQUE,
  `solicitante` VARCHAR(100) NOT NULL,
  `cargo` VARCHAR(100) NOT NULL,
  `email` VARCHAR(120) NOT NULL,
  `telefone` VARCHAR(20) NOT NULL,
  `unidade` VARCHAR(100) NOT NULL,
  `problema` VARCHAR(100) NOT NULL,
  `internet_item` VARCHAR(50) NULL,
  `descricao` LONGTEXT NULL,
  `data_visita` DATE NULL,
  `data_abertura` DATETIME NULL,
  `data_primeira_resposta` DATETIME NULL,
  `data_conclusao` DATETIME NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'Aberto',
  `prioridade` VARCHAR(20) NOT NULL DEFAULT 'Normal',
  `status_assumido_por_id` INT NULL,
  `status_assumido_em` DATETIME NULL,
  `concluido_por_id` INT NULL,
  `concluido_em` DATETIME NULL,
  `cancelado_por_id` INT NULL,
  `cancelado_em` DATETIME NULL,
  `usuario_id` INT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `codigo` (`codigo`),
  UNIQUE KEY `protocolo` (`protocolo`),
  KEY `status_assumido_por_id` (`status_assumido_por_id`),
  KEY `concluido_por_id` (`concluido_por_id`),
  KEY `cancelado_por_id` (`cancelado_por_id`),
  KEY `usuario_id` (`usuario_id`),
  KEY `idx_status` (`status`),
  KEY `idx_prioridade` (`prioridade`),
  KEY `idx_data_abertura` (`data_abertura`),
  CONSTRAINT `chamado_ibfk_1` FOREIGN KEY (`status_assumido_por_id`) REFERENCES `user` (`id`),
  CONSTRAINT `chamado_ibfk_2` FOREIGN KEY (`concluido_por_id`) REFERENCES `user` (`id`),
  CONSTRAINT `chamado_ibfk_3` FOREIGN KEY (`cancelado_por_id`) REFERENCES `user` (`id`),
  CONSTRAINT `chamado_ibfk_4` FOREIGN KEY (`usuario_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela: chamado_anexo
CREATE TABLE IF NOT EXISTS `chamado_anexo` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `chamado_id` INT NOT NULL,
  `arquivo_blob` LONGBLOB NOT NULL,
  `mime_type` VARCHAR(100) NOT NULL,
  `tamanho_bytes` INT NULL,
  `titulo` VARCHAR(255) NULL,
  `descricao` TEXT NULL,
  `data_upload` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `chamado_id` (`chamado_id`),
  CONSTRAINT `chamado_anexo_ibfk_1` FOREIGN KEY (`chamado_id`) REFERENCES `chamado` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela: historico_status
CREATE TABLE IF NOT EXISTS `historico_status` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `chamado_id` INT NOT NULL,
  `status` VARCHAR(50) NOT NULL,
  `data_inicio` DATETIME NULL,
  `data_fim` DATETIME NULL,
  `usuario_id` INT NULL,
  `descricao` TEXT NULL,
  `created_at` DATETIME NULL,
  `updated_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  KEY `chamado_id` (`chamado_id`),
  KEY `usuario_id` (`usuario_id`),
  KEY `status` (`status`),
  CONSTRAINT `historico_status_ibfk_1` FOREIGN KEY (`chamado_id`) REFERENCES `chamado` (`id`) ON DELETE CASCADE,
  CONSTRAINT `historico_status_ibfk_2` FOREIGN KEY (`usuario_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela: historico_ticket
CREATE TABLE IF NOT EXISTS `historico_ticket` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `chamado_id` INT NOT NULL,
  `campo` VARCHAR(100) NOT NULL,
  `valor_anterior` LONGTEXT NULL,
  `valor_novo` LONGTEXT NULL,
  `usuario_id` INT NULL,
  `data_mudanca` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `chamado_id` (`chamado_id`),
  KEY `usuario_id` (`usuario_id`),
  CONSTRAINT `historico_ticket_ibfk_1` FOREIGN KEY (`chamado_id`) REFERENCES `chamado` (`id`) ON DELETE CASCADE,
  CONSTRAINT `historico_ticket_ibfk_2` FOREIGN KEY (`usuario_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela: historico_anexo
CREATE TABLE IF NOT EXISTS `historico_anexo` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `chamado_id` INT NOT NULL,
  `arquivo_blob` LONGBLOB NOT NULL,
  `mime_type` VARCHAR(100) NOT NULL,
  `tamanho_bytes` INT NULL,
  `titulo` VARCHAR(255) NULL,
  `descricao` TEXT NULL,
  `data_upload` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `usuario_id` INT NULL,
  PRIMARY KEY (`id`),
  KEY `chamado_id` (`chamado_id`),
  KEY `usuario_id` (`usuario_id`),
  CONSTRAINT `historico_anexo_ibfk_1` FOREIGN KEY (`chamado_id`) REFERENCES `chamado` (`id`) ON DELETE CASCADE,
  CONSTRAINT `historico_anexo_ibfk_2` FOREIGN KEY (`usuario_id`) REFERENCES `user` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela: media (para login backgrounds/videos)
CREATE TABLE IF NOT EXISTS `media` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `tipo` VARCHAR(20) NOT NULL COMMENT 'foto ou video',
  `titulo` VARCHAR(255) NOT NULL,
  `descricao` TEXT NULL,
  `arquivo_blob` LONGBLOB NOT NULL,
  `mime_type` VARCHAR(100) NOT NULL,
  `tamanho_bytes` INT NULL,
  `url` VARCHAR(500) NULL,
  `status` VARCHAR(20) DEFAULT 'ativo' COMMENT 'ativo ou inativo',
  `data_criacao` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_tipo` (`tipo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela: notification
CREATE TABLE IF NOT EXISTS `notification` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `titulo` VARCHAR(255) NOT NULL,
  `descricao` TEXT NULL,
  `tipo` VARCHAR(50) NULL,
  `status` VARCHAR(20) DEFAULT 'ativa',
  `data_criacao` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela: alert
CREATE TABLE IF NOT EXISTS `alert` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `titulo` VARCHAR(255) NOT NULL,
  `descricao` TEXT NULL,
  `tipo` VARCHAR(50) NULL,
  `prioridade` VARCHAR(20) DEFAULT 'Normal',
  `status` VARCHAR(20) DEFAULT 'ativa',
  `data_criacao` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `data_resolvido` DATETIME NULL,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_prioridade` (`prioridade`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela: powerbi_dashboard
CREATE TABLE IF NOT EXISTS `powerbi_dashboard` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nome` VARCHAR(255) NOT NULL,
  `url` VARCHAR(1000) NOT NULL,
  `workspace_id` VARCHAR(100) NULL,
  `report_id` VARCHAR(100) NULL,
  `status` VARCHAR(20) DEFAULT 'ativo',
  `data_criacao` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela: sla_config
CREATE TABLE IF NOT EXISTS `sla_config` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `nivel_acesso` VARCHAR(50) NOT NULL,
  `problema` VARCHAR(100) NOT NULL,
  `tempo_resposta_minutos` INT NOT NULL COMMENT 'Tempo SLA para primeira resposta',
  `tempo_conclusao_minutos` INT NOT NULL COMMENT 'Tempo SLA para conclusão',
  `status` VARCHAR(20) DEFAULT 'ativo',
  `data_criacao` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `sla_unique` (`nivel_acesso`, `problema`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabela: ticket_anexo
CREATE TABLE IF NOT EXISTS `ticket_anexo` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `titulo` VARCHAR(255) NULL,
  `descricao` TEXT NULL,
  `arquivo_blob` LONGBLOB NOT NULL,
  `mime_type` VARCHAR(100) NOT NULL,
  `tamanho_bytes` INT NULL,
  `data_upload` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- Índices adicionais para performance
-- ============================================

ALTER TABLE `user` ADD INDEX idx_email (`email`);
ALTER TABLE `user` ADD INDEX idx_usuario (`usuario`);
ALTER TABLE `unidade` ADD INDEX idx_nome (`nome`);
ALTER TABLE `chamado` ADD INDEX idx_codigo_protocolo (`codigo`, `protocolo`);

-- ============================================
-- Dados iniciais de exemplo (opcional)
-- ============================================

-- Usuário Admin (senha hash é: admin123 com Werkzeug)
INSERT IGNORE INTO `user` (
  `nome`, `sobrenome`, `usuario`, `email`, `senha_hash`,
  `nivel_acesso`, `setor`, `bloqueado`, `data_criacao`
) VALUES (
  'Admin', 'Sistema', 'admin', 'admin@evoque.com',
  'scrypt:32768:8:1$xyz123...', -- Gere com: python -c "from werkzeug.security import generate_password_hash; print(generate_password_hash('admin123'))"
  'admin', 'TI', 0, NOW()
);

-- Unidades padrão
INSERT IGNORE INTO `unidade` (`nome`, `cidade`) VALUES
('Matriz', 'São Paulo'),
('Filial Sul', 'Curitiba'),
('Filial Norte', 'Brasília');

-- Problemas padrão
INSERT IGNORE INTO `problema` (`nome`, `descricao`) VALUES
('Acesso ao Sistema', 'Problemas de login ou acesso'),
('Conexão Internet', 'Problemas de conectividade'),
('Email', 'Problemas com e-mail'),
('Hardware', 'Problemas com equipamentos'),
('Relatórios', 'Problemas com relatórios e consultas');

-- ============================================
-- IMPORTANTE: Próximos passos
-- ============================================

-- 1. Gere um hash de senha real:
--    python -c "from werkzeug.security import generate_password_hash; print(generate_password_hash('sua_senha_aqui'))"
--
-- 2. Atualize a senha do admin com o hash gerado:
--    UPDATE `user` SET `senha_hash` = 'hash_gerado_acima' WHERE `usuario` = 'admin';
--
-- 3. Teste a conexão do backend com:
--    curl http://localhost:8000/api/ping
--
-- 4. Para população em massa, use os endpoints:
--    POST /api/usuarios (criar usuário)
--    POST /api/unidades (criar unidade)
--    POST /api/problemas (criar problema)
