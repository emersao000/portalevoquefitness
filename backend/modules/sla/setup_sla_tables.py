"""Script para criar e inicializar tabelas SLA no banco de dados"""

from sqlalchemy.orm import Session
from core.db import engine, SessionLocal
from .models import ConfiguracaoSLA, Feriado, HorarioComercial, LogCalculoSLA
try:
    from ti.models.sla_pausa import SLAPausa
except ImportError:
    SLAPausa = None
import logging

logger = logging.getLogger("sla.setup")


def create_sla_tables():
    """Cria as tabelas do módulo SLA"""
    try:
        # Criar todas as tabelas
        ConfiguracaoSLA.__table__.create(bind=engine, checkfirst=True)
        Feriado.__table__.create(bind=engine, checkfirst=True)
        HorarioComercial.__table__.create(bind=engine, checkfirst=True)
        LogCalculoSLA.__table__.create(bind=engine, checkfirst=True)
        SLAPausa.__table__.create(bind=engine, checkfirst=True)
        
        logger.info("[SLA] Tabelas criadas/verificadas com sucesso")
        
        # Inserir configurações padrão se não existirem
        db = SessionLocal()
        try:
            config_count = db.query(ConfiguracaoSLA).count()
            if config_count == 0:
                logger.info("[SLA] Criando configurações padrão...")
                db.add(ConfiguracaoSLA(
                    prioridade="alta",
                    tempo_resposta_horas=2,
                    tempo_resolucao_horas=8,
                    descricao="Prioridade alta - resposta em 2h, resolução em 8h",
                    ativo=True
                ))
                db.add(ConfiguracaoSLA(
                    prioridade="media",
                    tempo_resposta_horas=4,
                    tempo_resolucao_horas=24,
                    descricao="Prioridade média - resposta em 4h, resolução em 24h",
                    ativo=True
                ))
                db.add(ConfiguracaoSLA(
                    prioridade="baixa",
                    tempo_resposta_horas=8,
                    tempo_resolucao_horas=48,
                    descricao="Prioridade baixa - resposta em 8h, resolução em 48h",
                    ativo=True
                ))
                db.commit()
                logger.info("[SLA] Configurações padrão criadas")
        finally:
            db.close()
        
        return True
    except Exception as e:
        logger.error(f"[SLA] Erro ao criar tabelas: {e}", exc_info=True)
        return False


if __name__ == "__main__":
    import logging
    logging.basicConfig(level=logging.INFO)
    create_sla_tables()
    print("Setup SLA concluído!")
