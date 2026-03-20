"""Cria tabela de cache de métricas"""
from core.db import engine
from ti.models.metrics_cache import MetricsCacheDB

def create_metrics_cache_table():
    try:
        MetricsCacheDB.__table__.create(bind=engine, checkfirst=True)
    except Exception as e:
        print(f"Aviso metrics_cache: {e}")
