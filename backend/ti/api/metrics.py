from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.db import get_db
from core.utils import now_brazil_naive
from ti.services.metrics import MetricsCalculator

# Metrics router - properly configured with /metrics prefix
router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.get("/realtime")
def get_realtime_metrics(db: Session = Depends(get_db)):
    """
    Retorna métricas instantâneas (sem cache, sem cálculos pesados).

    Endpoint consolidado para dados rápidos:
    - chamados_hoje: Quantidade de chamados abertos hoje
    - comparacao_ontem: Comparação com ontem
    - abertos_agora: Quantidade de chamados ativos
    - timestamp: Momento do cálculo
    """
    try:
        return {
            "chamados_hoje": MetricsCalculator.get_chamados_abertos_hoje(db),
            "comparacao_ontem": MetricsCalculator.get_comparacao_ontem(db),
            "abertos_agora": MetricsCalculator.get_abertos_agora(db),
            "timestamp": now_brazil_naive().isoformat(),
        }
    except Exception as e:
        print(f"[ERROR] Erro ao calcular métricas em tempo real: {e}")
        import traceback
        traceback.print_exc()
        from fastapi import HTTPException
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao calcular métricas em tempo real: {str(e)}"
        )


@router.get("/dashboard/basic")
def get_basic_metrics(range: str = "30d", start_date: str = "", end_date: str = "", db: Session = Depends(get_db)):
    """
    Retorna métricas básicas do dashboard com dados agregados, respeitando filtro de período.

    Query params:
    - range: '7d', '30d', '90d' ou 'all' (padrão: '30d') - usado quando não há datas customizadas
    - start_date: Data inicial (formato: YYYY-MM-DD, opcional) - sobrescreve range
    - end_date: Data final (formato: YYYY-MM-DD, opcional) - sobrescreve range

    Retorna métricas filtradas pelo período selecionado.
    """
    from datetime import datetime, timedelta
    from ti.models.chamado import Chamado
    from sqlalchemy import and_

    try:
        agora = now_brazil_naive()

        # Determinar período baseado em range ou datas customizadas
        if start_date and end_date:
            try:
                data_inicio = datetime.strptime(start_date, "%Y-%m-%d").replace(hour=0, minute=0, second=0, microsecond=0)
                data_fim = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, microsecond=999999)
            except ValueError:
                from fastapi import HTTPException
                raise HTTPException(status_code=400, detail="Datas devem estar no formato YYYY-MM-DD")
        else:
            # Mapear range para dias
            range_map = {
                "7d": 7,
                "30d": 30,
                "90d": 90,
                "all": 365  # 1 ano como "todos os dados"
            }
            dias = range_map.get(range, 30)
            data_inicio = agora - timedelta(days=dias)
            data_fim = agora

        # Para "hoje" usamos sempre o dia atual
        hoje_inicio = agora.replace(hour=0, minute=0, second=0, microsecond=0)
        ontem_inicio = (agora - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        ontem_fim = hoje_inicio

        # Métricas de hoje (sempre independente do filtro)
        chamados_hoje = db.query(Chamado).filter(
            and_(
                Chamado.data_abertura >= hoje_inicio,
                Chamado.status != "Expirado"
            )
        ).count()

        chamados_ontem = db.query(Chamado).filter(
            and_(
                Chamado.data_abertura >= ontem_inicio,
                Chamado.data_abertura < ontem_fim,
                Chamado.status != "Expirado"
            )
        ).count()

        if chamados_ontem == 0:
            percentual = 0
        else:
            percentual = int(((chamados_hoje - chamados_ontem) / chamados_ontem) * 100)

        comparacao_ontem = {
            "hoje": chamados_hoje,
            "ontem": chamados_ontem,
            "percentual": percentual,
            "direcao": "up" if percentual >= 0 else "down"
        }

        # Métricas filtradas pelo período selecionado
        chamados_concluidos = db.query(Chamado).filter(
            and_(
                Chamado.data_conclusao >= data_inicio,
                Chamado.data_conclusao <= data_fim,
                Chamado.status == "Concluído"
            )
        ).count()

        chamados_em_atendimento = db.query(Chamado).filter(
            and_(
                Chamado.data_abertura >= data_inicio,
                Chamado.data_abertura <= data_fim,
                Chamado.status == "Em atendimento"
            )
        ).count()

        # Chamados em risco: abertos há mais de 5 dias E dentro do período
        limite_risco = agora - timedelta(days=5)
        chamados_em_risco = db.query(Chamado).filter(
            and_(
                Chamado.data_abertura >= data_inicio,
                Chamado.data_abertura <= data_fim,
                Chamado.data_abertura < limite_risco,
                Chamado.status.in_(["Aberto", "Em atendimento", "Aguardando"])
            )
        ).count()

        # Abertos agora (sempre, não filtra por período)
        abertos_agora = db.query(Chamado).filter(
            and_(
                Chamado.status != "Concluído",
                Chamado.status != "Expirado"
            )
        ).count()

        return {
            "chamados_hoje": chamados_hoje,
            "comparacao_ontem": comparacao_ontem,
            "abertos_agora": abertos_agora,
            "concluidos": chamados_concluidos,
            "em_atendimento": chamados_em_atendimento,
            "em_risco": chamados_em_risco,
            "timestamp": now_brazil_naive().isoformat(),
        }
    except Exception as e:
        print(f"[ERROR] Erro ao calcular métricas básicas: {e}")
        import traceback
        traceback.print_exc()
        from fastapi import HTTPException
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao calcular métricas básicas: {str(e)}"
        )




@router.get("/dashboard")
def get_dashboard_metrics(db: Session = Depends(get_db)):
    """
    Endpoint consolidado: Retorna todas as métricas do dashboard administrativo.

    Combina:
    - Métricas rápidas (realtime)
    - Métricas de performance

    Retorna:
    - chamados_hoje: Quantidade de chamados abertos hoje
    - comparacao_ontem: Comparação com ontem (hoje, ontem, percentual, direcao)
    - abertos_agora: Quantidade de chamados ativos
    - tempo_resolucao_30dias: Tempo médio de resolução (30 dias)
    - primeira_resposta_media: Tempo médio de primeira resposta
    - taxa_reaberturas: Taxa de reaberturas
    - chamados_backlog: Chamados em backlog
    - timestamp: Momento do cálculo
    """
    try:
        # Obtém todas as métricas
        realtime = get_realtime_metrics(db)
        performance = MetricsCalculator.get_performance_metrics(db)

        return {
            # Realtime
            "chamados_hoje": realtime["chamados_hoje"],
            "comparacao_ontem": realtime["comparacao_ontem"],
            "abertos_agora": realtime["abertos_agora"],

            # Performance
            "tempo_resolucao_30dias": performance["tempo_resolucao_medio"],
            "primeira_resposta_media": performance["primeira_resposta_media"],
            "taxa_reaberturas": performance["taxa_reaberturas"],
            "chamados_backlog": performance["chamados_backlog"],

            # Metadata
            "timestamp": now_brazil_naive().isoformat(),
        }
    except Exception as e:
        print(f"[ERROR] Erro ao calcular métricas do dashboard: {e}")
        import traceback
        traceback.print_exc()
        from fastapi import HTTPException
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao calcular métricas do dashboard: {str(e)}"
        )


@router.get("/chamados-abertos")
def get_chamados_abertos(db: Session = Depends(get_db)):
    """
    [DEPRECATED] Use /metrics/realtime instead.

    Retorna quantidade de chamados ativos (não concluídos nem cancelados)
    """
    try:
        count = MetricsCalculator.get_abertos_agora(db)
        return {"ativos": count}
    except Exception as e:
        print(f"Erro ao contar chamados ativos: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"Erro: {str(e)}")


@router.get("/chamados-hoje")
def get_chamados_hoje(db: Session = Depends(get_db)):
    """
    [DEPRECATED] Use /metrics/realtime instead.

    Retorna quantidade de chamados abertos hoje
    """
    try:
        count = MetricsCalculator.get_chamados_abertos_hoje(db)
        return {"chamados_hoje": count}
    except Exception as e:
        print(f"Erro ao contar chamados de hoje: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"Erro: {str(e)}")


@router.get("/tempo-resposta")
def get_tempo_resposta(db: Session = Depends(get_db)):
    """
    [DEPRECATED] Use /metrics/dashboard/sla instead.

    Retorna tempo médio de resposta das últimas 24h
    """
    try:
        tempo = MetricsCalculator.get_tempo_medio_resposta_24h(db)
        return {"tempo_resposta": tempo}
    except Exception as e:
        print(f"Erro ao calcular tempo de resposta: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=f"Erro: {str(e)}")




@router.get("/chamados-por-dia")
def get_chamados_por_dia(dias: int = 7, statuses: str = "", start_date: str = "", end_date: str = "", db: Session = Depends(get_db)):
    """Retorna quantidade de chamados por dia dos últimos N dias ou período customizado

    Query params:
    - dias: Número de dias (default: 7)
    - statuses: Lista separada por vírgula (ex: "Aberto,Em atendimento")
    - start_date: Data inicial (formato: YYYY-MM-DD, opcional)
    - end_date: Data final (formato: YYYY-MM-DD, opcional)

    Se start_date e end_date forem fornecidas, elas têm prioridade sobre 'dias'.
    """
    try:
        status_list = [s.strip() for s in statuses.split(",") if s.strip()] if statuses else []

        # Se datas customizadas forem fornecidas
        if start_date and end_date:
            try:
                dados = MetricsCalculator.get_chamados_por_dia_periodo(db, start_date, end_date, status_list if status_list else None)
            except Exception as e:
                print(f"Erro no período: {e}")
                import traceback
                traceback.print_exc()
                return {"dados": []}
        else:
            dados = MetricsCalculator.get_chamados_por_dia(db, dias, status_list if status_list else None)

        if not isinstance(dados, list):
            return {"dados": []}
        return {"dados": dados}
    except Exception as e:
        print(f"Erro ao calcular chamados por dia: {e}")
        import traceback
        traceback.print_exc()
        return {"dados": []}


@router.get("/chamados-por-semana")
def get_chamados_por_semana(semanas: int = 4, statuses: str = "", start_date: str = "", end_date: str = "", db: Session = Depends(get_db)):
    """Retorna quantidade de chamados por semana dos últimos N semanas ou período customizado

    Query params:
    - semanas: Número de semanas (default: 4)
    - statuses: Lista separada por vírgula (ex: "Aberto,Em atendimento")
    - start_date: Data inicial (formato: YYYY-MM-DD, opcional)
    - end_date: Data final (formato: YYYY-MM-DD, opcional)

    Se start_date e end_date forem fornecidas, elas têm prioridade sobre 'semanas'.
    """
    try:
        status_list = [s.strip() for s in statuses.split(",") if s.strip()] if statuses else []

        # Se datas customizadas forem fornecidas
        if start_date and end_date:
            try:
                dados = MetricsCalculator.get_chamados_por_semana_periodo(db, start_date, end_date, status_list if status_list else None)
            except Exception as e:
                print(f"Erro no período: {e}")
                import traceback
                traceback.print_exc()
                return {"dados": []}
        else:
            dados = MetricsCalculator.get_chamados_por_semana(db, semanas, status_list if status_list else None)

        if not isinstance(dados, list):
            return {"dados": []}
        return {"dados": dados}
    except Exception as e:
        print(f"Erro ao calcular chamados por semana: {e}")
        import traceback
        traceback.print_exc()
        return {"dados": []}


@router.get("/chamados-por-mes")
def get_chamados_por_mes(range: str = "30d", statuses: str = "", start_date: str = "", end_date: str = "", db: Session = Depends(get_db)):
    """Retorna quantidade de chamados por status por mês

    Query params:
    - range: '7d', '30d', '90d' ou 'all' (padrão: '30d')
    - statuses: Lista separada por vírgula (ex: "Aberto,Em atendimento,Concluído")
                Se vazio, mostra todos os status
    - start_date: Data inicial (formato: YYYY-MM-DD, opcional)
    - end_date: Data final (formato: YYYY-MM-DD, opcional)

    Se start_date e end_date forem fornecidas, elas têm prioridade sobre 'range'.
    """
    try:
        status_list = [s.strip() for s in statuses.split(",") if s.strip()] if statuses else []

        # Se datas customizadas forem fornecidas
        if start_date and end_date:
            try:
                dados = MetricsCalculator.get_chamados_por_mes_periodo(db, start_date, end_date, status_list if status_list else None)
            except Exception as e:
                print(f"Erro no período: {e}")
                import traceback
                traceback.print_exc()
                return {"dados": []}
        else:
            meses_param = {
                "7d": 1,
                "30d": 3,
                "90d": 12,
                "all": 24
            }.get(range, 3)
            dados = MetricsCalculator.get_chamados_por_mes(db, meses_param, status_list if status_list else None)

        if not isinstance(dados, list):
            return {"dados": []}
        return {"dados": dados}
    except Exception as e:
        print(f"Erro ao calcular chamados por mês: {e}")
        import traceback
        traceback.print_exc()
        return {"dados": []}




@router.get("/performance")
def get_performance_metrics(db: Session = Depends(get_db)):
    """Retorna métricas de performance (últimos 30 dias)"""
    try:
        metricas = MetricsCalculator.get_performance_metrics(db)
        return metricas
    except Exception as e:
        print(f"Erro ao calcular métricas de performance: {e}")
        return {
            "tempo_resolucao_medio": "—",
            "primeira_resposta_media": "—",
            "taxa_reaberturas": "0%",
            "chamados_backlog": 0
        }


@router.get("/debug/tempo-resposta")
def debug_tempo_resposta(periodo: str = "mes", db: Session = Depends(get_db)):
    """
    Debug: retorna dados brutos de tempo de resposta
    periodo: "mes", "24h" ou "30dias"
    """
    try:
        historicos = MetricsCalculator.debug_tempo_resposta(db, periodo)
        return {
            "status": "ok",
            "total_registros": len(historicos),
            "periodo": periodo
        }
    except Exception as e:
        print(f"Erro ao debugar tempo de resposta: {e}")
        return {
            "status": "erro",
            "erro": str(e),
            "periodo": periodo
        }




@router.get("/health")
def metrics_health_check(db: Session = Depends(get_db)):
    """
    Endpoint de health check para monitorar saúde do sistema.

    Retorna:
    - banco_status: Se conexão com banco está OK
    - timestamp: Momento do check
    """
    try:
        from core.utils import now_brazil_naive
        import json

        health = {
            "status": "healthy",
            "checks": {}
        }

        # Check: Database connection
        try:
            db.execute("SELECT 1")
            health["checks"]["database"] = {
                "status": "ok",
                "message": "Database connected"
            }
        except Exception as db_error:
            health["checks"]["database"] = {
                "status": "critical",
                "message": str(db_error)
            }
            health["status"] = "unhealthy"

        health["timestamp"] = now_brazil_naive().isoformat()
        return health

    except Exception as e:
        print(f"Erro ao fazer health check: {e}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": now_brazil_naive().isoformat()
        }
