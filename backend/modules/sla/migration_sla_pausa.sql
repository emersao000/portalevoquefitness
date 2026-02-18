-- Migration: Criação da tabela sla_pausa
-- Execute antes de iniciar o servidor

CREATE TABLE IF NOT EXISTS sla_pausa (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,  -- Use SERIAL para PostgreSQL
    chamado_id    INTEGER NOT NULL REFERENCES chamado(id) ON DELETE CASCADE,
    inicio        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fim           DATETIME,
    duracao_horas REAL DEFAULT 0.0,
    tipo          VARCHAR(20) DEFAULT 'status',         -- 'status' ou 'manual'
    status_pausante VARCHAR(50),                        -- Status que causou a pausa
    motivo        TEXT,
    criado_em     DATETIME DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_sla_pausa_chamado_id ON sla_pausa(chamado_id);
CREATE INDEX IF NOT EXISTS ix_sla_pausa_fim ON sla_pausa(fim);

-- Para PostgreSQL use:
-- CREATE TABLE IF NOT EXISTS sla_pausa (
--     id            SERIAL PRIMARY KEY,
--     chamado_id    INTEGER NOT NULL REFERENCES chamado(id) ON DELETE CASCADE,
--     inicio        TIMESTAMP NOT NULL DEFAULT NOW(),
--     fim           TIMESTAMP,
--     duracao_horas REAL DEFAULT 0.0,
--     tipo          VARCHAR(20) DEFAULT 'status',
--     status_pausante VARCHAR(50),
--     motivo        TEXT,
--     criado_em     TIMESTAMP DEFAULT NOW(),
--     atualizado_em TIMESTAMP DEFAULT NOW()
-- );
