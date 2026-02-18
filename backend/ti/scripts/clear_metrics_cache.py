"""Limpa cache de métricas para forçar recálculo"""
from core.db import SessionLocal
from sqlalchemy import text

def clear_metrics_cache():
    try:
        db = SessionLocal()
        db.execute(text("DELETE FROM metrics_cache_db"))
        db.commit()
        db.close()
        print("✅ Cache de métricas limpo")
    except Exception as e:
        print(f"Aviso clear_metrics_cache: {e}")
