"""Endpoints da API de SLA"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional
import time as _time
import logging

from core.db import get_db
from .service import SlaService

logger = logging.getLogger("sla.router")

router = APIRouter(prefix="/sla", tags=["SLA"])

# ── Cache TTL para o dashboard (evita recalcular a cada requisição) ──────────
_SLA_CACHE: dict = {}
_SLA_CACHE_TTL = 5 * 60  # 5 minutos


def _cache_key(data_inicio, data_fim) -> str:
    ini = data_inicio.isoformat() if data_inicio else "none"
    fim = data_fim.isoformat() if data_fim else "none"
    return f"{ini}|{fim}"


def _cache_get(key: str):
    entry = _SLA_CACHE.get(key)
    if entry and (_time.monotonic() - entry["ts"]) < _SLA_CACHE_TTL:
        return entry["data"]
    return None


def _cache_set(key: str, data: dict):
    _SLA_CACHE[key] = {"data": data, "ts": _time.monotonic()}
    # Limpa entradas antigas se cache crescer demais
    if len(_SLA_CACHE) > 20:
        oldest = min(_SLA_CACHE, key=lambda k: _SLA_CACHE[k]["ts"])
        _SLA_CACHE.pop(oldest, None)


def invalidar_cache_sla():
    """Invalida o cache do dashboard SLA (chamado ao alterar chamados)."""
    _SLA_CACHE.clear()


@router.get("/dashboard")
async def obter_dashboard(
    data_inicio: Optional[datetime] = Query(None),
    data_fim: Optional[datetime] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Dashboard completo de SLA.
    - Contabiliza apenas chamados abertos >= 16/02/2026
    - Horário comercial: 08:00-18:00 seg-sex
    - SLA pausa automaticamente quando status = Aguardando
    - Cache TTL: 5 minutos (primeira chamada pode ser um pouco mais lenta)
    """
    try:
        key = _cache_key(data_inicio, data_fim)
        cached = _cache_get(key)
        if cached is not None:
            return {**cached, "cache_hit": True}

        result = SlaService(db).obter_dashboard(data_inicio, data_fim)
        _cache_set(key, result)
        return {**result, "cache_hit": False}
    except Exception as e:
        logger.error(f"Erro ao obter dashboard SLA: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao calcular metricas de SLA: {str(e)}"
        )


@router.get("/dashboard/resumo")
async def obter_resumo(db: Session = Depends(get_db)):
    """Resumo rápido para cards do painel admin"""
    try:
        # Aproveita o cache do dashboard principal
        key = _cache_key(None, None)
        cached = _cache_get(key)
        if cached:
            data = cached
        else:
            data = SlaService(db).obter_dashboard()
            _cache_set(key, data)
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


@router.post("/cache/invalidar")
async def invalidar_cache():
    """Invalida manualmente o cache do SLA (para forçar recálculo)."""
    invalidar_cache_sla()
    return {"status": "ok", "mensagem": "Cache SLA invalidado"}


@router.get("/chamado/{chamado_id}")
async def obter_sla_chamado(chamado_id: int, db: Session = Depends(get_db)):
    """SLA de um chamado específico"""
    try:
        result = SlaService(db).calcular_sla_chamado(chamado_id)
        if not result:
            raise HTTPException(
                status_code=404,
                detail="Chamado não encontrado ou anterior ao início do SLA (16/02/2026)"
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
        invalidar_cache_sla()  # Invalida cache ao alterar estado
        return {"chamado_id": chamado_id, "status": status, "alterado": result}
    except Exception as e:
        logger.error(f"Erro ao pausar SLA chamado {chamado_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao pausar SLA: {str(e)}")


@router.get("/health")
async def health():
    return {
        "status": "ok",
        "modulo": "sla",
        "cache_entries": len(_SLA_CACHE),
        "regras": {
            "data_inicio_sla": "2026-02-16",
            "horario_comercial": "08:00-18:00 seg-sex",
            "status_contam": ["Aberto", "Em atendimento"],
            "status_pausam": ["Aguardando"],
            "status_finais": ["Concluido", "Expirado"],
        },
        "timestamp": datetime.utcnow().isoformat()
    }
