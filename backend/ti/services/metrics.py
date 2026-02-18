"""
MetricsCalculator - Serviço de métricas do dashboard TI
Considera SLA apenas a partir de 16/02/2026
Horário comercial: 08:00-18:00, seg-sex
"""
from datetime import datetime, timedelta, time, date
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import and_

SLA_DATA_INICIO = datetime(2026, 2, 16, 0, 0, 0)
HORA_INICIO = time(8, 0)
HORA_FIM = time(18, 0)


def _eh_dia_util(d: date) -> bool:
    return d.weekday() < 5


def _horas_uteis(inicio: datetime, fim: datetime) -> float:
    if not inicio or not fim:
        return 0.0
    if inicio < SLA_DATA_INICIO:
        inicio = SLA_DATA_INICIO
    if inicio >= fim:
        return 0.0
    total = 0.0
    current = inicio.date()
    while current <= fim.date():
        if _eh_dia_util(current):
            j_ini = max(datetime.combine(current, HORA_INICIO), inicio)
            j_fim = min(datetime.combine(current, HORA_FIM), fim)
            if j_ini < j_fim:
                total += (j_fim - j_ini).total_seconds() / 3600
        current += timedelta(days=1)
    return round(total, 2)


def _formatar(horas: float) -> str:
    if horas <= 0:
        return "—"
    h = int(horas)
    m = int((horas - h) * 60)
    if h > 0 and m > 0:
        return f"{h}h {m}min"
    elif h > 0:
        return f"{h}h"
    return f"{m}min"


class MetricsCalculator:

    @staticmethod
    def get_chamados_abertos_hoje(db: Session) -> int:
        from ti.models.chamado import Chamado
        from core.utils import now_brazil_naive
        agora = now_brazil_naive()
        hoje = agora.replace(hour=0, minute=0, second=0, microsecond=0)
        return db.query(Chamado).filter(
            and_(Chamado.data_abertura >= hoje, Chamado.deletado_em.is_(None))
        ).count()

    @staticmethod
    def get_comparacao_ontem(db: Session) -> dict:
        from ti.models.chamado import Chamado
        from core.utils import now_brazil_naive
        agora = now_brazil_naive()
        hoje = agora.replace(hour=0, minute=0, second=0, microsecond=0)
        ontem = hoje - timedelta(days=1)
        hoje_c = db.query(Chamado).filter(
            and_(Chamado.data_abertura >= hoje, Chamado.deletado_em.is_(None))
        ).count()
        ontem_c = db.query(Chamado).filter(
            and_(Chamado.data_abertura >= ontem, Chamado.data_abertura < hoje, Chamado.deletado_em.is_(None))
        ).count()
        percentual = int(((hoje_c - ontem_c) / ontem_c) * 100) if ontem_c > 0 else 0
        return {"hoje": hoje_c, "ontem": ontem_c, "percentual": percentual,
                "direcao": "up" if percentual >= 0 else "down"}

    @staticmethod
    def get_abertos_agora(db: Session) -> int:
        from ti.models.chamado import Chamado
        return db.query(Chamado).filter(
            and_(Chamado.status.notin_(["Concluído", "Expirado"]), Chamado.deletado_em.is_(None))
        ).count()

    @staticmethod
    def get_tempo_medio_resposta_24h(db: Session) -> str:
        from ti.models.chamado import Chamado
        from core.utils import now_brazil_naive
        agora = now_brazil_naive()
        chamados = db.query(Chamado).filter(
            and_(
                Chamado.data_primeira_resposta >= agora - timedelta(days=1),
                Chamado.data_primeira_resposta.isnot(None),
                Chamado.data_abertura >= SLA_DATA_INICIO,
                Chamado.deletado_em.is_(None)
            )
        ).all()
        if not chamados:
            return "—"
        tempos = [_horas_uteis(c.data_abertura, c.data_primeira_resposta) for c in chamados if c.data_abertura and c.data_primeira_resposta]
        tempos = [t for t in tempos if t > 0]
        return _formatar(sum(tempos) / len(tempos)) if tempos else "—"

    @staticmethod
    def get_performance_metrics(db: Session) -> dict:
        from ti.models.chamado import Chamado
        from core.utils import now_brazil_naive
        agora = now_brazil_naive()
        inicio = max(agora - timedelta(days=30), SLA_DATA_INICIO)

        concluidos = db.query(Chamado).filter(
            and_(
                Chamado.status == "Concluído",
                Chamado.data_conclusao >= inicio,
                Chamado.data_abertura >= SLA_DATA_INICIO,
                Chamado.deletado_em.is_(None)
            )
        ).all()

        # Tempo médio resolução
        tempo_resolucao = "—"
        tempos_res = [_horas_uteis(c.data_abertura, c.data_conclusao) for c in concluidos if c.data_abertura and c.data_conclusao]
        tempos_res = [t for t in tempos_res if t > 0]
        if tempos_res:
            tempo_resolucao = _formatar(sum(tempos_res) / len(tempos_res))

        # Tempo médio primeira resposta
        primeira_resposta = "—"
        com_resp = db.query(Chamado).filter(
            and_(
                Chamado.data_primeira_resposta >= inicio,
                Chamado.data_primeira_resposta.isnot(None),
                Chamado.data_abertura >= SLA_DATA_INICIO,
                Chamado.deletado_em.is_(None)
            )
        ).all()
        tempos_resp = [_horas_uteis(c.data_abertura, c.data_primeira_resposta) for c in com_resp if c.data_abertura and c.data_primeira_resposta]
        tempos_resp = [t for t in tempos_resp if t > 0]
        if tempos_resp:
            primeira_resposta = _formatar(sum(tempos_resp) / len(tempos_resp))

        # Taxa reaberturas
        total_mes = db.query(Chamado).filter(
            and_(Chamado.data_abertura >= inicio, Chamado.deletado_em.is_(None))
        ).count()
        reaberturas = db.query(Chamado).filter(
            and_(Chamado.data_abertura >= inicio, Chamado.retroativo == True, Chamado.deletado_em.is_(None))
        ).count()
        taxa = f"{round(reaberturas / total_mes * 100, 1)}%" if total_mes > 0 else "0%"

        # Backlog
        backlog = db.query(Chamado).filter(
            and_(
                Chamado.status.in_(["Aberto", "Em atendimento", "Aguardando"]),
                Chamado.data_abertura < agora - timedelta(days=5),
                Chamado.deletado_em.is_(None)
            )
        ).count()

        return {
            "tempo_resolucao_medio": tempo_resolucao,
            "primeira_resposta_media": primeira_resposta,
            "taxa_reaberturas": taxa,
            "chamados_backlog": backlog
        }

    @staticmethod
    def get_chamados_por_dia(db: Session, dias: int = 7, statuses: list = None) -> list:
        from ti.models.chamado import Chamado
        from core.utils import now_brazil_naive
        agora = now_brazil_naive()
        result = []
        for i in range(dias - 1, -1, -1):
            d = agora - timedelta(days=i)
            ini = d.replace(hour=0, minute=0, second=0, microsecond=0)
            fim = ini + timedelta(days=1)
            q = db.query(Chamado).filter(and_(Chamado.data_abertura >= ini, Chamado.data_abertura < fim, Chamado.deletado_em.is_(None)))
            if statuses:
                q = q.filter(Chamado.status.in_(statuses))
            result.append({"dia": ini.strftime("%a"), "data": ini.strftime("%Y-%m-%d"), "quantidade": q.count()})
        return result

    @staticmethod
    def get_chamados_por_dia_periodo(db: Session, start_date: str, end_date: str, statuses: list = None) -> list:
        from ti.models.chamado import Chamado
        ini = datetime.strptime(start_date, "%Y-%m-%d")
        fim_total = datetime.strptime(end_date, "%Y-%m-%d")
        result = []
        current = ini
        while current <= fim_total:
            prox = current + timedelta(days=1)
            q = db.query(Chamado).filter(and_(Chamado.data_abertura >= current, Chamado.data_abertura < prox, Chamado.deletado_em.is_(None)))
            if statuses:
                q = q.filter(Chamado.status.in_(statuses))
            result.append({"dia": current.strftime("%a"), "data": current.strftime("%Y-%m-%d"), "quantidade": q.count()})
            current = prox
        return result

    @staticmethod
    def get_chamados_por_semana(db: Session, semanas: int = 4, statuses: list = None) -> list:
        from ti.models.chamado import Chamado
        from core.utils import now_brazil_naive
        agora = now_brazil_naive()
        result = []
        for i in range(semanas - 1, -1, -1):
            fim = agora - timedelta(weeks=i)
            ini = fim - timedelta(weeks=1)
            q = db.query(Chamado).filter(and_(Chamado.data_abertura >= ini, Chamado.data_abertura < fim, Chamado.deletado_em.is_(None)))
            if statuses:
                q = q.filter(Chamado.status.in_(statuses))
            result.append({"semana": ini.strftime("%d/%m"), "quantidade": q.count()})
        return result

    @staticmethod
    def get_chamados_por_semana_periodo(db: Session, start_date: str, end_date: str, statuses: list = None) -> list:
        from ti.models.chamado import Chamado
        ini = datetime.strptime(start_date, "%Y-%m-%d")
        fim_total = datetime.strptime(end_date, "%Y-%m-%d")
        result = []
        current = ini
        while current <= fim_total:
            prox = current + timedelta(weeks=1)
            q = db.query(Chamado).filter(and_(Chamado.data_abertura >= current, Chamado.data_abertura < prox, Chamado.deletado_em.is_(None)))
            if statuses:
                q = q.filter(Chamado.status.in_(statuses))
            result.append({"semana": current.strftime("%d/%m"), "quantidade": q.count()})
            current = prox
        return result

    @staticmethod
    def get_chamados_por_mes(db: Session, meses: int = 3, statuses: list = None) -> list:
        from ti.models.chamado import Chamado
        from core.utils import now_brazil_naive
        agora = now_brazil_naive()
        result = []
        for i in range(meses - 1, -1, -1):
            primeiro = (agora.replace(day=1) - timedelta(days=30 * i)).replace(day=1)
            fim = agora if i == 0 else (primeiro + timedelta(days=32)).replace(day=1)
            q = db.query(Chamado).filter(and_(Chamado.data_abertura >= primeiro, Chamado.data_abertura < fim, Chamado.deletado_em.is_(None)))
            if statuses:
                q = q.filter(Chamado.status.in_(statuses))
            result.append({"mes": primeiro.strftime("%b/%Y"), "quantidade": q.count()})
        return result

    @staticmethod
    def get_chamados_por_mes_periodo(db: Session, start_date: str, end_date: str, statuses: list = None) -> list:
        from ti.models.chamado import Chamado
        ini = datetime.strptime(start_date, "%Y-%m-%d").replace(day=1)
        fim_total = datetime.strptime(end_date, "%Y-%m-%d")
        result = []
        current = ini
        while current <= fim_total:
            prox = (current + timedelta(days=32)).replace(day=1)
            q = db.query(Chamado).filter(and_(Chamado.data_abertura >= current, Chamado.data_abertura < prox, Chamado.deletado_em.is_(None)))
            if statuses:
                q = q.filter(Chamado.status.in_(statuses))
            result.append({"mes": current.strftime("%b/%Y"), "quantidade": q.count()})
            current = prox
        return result

    @staticmethod
    def debug_tempo_resposta(db: Session, periodo: str = "mes") -> list:
        from ti.models.chamado import Chamado
        from core.utils import now_brazil_naive
        agora = now_brazil_naive()
        if periodo == "24h":
            inicio = agora - timedelta(days=1)
        elif periodo == "30dias":
            inicio = agora - timedelta(days=30)
        else:
            inicio = agora.replace(day=1, hour=0, minute=0, second=0)
        return db.query(Chamado).filter(
            and_(Chamado.data_primeira_resposta >= inicio, Chamado.data_primeira_resposta.isnot(None), Chamado.deletado_em.is_(None))
        ).all()
