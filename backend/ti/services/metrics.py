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

# Todos os valores de status que equivalem a cada grupo canônico
# (banco pode ter valores legados/variações que o _normalize_status mapeia)
STATUS_ABERTO        = ["Aberto"]
STATUS_EM_ATENDIMENTO = ["Em atendimento"]
STATUS_AGUARDANDO    = ["Aguardando", "Em análise", "Em analise", "analise", "Análise"]
STATUS_CONCLUIDO     = ["Concluído", "Concluido", "Finalizado", "finalizado"]
STATUS_EXPIRADO      = ["Expirado", "Cancelado", "cancelado"]
# Para contar "aguardando" na visão geral (igual ao frontend: AGUARDANDO | EXPIRADO)
STATUS_AGUARDANDO_TOTAL = STATUS_AGUARDANDO + STATUS_EXPIRADO


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
    def get_basic_metrics(db: Session, dias: int = 30) -> dict:
        """
        Retorna métricas básicas para a Visão Geral do painel admin.
        Chamado pelo endpoint /metrics/overview.
        """
        from ti.models.chamado import Chamado
        from core.utils import now_brazil_naive

        agora = now_brazil_naive()
        hoje = agora.replace(hour=0, minute=0, second=0, microsecond=0)
        ontem = hoje - timedelta(days=1)
        inicio_periodo = agora - timedelta(days=dias)

        # Comparação hoje vs ontem
        hoje_c = db.query(Chamado).filter(
            and_(Chamado.data_abertura >= hoje, Chamado.deletado_em.is_(None))
        ).count()
        ontem_c = db.query(Chamado).filter(
            and_(Chamado.data_abertura >= ontem, Chamado.data_abertura < hoje, Chamado.deletado_em.is_(None))
        ).count()
        percentual = int(((hoje_c - ontem_c) / ontem_c) * 100) if ontem_c > 0 else 0

        # Contagens em tempo real (sempre, sem filtro de período)
        abertos_agora = db.query(Chamado).filter(
            and_(Chamado.status.in_(STATUS_ABERTO), Chamado.deletado_em.is_(None))
        ).count()

        em_atendimento = db.query(Chamado).filter(
            and_(Chamado.status.in_(STATUS_EM_ATENDIMENTO), Chamado.deletado_em.is_(None))
        ).count()

        aguardando = db.query(Chamado).filter(
            and_(Chamado.status.in_(STATUS_AGUARDANDO_TOTAL), Chamado.deletado_em.is_(None))
        ).count()

        # Concluídos no período
        concluidos = db.query(Chamado).filter(
            and_(
                Chamado.status.in_(STATUS_CONCLUIDO),
                Chamado.data_conclusao >= inicio_periodo,
                Chamado.deletado_em.is_(None)
            )
        ).count()

        # Backlog
        backlog = db.query(Chamado).filter(
            and_(
                Chamado.status.in_(STATUS_ABERTO + STATUS_EM_ATENDIMENTO + STATUS_AGUARDANDO_TOTAL),
                Chamado.data_abertura < agora - timedelta(days=5),
                Chamado.deletado_em.is_(None)
            )
        ).count()

        return {
            "chamados_hoje": hoje_c,
            "abertos_agora": abertos_agora,
            "em_atendimento": em_atendimento,
            "aguardando": aguardando,
            "concluidos": concluidos,
            "em_risco": backlog,
            "comparacao_ontem": {
                "hoje": hoje_c,
                "ontem": ontem_c,
                "percentual": percentual,
                "direcao": "up" if percentual >= 0 else "down",
            },
            "timestamp": agora.isoformat(),
        }

    @staticmethod
    def get_basic_metrics_periodo(db: Session, data_inicio: datetime, data_fim: datetime) -> dict:
        """
        Versão de get_basic_metrics com período customizado.
        """
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

        abertos_agora = db.query(Chamado).filter(
            and_(Chamado.status.in_(STATUS_ABERTO), Chamado.deletado_em.is_(None))
        ).count()

        em_atendimento = db.query(Chamado).filter(
            and_(Chamado.status.in_(STATUS_EM_ATENDIMENTO), Chamado.deletado_em.is_(None))
        ).count()

        aguardando = db.query(Chamado).filter(
            and_(Chamado.status.in_(STATUS_AGUARDANDO_TOTAL), Chamado.deletado_em.is_(None))
        ).count()

        concluidos = db.query(Chamado).filter(
            and_(
                Chamado.status.in_(STATUS_CONCLUIDO),
                Chamado.data_conclusao >= data_inicio,
                Chamado.data_conclusao <= data_fim,
                Chamado.deletado_em.is_(None)
            )
        ).count()

        backlog = db.query(Chamado).filter(
            and_(
                Chamado.status.in_(STATUS_ABERTO + STATUS_EM_ATENDIMENTO + STATUS_AGUARDANDO_TOTAL),
                Chamado.data_abertura < agora - timedelta(days=5),
                Chamado.deletado_em.is_(None)
            )
        ).count()

        return {
            "chamados_hoje": hoje_c,
            "abertos_agora": abertos_agora,
            "em_atendimento": em_atendimento,
            "aguardando": aguardando,
            "concluidos": concluidos,
            "em_risco": backlog,
            "comparacao_ontem": {
                "hoje": hoje_c,
                "ontem": ontem_c,
                "percentual": percentual,
                "direcao": "up" if percentual >= 0 else "down",
            },
            "timestamp": agora.isoformat(),
        }

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
            and_(Chamado.status.in_(STATUS_ABERTO), Chamado.deletado_em.is_(None))
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
                Chamado.status.in_(STATUS_CONCLUIDO),
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
                Chamado.status.in_(STATUS_ABERTO + STATUS_EM_ATENDIMENTO + STATUS_AGUARDANDO),
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
        from sqlalchemy import func
        agora = now_brazil_naive()
        all_statuses = statuses or ["Aberto", "Em atendimento", "Aguardando", "Concluído", "Expirado"]
        inicio = (agora - timedelta(days=dias - 1)).replace(hour=0, minute=0, second=0, microsecond=0)

        # Uma única query GROUP BY data + status
        rows = db.query(
            func.date(Chamado.data_abertura).label("data"),
            Chamado.status,
            func.count(Chamado.id).label("qtd")
        ).filter(
            Chamado.data_abertura >= inicio,
            Chamado.deletado_em.is_(None)
        ).group_by(
            func.date(Chamado.data_abertura),
            Chamado.status
        ).all()

        # Indexar por data+status
        idx: dict = {}
        for r in rows:
            idx.setdefault(str(r.data), {})[r.status] = r.qtd

        def _key(st): return st.lower().replace(" ","_").replace("í","i").replace("ú","u").replace("ó","o").replace("ã","a").replace("é","e").replace("ç","c")

        result = []
        for i in range(dias - 1, -1, -1):
            d = (agora - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
            ds = d.strftime("%Y-%m-%d")
            row = {"dia": d.strftime("%a"), "data": ds}
            total = 0
            for st in all_statuses:
                count = idx.get(ds, {}).get(st, 0)
                row[_key(st)] = count
                total += count
            row["quantidade"] = total
            result.append(row)
        return result

    @staticmethod
    def get_chamados_por_dia_periodo(db: Session, start_date: str, end_date: str, statuses: list = None) -> list:
        from ti.models.chamado import Chamado
        from sqlalchemy import func
        ini = datetime.strptime(start_date, "%Y-%m-%d")
        fim_total = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
        all_statuses = statuses or ["Aberto", "Em atendimento", "Aguardando", "Concluído", "Expirado"]

        rows = db.query(
            func.date(Chamado.data_abertura).label("data"),
            Chamado.status,
            func.count(Chamado.id).label("qtd")
        ).filter(
            Chamado.data_abertura >= ini,
            Chamado.data_abertura <= fim_total,
            Chamado.deletado_em.is_(None)
        ).group_by(
            func.date(Chamado.data_abertura),
            Chamado.status
        ).all()

        idx: dict = {}
        for r in rows:
            idx.setdefault(str(r.data), {})[r.status] = r.qtd

        def _key(st): return st.lower().replace(" ","_").replace("í","i").replace("ú","u").replace("ó","o").replace("ã","a").replace("é","e").replace("ç","c")

        result = []
        current = ini
        while current <= fim_total:
            ds = current.strftime("%Y-%m-%d")
            row = {"dia": current.strftime("%a"), "data": ds}
            total = 0
            for st in all_statuses:
                count = idx.get(ds, {}).get(st, 0)
                row[_key(st)] = count
                total += count
            row["quantidade"] = total
            result.append(row)
            current += timedelta(days=1)
        return result

    @staticmethod
    def get_chamados_por_semana(db: Session, semanas: int = 4, statuses: list = None) -> list:
        from ti.models.chamado import Chamado
        from core.utils import now_brazil_naive
        from sqlalchemy import func
        agora = now_brazil_naive()
        all_statuses = statuses or ["Aberto", "Em atendimento", "Aguardando", "Concluído", "Expirado"]
        inicio_total = agora - timedelta(weeks=semanas)

        rows = db.query(
            func.date(Chamado.data_abertura).label("data"),
            Chamado.status,
            func.count(Chamado.id).label("qtd")
        ).filter(
            Chamado.data_abertura >= inicio_total,
            Chamado.deletado_em.is_(None)
        ).group_by(
            func.date(Chamado.data_abertura),
            Chamado.status
        ).all()

        # Indexar por data
        idx: dict = {}
        for r in rows:
            idx.setdefault(str(r.data), {})[r.status] = r.qtd

        def _key(st): return st.lower().replace(" ","_").replace("í","i").replace("ú","u").replace("ó","o").replace("ã","a").replace("é","e").replace("ç","c")

        result = []
        for i in range(semanas - 1, -1, -1):
            fim = agora - timedelta(weeks=i)
            ini = fim - timedelta(weeks=1)
            row = {"semana": ini.strftime("%d/%m")}
            total = 0
            counts: dict = {_key(st): 0 for st in all_statuses}
            # Somar dias dentro da semana
            d = ini
            while d < fim:
                ds = d.strftime("%Y-%m-%d")
                for st in all_statuses:
                    counts[_key(st)] += idx.get(ds, {}).get(st, 0)
                    total += idx.get(ds, {}).get(st, 0)
                d += timedelta(days=1)
            row.update(counts)
            row["quantidade"] = total
            result.append(row)
        return result

    @staticmethod
    def get_chamados_por_semana_periodo(db: Session, start_date: str, end_date: str, statuses: list = None) -> list:
        from ti.models.chamado import Chamado
        from sqlalchemy import func
        ini = datetime.strptime(start_date, "%Y-%m-%d")
        fim_total = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
        all_statuses = statuses or ["Aberto", "Em atendimento", "Aguardando", "Concluído", "Expirado"]

        rows = db.query(
            func.date(Chamado.data_abertura).label("data"),
            Chamado.status,
            func.count(Chamado.id).label("qtd")
        ).filter(
            Chamado.data_abertura >= ini,
            Chamado.data_abertura <= fim_total,
            Chamado.deletado_em.is_(None)
        ).group_by(
            func.date(Chamado.data_abertura),
            Chamado.status
        ).all()

        idx: dict = {}
        for r in rows:
            idx.setdefault(str(r.data), {})[r.status] = r.qtd

        def _key(st): return st.lower().replace(" ","_").replace("í","i").replace("ú","u").replace("ó","o").replace("ã","a").replace("é","e").replace("ç","c")

        result = []
        current = ini
        while current <= fim_total:
            prox = current + timedelta(weeks=1)
            row = {"semana": current.strftime("%d/%m")}
            total = 0
            counts: dict = {_key(st): 0 for st in all_statuses}
            d = current
            while d < prox and d <= fim_total:
                ds = d.strftime("%Y-%m-%d")
                for st in all_statuses:
                    v = idx.get(ds, {}).get(st, 0)
                    counts[_key(st)] += v
                    total += v
                d += timedelta(days=1)
            row.update(counts)
            row["quantidade"] = total
            result.append(row)
            current = prox
        return result

    @staticmethod
    def get_chamados_por_mes(db: Session, meses: int = 3, statuses: list = None) -> list:
        from ti.models.chamado import Chamado
        from core.utils import now_brazil_naive
        from sqlalchemy import func
        agora = now_brazil_naive()
        all_statuses = statuses or ["Aberto", "Em atendimento", "Aguardando", "Concluído", "Expirado"]
        primeiro_mes = (agora.replace(day=1) - timedelta(days=30 * (meses - 1))).replace(day=1)

        rows = db.query(
            func.date(Chamado.data_abertura).label("data"),
            Chamado.status,
            func.count(Chamado.id).label("qtd")
        ).filter(
            Chamado.data_abertura >= primeiro_mes,
            Chamado.deletado_em.is_(None)
        ).group_by(
            func.date(Chamado.data_abertura),
            Chamado.status
        ).all()

        idx: dict = {}
        for r in rows:
            idx.setdefault(str(r.data), {})[r.status] = r.qtd

        def _key(st): return st.lower().replace(" ","_").replace("í","i").replace("ú","u").replace("ó","o").replace("ã","a").replace("é","e").replace("ç","c")

        result = []
        for i in range(meses - 1, -1, -1):
            primeiro = (agora.replace(day=1) - timedelta(days=30 * i)).replace(day=1)
            fim = agora if i == 0 else (primeiro + timedelta(days=32)).replace(day=1)
            row = {"mes": primeiro.strftime("%b/%Y")}
            total = 0
            counts: dict = {_key(st): 0 for st in all_statuses}
            d = primeiro
            while d < fim:
                ds = d.strftime("%Y-%m-%d")
                for st in all_statuses:
                    v = idx.get(ds, {}).get(st, 0)
                    counts[_key(st)] += v
                    total += v
                d += timedelta(days=1)
            row.update(counts)
            row["quantidade"] = total
            result.append(row)
        return result

    @staticmethod
    def get_chamados_por_mes_periodo(db: Session, start_date: str, end_date: str, statuses: list = None) -> list:
        from ti.models.chamado import Chamado
        from sqlalchemy import func
        ini = datetime.strptime(start_date, "%Y-%m-%d").replace(day=1)
        fim_total = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59)
        all_statuses = statuses or ["Aberto", "Em atendimento", "Aguardando", "Concluído", "Expirado"]

        rows = db.query(
            func.date(Chamado.data_abertura).label("data"),
            Chamado.status,
            func.count(Chamado.id).label("qtd")
        ).filter(
            Chamado.data_abertura >= ini,
            Chamado.data_abertura <= fim_total,
            Chamado.deletado_em.is_(None)
        ).group_by(
            func.date(Chamado.data_abertura),
            Chamado.status
        ).all()

        idx: dict = {}
        for r in rows:
            idx.setdefault(str(r.data), {})[r.status] = r.qtd

        def _key(st): return st.lower().replace(" ","_").replace("í","i").replace("ú","u").replace("ó","o").replace("ã","a").replace("é","e").replace("ç","c")

        result = []
        current = ini
        while current <= fim_total:
            prox = (current + timedelta(days=32)).replace(day=1)
            row = {"mes": current.strftime("%b/%Y")}
            total = 0
            counts: dict = {_key(st): 0 for st in all_statuses}
            d = current
            while d < prox and d <= fim_total:
                ds = d.strftime("%Y-%m-%d")
                for st in all_statuses:
                    v = idx.get(ds, {}).get(st, 0)
                    counts[_key(st)] += v
                    total += v
                d += timedelta(days=1)
            row.update(counts)
            row["quantidade"] = total
            result.append(row)
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
