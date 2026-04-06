-- Script para criar a tabela notification_settings no MySQL
-- Cole este script no MySQL Workbench e execute

CREATE TABLE IF NOT EXISTS `notification_settings` (
  `id` INT NOT NULL AUTO_INCREMENT,
  
  -- Configurações de tipos de notificação (habilitadas/desabilitadas)
  `chamado_enabled` BOOLEAN NOT NULL DEFAULT TRUE,
  `sistema_enabled` BOOLEAN NOT NULL DEFAULT TRUE,
  `alerta_enabled` BOOLEAN NOT NULL DEFAULT TRUE,
  `erro_enabled` BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Configurações de som
  `som_habilitado` BOOLEAN NOT NULL DEFAULT TRUE,
  `som_tipo` VARCHAR(50) NOT NULL DEFAULT 'notificacao',
  
  -- Configurações de exibição
  `estilo_exibicao` VARCHAR(50) NOT NULL DEFAULT 'toast',
  `posicao` VARCHAR(50) NOT NULL DEFAULT 'top-right',
  `duracao` INT NOT NULL DEFAULT 5,
  
  -- Configurações de layout
  `tamanho` VARCHAR(50) NOT NULL DEFAULT 'medio',
  `mostrar_icone` BOOLEAN NOT NULL DEFAULT TRUE,
  `mostrar_acao` BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Metadata
  `criado_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `atualizado_em` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Índice para otimizar buscas
CREATE INDEX `idx_notification_settings_atualizado` ON `notification_settings` (`atualizado_em`);

-- Inserir a configuração padrão (se não existir)
INSERT IGNORE INTO `notification_settings` (
  `id`,
  `chamado_enabled`,
  `sistema_enabled`,
  `alerta_enabled`,
  `erro_enabled`,
  `som_habilitado`,
  `som_tipo`,
  `estilo_exibicao`,
  `posicao`,
  `duracao`,
  `tamanho`,
  `mostrar_icone`,
  `mostrar_acao`,
  `criado_em`,
  `atualizado_em`
) VALUES (
  1,
  TRUE,
  TRUE,
  TRUE,
  TRUE,
  TRUE,
  'notificacao',
  'toast',
  'top-right',
  5,
  'medio',
  TRUE,
  TRUE,
  NOW(),
  NOW()
);

-- Verificar se a tabela foi criada com sucesso
SELECT * FROM `notification_settings`;
