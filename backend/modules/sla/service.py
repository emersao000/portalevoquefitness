"""Camada de negócio para SLA"""
import logging
from datetime import datetime
from typing import Optional, Dict
from sqlalchemy.orm import Session
from core.db import SessionLocal
from .metrics import ServicoMetricasSLA

logger = logging.getLogger("sla.service")


class SlaService:
    def __init__(self, db: Session = None):
        self.db = db or SessionLocal()

    def obter_dashboard(self, data_inicio=None, data_fim=None) -> Dict:
        return ServicoMetricasSLA(self.db).obter_metricas_dashboard(data_inicio, data_fim)

    def calcular_sla_chamado(self, chamado_id: int) -> Optional[Dict]:
        from ti.models.chamado import Chamado
        chamado = self.db.query(Chamado).filter(Chamado.id == chamado_id).first()
        if not chamado:
            return None
        return ServicoMetricasSLA(self.db).calcular_sla_chamado(chamado)

    def pausar_sla_chamado(self, chamado_id: int, status: str) -> bool:
        try:
            from ti.models.sla_pausa import SLAPausa
            STATUS_PAUSADOS = {"Aguardando"}
            if status in STATUS_PAUSADOS:
                ativa = self.db.query(SLAPausa).filter(
                    SLAPausa.chamado_id == chamado_id, SLAPausa.fim.is_(None)
                ).first()
                if not ativa:
                    self.db.add(SLAPausa(
                        chamado_id=chamado_id, inicio=datetime.utcnow(),
                        tipo="status", status_pausante=status,
                        motivo=f"Pausa automática - {status}"
                    ))
                    self.db.commit()
                    return True
            else:
                pausas = self.db.query(SLAPausa).filter(
                    SLAPausa.chamado_id == chamado_id, SLAPausa.fim.is_(None)
                ).all()
                for p in pausas:
                    p.fim = datetime.utcnow()
                    p.duracao_horas = (p.fim - p.inicio).total_seconds() / 3600
                if pausas:
                    self.db.commit()
                return bool(pausas)
        except Exception as e:
            logger.error(f"Erro pausa SLA chamado {chamado_id}: {e}")
        return False
