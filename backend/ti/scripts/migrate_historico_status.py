"""Migra/cria tabela historico_status"""
from core.db import engine
from ti.models.historico_status import HistoricoStatus

def migrate_historico_status():
    try:
        HistoricoStatus.__table__.create(bind=engine, checkfirst=True)
    except Exception as e:
        print(f"Aviso historico_status: {e}")
