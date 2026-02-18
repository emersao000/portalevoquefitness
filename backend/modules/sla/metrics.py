"""
ServicoMetricasSLA - Cálculo de SLA com horas úteis
- Horário comercial: 08:00-18:00, seg-sex
- Pausa automática quando status == 'Aguardando'
- Contabiliza apenas chamados abertos >= 16/02/2026
"""
from datetime import datetime, timedelta, time, date, timezone
from typing import List, Optional, Dict, Tuple
from sqlalchemy.orm import Session

SLA_DATA_INICIO = datetime(2026, 2, 16, 0, 0, 0)
HORA_INICIO = time(8, 0)
HORA_FIM = time(18, 0)
STATUS_PAUSADOS = {"Aguardando"}
STATUS_ATIVOS = {"Aberto", "Em atendimento"}
STATUS_FINAIS = {"Concluído", "Expirado"}


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
    return round(total, 4)


def _horas_uteis_com_pausas(inicio: datetime, fim: datetime, pausas: List[Tuple]) -> Tuple[float, float]:
    bruto = _horas_uteis(inicio, fim)
    pausado = 0.0
    for p_ini, p_fim in pausas:
        p_fim_real = p_fim or datetime.utcnow()
        i2 = max(p_ini, inicio)
        f2 = min(p_fim_real, fim)
        if i2 < f2:
            pausado += _horas_uteis(i2, f2)
    return round(max(0, bruto - pausado), 4), round(pausado, 4)


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


def _normalizar_datetime(dt: Optional[datetime]) -> Optional[datetime]:
    """Remove timezone info para manter consistência com datetimes naive do sistema."""
    if dt is not None and dt.tzinfo is not None:
        return dt.replace(tzinfo=None)
    return dt


class ServicoMetricasSLA:

    def __init__(self, db: Session):
        self.db = db

    def _configs(self) -> Dict[str, Dict]:
        from modules.sla.models import ConfiguracaoSLA
        configs = self.db.query(ConfiguracaoSLA).filter(ConfiguracaoSLA.ativo == True).all()
        return {
            c.prioridade.lower(): {
                "resposta": c.tempo_resposta_horas,
                "resolucao": c.tempo_resolucao_horas,
                "risco": c.percentual_risco
            }
            for c in configs
        }

    def _pausas(self, chamado_id: int) -> List[Tuple]:
        try:
            from ti.models.sla_pausa import SLAPausa
            pausas = self.db.query(SLAPausa).filter(SLAPausa.chamado_id == chamado_id).all()
            return [(p.inicio, p.fim) for p in pausas]
        except Exception:
            return []

    def calcular_sla_chamado(self, chamado) -> Optional[Dict]:
        if not chamado.data_abertura:
            return None
        if chamado.data_abertura < SLA_DATA_INICIO:
            return None

        configs = self._configs()
        key = (chamado.prioridade or "normal").lower()
        cfg = configs.get(key) or configs.get("normal")
        if not cfg:
            return None

        lim_resp = cfg["resposta"]
        lim_res = cfg["resolucao"]
        pct_risco = cfg.get("risco", 80)

        pausas = self._pausas(chamado.id)
        status = chamado.status or "Aberto"
        pausado = status in STATUS_PAUSADOS

        data_ref = chamado.data_conclusao or chamado.cancelado_em or datetime.utcnow()
        if status not in STATUS_FINAIS:
            data_ref = datetime.utcnow()

        # Resolução
        res_trab, res_paus = _horas_uteis_com_pausas(chamado.data_abertura, data_ref, pausas)
        pct_res = round(res_trab / lim_res * 100, 1) if lim_res > 0 else 0
        res_venc = res_trab >= lim_res and status not in STATUS_FINAIS
        res_risco = pct_res >= pct_risco and not res_venc and status not in STATUS_FINAIS

        # Resposta
        if chamado.data_primeira_resposta:
            resp_trab, resp_paus = _horas_uteis_com_pausas(chamado.data_abertura, chamado.data_primeira_resposta, pausas)
            pct_resp = round(resp_trab / lim_resp * 100, 1) if lim_resp > 0 else 0
            resp_venc = resp_trab > lim_resp
            resp_risco = False
        else:
            resp_trab, resp_paus = _horas_uteis_com_pausas(chamado.data_abertura, data_ref, pausas)
            pct_resp = round(resp_trab / lim_resp * 100, 1) if lim_resp > 0 else 0
            resp_venc = resp_trab >= lim_resp and status not in STATUS_FINAIS
            resp_risco = pct_resp >= pct_risco and not resp_venc and status not in STATUS_FINAIS

        return {
            "chamado_id": chamado.id,
            "codigo": chamado.codigo,
            "prioridade": chamado.prioridade,
            "status": status,
            "pausado": pausado,
            "ativo": status in STATUS_ATIVOS,
            "resolucao_trabalhado_horas": res_trab,
            "resolucao_pausado_horas": res_paus,
            "resolucao_limite_horas": lim_res,
            "percentual_resolucao": pct_res,
            "resolucao_em_dia": not res_venc and not res_risco,
            "resolucao_em_risco": res_risco,
            "resolucao_vencida": res_venc,
            "resposta_trabalhado_horas": resp_trab,
            "resposta_pausado_horas": resp_paus,
            "resposta_limite_horas": lim_resp,
            "percentual_resposta": pct_resp,
            "resposta_em_dia": not resp_venc and not resp_risco,
            "resposta_em_risco": resp_risco,
            "resposta_vencida": resp_venc,
        }

    def obter_metricas_dashboard(
        self,
        data_inicio: Optional[datetime] = None,
        data_fim: Optional[datetime] = None
    ) -> Dict:
        from ti.models.chamado import Chamado
        from sqlalchemy import and_, or_

        # ✅ Normalizar: remover timezone se vier com offset (ex: "Z" do frontend)
        data_inicio = _normalizar_datetime(data_inicio)
        data_fim = _normalizar_datetime(data_fim)

        if not data_fim:
            data_fim = datetime.utcnow()
        if not data_inicio:
            data_inicio = max(data_fim - timedelta(days=30), SLA_DATA_INICIO)
        else:
            data_inicio = max(data_inicio, SLA_DATA_INICIO)

        # Inclui:
        # 1. Chamados abertos/em atendimento >= SLA_DATA_INICIO (independente do período filtrado)
        # 2. Chamados concluídos/expirados dentro do período filtrado
        chamados = self.db.query(Chamado).filter(
            and_(
                Chamado.data_abertura >= SLA_DATA_INICIO,
                Chamado.deletado_em.is_(None),
                or_(
                    # Ativos: sempre incluídos
                    Chamado.status.in_(list(STATUS_ATIVOS | STATUS_PAUSADOS)),
                    # Finalizados: só do período filtrado
                    and_(
                        Chamado.status.in_(list(STATUS_FINAIS)),
                        Chamado.data_abertura >= data_inicio,
                        Chamado.data_abertura <= data_fim,
                    )
                )
            )
        ).all()

        em_risco, vencidos, pausados, processados = [], [], [], []
        soma_resp = soma_res = cnt_resp = cnt_res = 0.0

        for c in chamados:
            s = self.calcular_sla_chamado(c)
            if not s:
                continue
            processados.append(s)
            if s["pausado"]:
                pausados.append(s)
            elif s["resolucao_vencida"]:
                vencidos.append(s)
            elif s["resolucao_em_risco"]:
                em_risco.append(s)
            if c.data_primeira_resposta and s["resposta_trabalhado_horas"] > 0:
                soma_resp += s["resposta_trabalhado_horas"]
                cnt_resp += 1
            elif c.data_primeira_resposta and s["resposta_trabalhado_horas"] <= 0:
                # Fallback: primeira resposta fora do horário comercial → usa tempo real
                horas_resp = max(
                    (c.data_primeira_resposta - c.data_abertura).total_seconds() / 3600,
                    0.017
                )
                soma_resp += horas_resp
                cnt_resp += 1
            # Resolução: conta chamados Concluídos
            if c.status == "Concluído":
                horas_res = s["resolucao_trabalhado_horas"]
                if horas_res <= 0 and c.data_conclusao and c.data_abertura:
                    # Fallback: tempo real em horas (mínimo 1 minuto = 0.017h)
                    horas_res = max(
                        (c.data_conclusao - c.data_abertura).total_seconds() / 3600,
                        0.017
                    )
                if horas_res > 0:
                    soma_res += horas_res
                    cnt_res += 1

        total = len(processados)
        em_dia = total - len(em_risco) - len(vencidos)
        pct_cum = round(em_dia / total * 100, 1) if total > 0 else 0
        pct_risco = round(len(em_risco) / total * 100, 1) if total > 0 else 0
        pct_venc = round(len(vencidos) / total * 100, 1) if total > 0 else 0

        med_resp = soma_resp / cnt_resp if cnt_resp > 0 else 0
        med_res = soma_res / cnt_res if cnt_res > 0 else 0

        # Métricas por prioridade
        prio_map: Dict[str, dict] = {}
        for s in processados:
            p = s["prioridade"] or "Normal"
            if p not in prio_map:
                prio_map[p] = {"prioridade": p, "total": 0, "em_risco": 0, "vencidos": 0, "pausados": 0}
            prio_map[p]["total"] += 1
            if s["pausado"]:
                prio_map[p]["pausados"] += 1
            if s["resolucao_em_risco"]:
                prio_map[p]["em_risco"] += 1
            if s["resolucao_vencida"]:
                prio_map[p]["vencidos"] += 1

        por_prioridade = [
            {**v,
             "percentual_em_risco": round(v["em_risco"] / v["total"] * 100, 1) if v["total"] > 0 else 0,
             "percentual_vencidos": round(v["vencidos"] / v["total"] * 100, 1) if v["total"] > 0 else 0}
            for v in prio_map.values()
        ]

        return {
            "total_chamados": total,
            "chamados_abertos": sum(1 for c in chamados if c.status in STATUS_ATIVOS | STATUS_PAUSADOS),
            "chamados_em_risco": len(em_risco),
            "chamados_vencidos": len(vencidos),
            "chamados_pausados": len(pausados),
            "percentual_cumprimento": pct_cum,
            "percentual_em_risco": pct_risco,
            "percentual_vencidos": pct_venc,
            "tempo_medio_resposta_horas": round(med_resp, 2),
            "tempo_medio_resolucao_horas": round(med_res, 2),
            "tempo_medio_resposta_formatado": _formatar(med_resp),
            "tempo_medio_resolucao_formatado": _formatar(med_res),
            "por_prioridade": por_prioridade,
            "lista_em_risco": em_risco[:50],
            "lista_vencidos": vencidos[:50],
            "lista_pausados": pausados[:50],
            "periodo_inicio": data_inicio.isoformat(),
            "periodo_fim": data_fim.isoformat(),
            "sla_data_inicio": SLA_DATA_INICIO.isoformat(),
            "ultima_atualizacao": datetime.utcnow().isoformat(),
        }