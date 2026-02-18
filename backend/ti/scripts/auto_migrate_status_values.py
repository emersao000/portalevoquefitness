"""Normaliza valores de status antigos para o padrão atual"""
from core.db import SessionLocal
from sqlalchemy import text

STATUS_MAP = {
    "em andamento": "Em atendimento",
    "Em andamento": "Em atendimento",
    "em_atendimento": "Em atendimento",
    "em análise": "Aguardando",
    "Em análise": "Aguardando",
    "em_analise": "Aguardando",
    "analise": "Aguardando",
    "concluido": "Concluído",
    "Concluido": "Concluído",
    "cancelado": "Expirado",
    "Cancelado": "Expirado",
    "aberto": "Aberto",
}

def auto_migrate_status_values():
    try:
        db = SessionLocal()
        total = 0
        for antigo, novo in STATUS_MAP.items():
            result = db.execute(
                text("UPDATE chamado SET status = :novo WHERE status = :antigo"),
                {"novo": novo, "antigo": antigo}
            )
            total += result.rowcount
        db.commit()
        db.close()
        if total:
            print(f"✅ {total} registros de status normalizados")
    except Exception as e:
        print(f"Aviso auto_migrate_status: {e}")
