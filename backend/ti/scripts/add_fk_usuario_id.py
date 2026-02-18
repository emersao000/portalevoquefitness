"""
Adds foreign key constraint for usuario_id in historico_status table if it doesn't exist.
This ensures referential integrity between historico_status and user tables.
"""
from core.db import engine, DB_NAME
from sqlalchemy import text


def _fk_exists(conn, table_name: str, fk_name: str) -> bool:
    """Check if a foreign key constraint exists in MySQL."""
    try:
        result = conn.execute(text(
            "SELECT COUNT(*) FROM information_schema.table_constraints "
            "WHERE table_schema = :schema AND table_name = :table AND constraint_type = 'FOREIGN KEY' "
            "AND constraint_name = :fk_name"
        ), {"schema": DB_NAME, "table": table_name, "fk_name": fk_name})
        return (result.scalar() or 0) > 0
    except Exception as e:
        print(f"⚠️  Error checking FK existence: {e}")
        return False


def _coluna_existe(conn, tabela: str, coluna: str) -> bool:
    """Check if a column exists in the table."""
    try:
        result = conn.execute(text(
            "SELECT COUNT(*) FROM information_schema.columns "
            "WHERE table_schema = :schema AND table_name = :tabela AND column_name = :coluna"
        ), {"schema": DB_NAME, "tabela": tabela, "coluna": coluna})
        return (result.scalar() or 0) > 0
    except Exception:
        return False


def add_fk_usuario_id():
    """Ensure usuario_id foreign key constraint exists in historico_status."""
    try:
        with engine.connect() as conn:
            # Check if usuario_id column exists
            if not _coluna_existe(conn, "historico_status", "usuario_id"):
                conn.execute(text(
                    "ALTER TABLE historico_status ADD COLUMN usuario_id INT NULL"
                ))
                conn.commit()
                print("✅ Added usuario_id column to historico_status")

            # Check if the foreign key constraint already exists
            if _fk_exists(conn, "historico_status", "historico_status_ibfk_usuario"):
                print("✅ Foreign key constraint already exists on historico_status.usuario_id")
                return

            # Try to add the foreign key constraint
            try:
                conn.execute(text(
                    "ALTER TABLE historico_status "
                    "ADD CONSTRAINT historico_status_ibfk_usuario "
                    "FOREIGN KEY (usuario_id) REFERENCES `user`(id) ON DELETE SET NULL"
                ))
                conn.commit()
                print("✅ Added foreign key constraint on historico_status.usuario_id")
            except Exception as e:
                # If constraint already exists with a different name, try to continue
                if "Duplicate foreign key" in str(e) or "already exists" in str(e).lower():
                    print("✅ Foreign key constraint already exists (different name)")
                else:
                    print(f"⚠️  Could not add FK constraint (may already exist): {e}")

    except Exception as e:
        print(f"⚠️  Error in add_fk_usuario_id migration: {e}")
