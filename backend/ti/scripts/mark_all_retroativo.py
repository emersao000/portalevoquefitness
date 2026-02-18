"""Marca todos os chamados com data_abertura anterior ao início do SLA como retroativos"""
from core.db import SessionLocal
from sqlalchemy import text
from datetime import datetime

SLA_DATA_INICIO = datetime(2026, 2, 16, 0, 0, 0)

def mark_retroativo_tickets():
    try:
        db = SessionLocal()
        result = db.execute(
            text("UPDATE chamado SET retroativo = 1 WHERE data_abertura < :data AND retroativo = 0"),
            {"data": SLA_DATA_INICIO}
        )
        db.commit()
        if result.rowcount:
            print(f"✅ {result.rowcount} chamados marcados como retroativos (anteriores a 16/02/2026)")
        db.close()
    except Exception as e:
        print(f"Aviso mark_retroativo: {e}")
