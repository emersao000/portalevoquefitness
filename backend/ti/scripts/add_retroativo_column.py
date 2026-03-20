"""Adiciona coluna retroativo na tabela chamado se nao existir"""
import logging
from core.db import engine
from sqlalchemy import text, inspect

logger = logging.getLogger("ti.scripts.retroativo")


def add_retroativo_column():
    """
    Adiciona a coluna 'retroativo' na tabela 'chamado' se ela nao existir.
    Executado automaticamente no startup do servidor.
    """
    try:
        inspector = inspect(engine)

        # Verifica se a tabela chamado existe
        if not inspector.has_table("chamado"):
            logger.info("[RETROATIVO] Tabela 'chamado' ainda nao existe, pulando migracao.")
            return

        cols = [c["name"] for c in inspector.get_columns("chamado")]

        if "retroativo" not in cols:
            with engine.connect() as conn:
                conn.execute(text(
                    "ALTER TABLE chamado ADD COLUMN retroativo BOOLEAN NOT NULL DEFAULT 0"
                ))
                conn.commit()
            logger.info("[RETROATIVO] ✅ Coluna retroativo adicionada com sucesso")
            print("✅ Coluna retroativo adicionada")
        else:
            logger.debug("[RETROATIVO] Coluna retroativo ja existe, nada a fazer.")

    except Exception as e:
        logger.error(f"[RETROATIVO] Erro ao adicionar coluna: {e}", exc_info=True)
        print(f"⚠️  Aviso retroativo: {e}")
