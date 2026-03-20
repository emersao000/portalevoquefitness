-- ============================================================================
-- SCRIPT: Verificacao e criacao da tabela historicos_tickets
-- Banco: Azure MySQL (MySQL Workbench)
-- Executar no MySQL Workbench conectado ao banco Azure
-- ============================================================================

-- 1. Verificar se a tabela ja existe
SELECT TABLE_NAME, TABLE_ROWS, CREATE_TIME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'historicos_tickets';

-- ============================================================================
-- 2. Criar tabela SE NAO EXISTIR (seguro executar mesmo se ja existir)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `historicos_tickets` (
    `id`            INT           NOT NULL AUTO_INCREMENT,
    `chamado_id`    INT           NOT NULL,
    `usuario_id`    INT           NULL,
    `assunto`       VARCHAR(255)  NOT NULL,
    `mensagem`      LONGTEXT      NOT NULL,
    `destinatarios` VARCHAR(255)  NOT NULL,
    `data_envio`    DATETIME      NULL,
    PRIMARY KEY (`id`),
    INDEX `ix_historicos_tickets_chamado_id` (`chamado_id`),
    CONSTRAINT `fk_historicos_tickets_chamado`
        FOREIGN KEY (`chamado_id`) REFERENCES `chamado` (`id`)
        ON DELETE CASCADE,
    CONSTRAINT `fk_historicos_tickets_usuario`
        FOREIGN KEY (`usuario_id`) REFERENCES `user` (`id`)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 3. Verificar estrutura atual da tabela
-- ============================================================================
DESCRIBE historicos_tickets;

-- ============================================================================
-- 4. Listar tickets registrados (diagnostico)
-- ============================================================================
SELECT
    ht.id,
    ht.chamado_id,
    c.codigo AS chamado_codigo,
    ht.assunto,
    LEFT(ht.mensagem, 120) AS mensagem_preview,
    ht.destinatarios,
    ht.data_envio,
    CONCAT(u.nome, ' ', IFNULL(u.sobrenome,'')) AS nome_autor
FROM historicos_tickets ht
LEFT JOIN chamado c ON c.id = ht.chamado_id
LEFT JOIN user u ON u.id = ht.usuario_id
ORDER BY ht.data_envio DESC
LIMIT 50;

-- ============================================================================
-- 5. Verificar historico_status (para debug de duplicatas)
-- ============================================================================
SELECT
    hs.id,
    hs.chamado_id,
    c.codigo AS chamado_codigo,
    hs.status,
    hs.descricao,
    hs.autor_nome,
    hs.autor_email,
    hs.created_at
FROM historico_status hs
LEFT JOIN chamado c ON c.id = hs.chamado_id
ORDER BY hs.created_at DESC
LIMIT 50;

-- ============================================================================
-- 6. Diagnostico: chamados com multiplos status (possivel duplicata)
-- ============================================================================
SELECT
    hs.chamado_id,
    c.codigo,
    COUNT(*) AS total_registros,
    GROUP_CONCAT(hs.status ORDER BY hs.created_at SEPARATOR ' -> ') AS historico_status
FROM historico_status hs
LEFT JOIN chamado c ON c.id = hs.chamado_id
GROUP BY hs.chamado_id, c.codigo
HAVING COUNT(*) > 1
ORDER BY total_registros DESC
LIMIT 20;
