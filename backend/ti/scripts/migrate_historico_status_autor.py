"""Adiciona colunas autor_email e autor_nome à tabela historico_status (MySQL-compatível)"""
from core.db import engine, DB_NAME
from sqlalchemy import text


def _coluna_existe(conn, tabela: str, coluna: str) -> bool:
    """Verifica se uma coluna existe na tabela (MySQL via INFORMATION_SCHEMA)."""
    try:
        result = conn.execute(text(
            "SELECT COUNT(*) FROM information_schema.columns "
            "WHERE table_schema = :schema AND table_name = :tabela AND column_name = :coluna"
        ), {"schema": DB_NAME, "tabela": tabela, "coluna": coluna})
        return (result.scalar() or 0) > 0
    except Exception:
        return False


def migrate_historico_status_autor():
    """Garante que historico_status tem usuario_id, autor_email e autor_nome."""
    try:
        with engine.connect() as conn:
            # usuario_id — pode não existir em instâncias antigas
            if not _coluna_existe(conn, "historico_status", "usuario_id"):
                conn.execute(text(
                    "ALTER TABLE historico_status ADD COLUMN usuario_id INT NULL"
                ))
                conn.commit()
                print("✅ Coluna usuario_id adicionada a historico_status")

            if not _coluna_existe(conn, "historico_status", "autor_email"):
                conn.execute(text(
                    "ALTER TABLE historico_status ADD COLUMN autor_email VARCHAR(200) NULL"
                ))
                conn.commit()
                print("✅ Coluna autor_email adicionada a historico_status")
            
            if not _coluna_existe(conn, "historico_status", "autor_nome"):
                conn.execute(text(
                    "ALTER TABLE historico_status ADD COLUMN autor_nome VARCHAR(300) NULL"
                ))
                conn.commit()
                print("✅ Coluna autor_nome adicionada a historico_status")

    except Exception as e:
        print(f"⚠️  Erro ao migrar colunas de autor em historico_status: {e}")
