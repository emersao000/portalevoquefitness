"""
Remove registros 'Mudança automática' do historico_status.
Gerados por versão antiga do código. Executado no startup do servidor.
"""
from core.db import SessionLocal
from sqlalchemy import text


def cleanup_historico_automatico():
    try:
        db = SessionLocal()
        result = db.execute(text(
            "DELETE FROM historico_status "
            "WHERE descricao LIKE 'Mudança automática:%' "
            "   OR descricao LIKE 'Mudanca automatica:%' "
            "   OR descricao LIKE 'Mudança automatica:%'"
        ))
        db.commit()
        count = result.rowcount
        if count:
            print(f"✅ Removidos {count} registro(s) de 'Mudança automática' do histórico")
        db.close()
    except Exception as e:
        print(f"⚠️  cleanup_historico_automatico: {e}")
