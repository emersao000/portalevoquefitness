"""
ServicoMetricasSLA - Cálculo de SLA com horas úteis
- Horário comercial: 08:00-18:00, seg-sex
- Pausa automática quando status == 'Aguardando'
- Contabiliza apenas chamados abertos >= 16/02/2026

OTIMIZAÇÕES (v2):
- Pausas e configs carregadas em BULK (uma query cada) ao invés de N+1
- Cache TTL no endpoint (ver router.py)
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

_HORAS_DIA_UTIL = 10.0  # 08:00-18:00


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
    fim_date = fim.date()

    # Mesmo dia
    if current == fim_date:
        if _eh_dia_util(current):
            j_ini = max(datetime.combine(current, HORA_INICIO), inicio)
            j_fim = min(datetime.combine(current, HORA_FIM), fim)
            if j_ini < j_fim:
                total += (j_fim - j_ini).total_seconds() / 3600
        return round(total, 4)

    # Primeiro dia (parcial)
    if _eh_dia_util(current):
        j_ini = max(datetime.combine(current, HORA_INICIO), inicio)
        j_fim = datetime.combine(current, HORA_FIM)
        if j_ini < j_fim:
            total += (j_fim - j_ini).total_seconds() / 3600
    current += timedelta(days=1)

    # Dias do meio — pula semanas inteiras para performance
    while current < fim_date:
        remaining = (fim_date - current).days
        if remaining >= 7:
            full_weeks = remaining // 7
            # Conta dias úteis por semana: sempre 5 (seg-sex)
            total += full_weeks * 5 * _HORAS_DIA_UTIL
            current += timedelta(weeks=full_weeks)
        else:
            if _eh_dia_util(current):
                total += _HORAS_DIA_UTIL
            current += timedelta(days=1)

    # Último dia (parcial)
    if current == fim_date and _eh_dia_util(current):
        j_ini = datetime.combine(current, HORA_INICIO)
        j_fim = min(datetime.combine(current, HORA_FIM), fim)
        if j_ini < j_fim:
            total += (j_fim - j_ini).total_seconds() / 3600

    return round(total, 4)


def _horas_uteis_com_pausas(inicio: datetime, fim: datetime, pausas: List[Tuple], now: Optional[datetime] = None) -> Tuple[float, float]:
    bruto = _horas_uteis(inicio, fim)
    pausado = 0.0
    _now = now or datetime.utcnow()
    for p_ini, p_fim in pausas:
        p_fim_real = p_fim or _now
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
    if dt is not None and dt.tzinfo is not None:
        return dt.replace(tzinfo=None)
    return dt


class ServicoMetricasSLA:

    def __init__(self, db: Session):
        self.db = db
        self._configs_cache: Optional[Dict] = None  # Cache de configs por instância

    def _configs(self) -> Dict[str, Dict]:
        """Carregado UMA única vez por instância (cache de instância)."""
        if self._configs_cache is not None:
            return self._configs_cache
        from modules.sla.models import ConfiguracaoSLA
        configs = self.db.query(ConfiguracaoSLA).filter(ConfiguracaoSLA.ativo == True).all()
        self._configs_cache = {
            c.prioridade.lower(): {
                "resposta": c.tempo_resposta_horas,
                "resolucao": c.tempo_resolucao_horas,
                "risco": c.percentual_risco
            }
            for c in configs
        }
        return self._configs_cache

    def _pausas(self, chamado_id: int) -> List[Tuple]:
        """Busca pausas de UM chamado. Para múltiplos, use _pausas_bulk()."""
        try:
            from ti.models.sla_pausa import SLAPausa
            pausas = self.db.query(SLAPausa).filter(SLAPausa.chamado_id == chamado_id).all()
            return [(p.inicio, p.fim) for p in pausas]
        except Exception:
            return []

    def _pausas_bulk(self, chamado_ids: List[int]) -> Dict[int, List[Tuple]]:
        """
        Carrega pausas de TODOS os chamados em UMA única query (elimina N+1).
        Retorna dict: chamado_id -> lista de (inicio, fim)
        """
        if not chamado_ids:
            return {}
        try:
            from ti.models.sla_pausa import SLAPausa
            pausas = self.db.query(SLAPausa).filter(
                SLAPausa.chamado_id.in_(chamado_ids)
            ).all()
            resultado: Dict[int, List[Tuple]] = {}
            for p in pausas:
                resultado.setdefault(p.chamado_id, []).append((p.inicio, p.fim))
            return resultado
        except Exception:
            return {}

    def calcular_sla_chamado(self, chamado, now: Optional[datetime] = None) -> Optional[Dict]:
        """Calcula SLA de um único chamado (faz queries individuais). Para bulk, o loop em obter_metricas_dashboard já usa _calcular_sla_preloaded."""
        if not chamado.data_abertura:
            return None
        if chamado.data_abertura < SLA_DATA_INICIO:
            return None
        configs = self._configs()
        pausas = self._pausas(chamado.id)
        return self._calcular_sla_preloaded(chamado, configs, pausas, now)

    def _calcular_sla_preloaded(
        self,
        chamado,
        configs: Dict,
        pausas: List[Tuple],
        now: Optional[datetime] = None
    ) -> Optional[Dict]:
        """
        Versão sem queries: recebe configs e pausas já carregados.
        Usada pelo loop bulk em obter_metricas_dashboard.
        """
        if not chamado.data_abertura:
            return None
        if chamado.data_abertura < SLA_DATA_INICIO:
            return None

        key = (chamado.prioridade or "normal").lower()
        cfg = configs.get(key) or configs.get("normal")
        if not cfg:
            return None

        lim_resp = cfg["resposta"]
        lim_res = cfg["resolucao"]
        pct_risco = cfg.get("risco", 80)

        _now = now or datetime.utcnow()
        status = chamado.status or "Aberto"
        pausado = status in STATUS_PAUSADOS

        if status in STATUS_FINAIS:
            data_ref = chamado.data_conclusao or chamado.cancelado_em or _now
        else:
            data_ref = _now

        # Resolução
        res_trab, res_paus = _horas_uteis_com_pausas(chamado.data_abertura, data_ref, pausas, now=_now)
        pct_res = round(res_trab / lim_res * 100, 1) if lim_res > 0 else 0
        res_venc = res_trab >= lim_res and status not in STATUS_FINAIS
        res_risco = pct_res >= pct_risco and not res_venc and status not in STATUS_FINAIS

        # Resposta
        if chamado.data_primeira_resposta:
            resp_trab, resp_paus = _horas_uteis_com_pausas(chamado.data_abertura, chamado.data_primeira_resposta, pausas, now=_now)
            pct_resp = round(resp_trab / lim_resp * 100, 1) if lim_resp > 0 else 0
            resp_venc = resp_trab > lim_resp
            resp_risco = False
        else:
            resp_trab, resp_paus = _horas_uteis_com_pausas(chamado.data_abertura, data_ref, pausas, now=_now)
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

        # ✅ Captura instante UMA vez para toda a requisição
        _now = datetime.utcnow()

        data_inicio = _normalizar_datetime(data_inicio)
        data_fim = _normalizar_datetime(data_fim)

        if not data_fim:
            data_fim = _now
        if not data_inicio:
            data_inicio = max(data_fim - timedelta(days=30), SLA_DATA_INICIO)
        else:
            data_inicio = max(data_inicio, SLA_DATA_INICIO)

        # ── QUERY 1: Chamados relevantes ──────────────────────────────────────
        chamados = self.db.query(Chamado).filter(
            and_(
                Chamado.data_abertura >= SLA_DATA_INICIO,
                Chamado.deletado_em.is_(None),
                or_(
                    Chamado.status.in_(list(STATUS_ATIVOS | STATUS_PAUSADOS)),
                    and_(
                        Chamado.status.in_(list(STATUS_FINAIS)),
                        Chamado.data_abertura >= data_inicio,
                        Chamado.data_abertura <= data_fim,
                    )
                )
            )
        ).all()

        if not chamados:
            return self._resultado_vazio(data_inicio, data_fim, _now)

        # ── QUERY 2: Pausas de TODOS os chamados de uma vez (elimina N+1) ────
        chamado_ids = [c.id for c in chamados]
        pausas_por_chamado = self._pausas_bulk(chamado_ids)

        # ── QUERY 3: Configs SLA (cacheada na instância) ─────────────────────
        configs = self._configs()

        # ── Loop de cálculo SEM queries adicionais ────────────────────────────
        em_risco, vencidos, pausados_list, processados = [], [], [], []
        soma_resp = soma_res = cnt_resp = cnt_res = 0.0

        for c in chamados:
            pausas_c = pausas_por_chamado.get(c.id, [])
            s = self._calcular_sla_preloaded(c, configs, pausas_c, _now)
            if not s:
                continue
            processados.append(s)
            if s["pausado"]:
                pausados_list.append(s)
            elif s["resolucao_vencida"]:
                vencidos.append(s)
            elif s["resolucao_em_risco"]:
                em_risco.append(s)

            if c.data_primeira_resposta and s["resposta_trabalhado_horas"] > 0:
                soma_resp += s["resposta_trabalhado_horas"]
                cnt_resp += 1
            elif c.data_primeira_resposta and s["resposta_trabalhado_horas"] <= 0:
                horas_resp = max(
                    (c.data_primeira_resposta - c.data_abertura).total_seconds() / 3600,
                    0.017
                )
                soma_resp += horas_resp
                cnt_resp += 1

            if c.status == "Concluído":
                horas_res = s["resolucao_trabalhado_horas"]
                if horas_res <= 0 and c.data_conclusao and c.data_abertura:
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
        pct_risco_pct = round(len(em_risco) / total * 100, 1) if total > 0 else 0
        pct_venc = round(len(vencidos) / total * 100, 1) if total > 0 else 0

        med_resp = soma_resp / cnt_resp if cnt_resp > 0 else 0
        med_res = soma_res / cnt_res if cnt_res > 0 else 0

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
            "chamados_pausados": len(pausados_list),
            "percentual_cumprimento": pct_cum,
            "percentual_em_risco": pct_risco_pct,
            "percentual_vencidos": pct_venc,
            "tempo_medio_resposta_horas": round(med_resp, 2),
            "tempo_medio_resolucao_horas": round(med_res, 2),
            "tempo_medio_resposta_formatado": _formatar(med_resp),
            "tempo_medio_resolucao_formatado": _formatar(med_res),
            "por_prioridade": por_prioridade,
            "lista_em_risco": em_risco[:50],
            "lista_vencidos": vencidos[:50],
            "lista_pausados": pausados_list[:50],
            "periodo_inicio": data_inicio.isoformat(),
            "periodo_fim": data_fim.isoformat(),
            "sla_data_inicio": SLA_DATA_INICIO.isoformat(),
            "ultima_atualizacao": _now.isoformat(),
        }

    def _resultado_vazio(self, data_inicio, data_fim, _now) -> Dict:
        return {
            "total_chamados": 0, "chamados_abertos": 0, "chamados_em_risco": 0,
            "chamados_vencidos": 0, "chamados_pausados": 0,
            "percentual_cumprimento": 0, "percentual_em_risco": 0, "percentual_vencidos": 0,
            "tempo_medio_resposta_horas": 0, "tempo_medio_resolucao_horas": 0,
            "tempo_medio_resposta_formatado": "—", "tempo_medio_resolucao_formatado": "—",
            "por_prioridade": [], "lista_em_risco": [], "lista_vencidos": [], "lista_pausados": [],
            "periodo_inicio": data_inicio.isoformat(), "periodo_fim": data_fim.isoformat(),
            "sla_data_inicio": SLA_DATA_INICIO.isoformat(), "ultima_atualizacao": _now.isoformat(),
        }
