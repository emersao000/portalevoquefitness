"""Endpoints da API de SLA"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional
import logging

from core.db import get_db
from .service import SlaService

logger = logging.getLogger("sla.router")

router = APIRouter(prefix="/sla", tags=["SLA"])


@router.get("/dashboard")
async def obter_dashboard(
    data_inicio: Optional[datetime] = Query(None),
    data_fim: Optional[datetime] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Dashboard completo de SLA.
    - Contabiliza apenas chamados abertos >= 16/02/2026
    - Horario comercial: 08:00-18:00 seg-sex
    - SLA pausa automaticamente quando status = Aguardando
    - SLA conta quando status = Aberto ou Em atendimento
    """
    try:
        return SlaService(db).obter_dashboard(data_inicio, data_fim)
    except Exception as e:
        logger.error(f"Erro ao obter dashboard SLA: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao calcular metricas de SLA: {str(e)}"
        )


@router.get("/dashboard/resumo")
async def obter_resumo(db: Session = Depends(get_db)):
    """Resumo rapido para cards do painel admin"""
    try:
        data = SlaService(db).obter_dashboard()
        return {
            "percentual_cumprimento": data.get("percentual_cumprimento", 0),
            "percentual_em_risco": data.get("percentual_em_risco", 0),
            "percentual_vencidos": data.get("percentual_vencidos", 0),
            "chamados_em_risco": data.get("chamados_em_risco", 0),
            "chamados_vencidos": data.get("chamados_vencidos", 0),
            "chamados_pausados": data.get("chamados_pausados", 0),
            "chamados_abertos": data.get("chamados_abertos", 0),
            "tempo_medio_resposta_horas": data.get("tempo_medio_resposta_horas", 0),
            "tempo_medio_resolucao_horas": data.get("tempo_medio_resolucao_horas", 0),
            "tempo_medio_resposta_formatado": data.get("tempo_medio_resposta_formatado", "—"),
            "tempo_medio_resolucao_formatado": data.get("tempo_medio_resolucao_formatado", "—"),
            "ultima_atualizacao": data.get("ultima_atualizacao"),
        }
    except Exception as e:
        logger.error(f"Erro ao obter resumo SLA: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao calcular resumo SLA: {str(e)}")


@router.get("/chamado/{chamado_id}")
async def obter_sla_chamado(chamado_id: int, db: Session = Depends(get_db)):
    """SLA de um chamado especifico"""
    try:
        result = SlaService(db).calcular_sla_chamado(chamado_id)
        if not result:
            raise HTTPException(
                status_code=404,
                detail="Chamado nao encontrado ou anterior ao inicio do SLA (16/02/2026)"
            )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro ao calcular SLA chamado {chamado_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao calcular SLA: {str(e)}")


@router.post("/chamado/{chamado_id}/pausar")
async def pausar_sla(
    chamado_id: int,
    status: str = Query(...),
    db: Session = Depends(get_db)
):
    """Pausa ou retoma SLA manualmente"""
    try:
        result = SlaService(db).pausar_sla_chamado(chamado_id, status)
        return {"chamado_id": chamado_id, "status": status, "alterado": result}
    except Exception as e:
        logger.error(f"Erro ao pausar SLA chamado {chamado_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao pausar SLA: {str(e)}")


@router.get("/health")
async def health():
    return {
        "status": "ok",
        "modulo": "sla",
        "regras": {
            "data_inicio_sla": "2026-02-16",
            "horario_comercial": "08:00-18:00 seg-sex",
            "status_contam": ["Aberto", "Em atendimento"],
            "status_pausam": ["Aguardando"],
            "status_finais": ["Concluido", "Expirado"],
        },
        "timestamp": datetime.utcnow().isoformat()
    }
