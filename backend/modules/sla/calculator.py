"""
Sistema de cálculo de SLA robusto
- Considera horas comerciais (08:00-18:00)
- Considera dias úteis (seg-sex)
- Considera feriados fixos e móveis
- Pausa automática em status: Aguardando, Em análise
- Conta SLA em: Aberto, Em atendimento
- Calcula ao encerrar: Concluído, Expirado
"""
from datetime import datetime, date, time, timedelta
from typing import List, Optional, Tuple, Dict
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
import logging

from .models import (
    Chamado, ConfiguracaoSLA, HorarioComercial, Feriado,
    PausaSLA, InfoSLAChamado, LogCalculoSLA
)
from .holidays import gerar_todos_feriados

logger = logging.getLogger("sla.calculator")

# Status que pausam automaticamente o SLA
STATUS_PAUSA = {"Aguardando", "Em análise"}

# Status que contam para SLA
STATUS_CONTA = {"Aberto", "Em atendimento"}

# Status finais (encerram o cálculo)
STATUS_FINAL = {"Concluído", "Expirado"}


class CalculadorSLA:
    """Calculadora de SLA com suporte a pausas automáticas e feriados"""
    
    def __init__(self, db: Session):
        self.db = db
        self._cache_feriados: Dict[int, List[date]] = {}
        self._cache_horarios: Optional[Dict[int, Tuple[time, time]]] = None
    
    # ==================== Cache e Carregamento ====================
    
    def _carregar_feriados(self, ano: int) -> List[date]:
        """Carrega feriados para um ano específico do banco"""
        if ano in self._cache_feriados:
            return self._cache_feriados[ano]
        
        feriados_db = self.db.query(Feriado.data).filter(
            and_(
                Feriado.ativo == True,
                func.extract('year', Feriado.data) == ano
            )
        ).all()
        
        feriados_list = [f.data for f in feriados_db]
        self._cache_feriados[ano] = feriados_list
        
        return feriados_list
    
    def _carregar_horarios_comerciais(self) -> Dict[int, Tuple[time, time]]:
        """Carrega horários comerciais por dia da semana"""
        if self._cache_horarios is not None:
            return self._cache_horarios
        
        horarios_db = self.db.query(HorarioComercial).filter(
            HorarioComercial.ativo == True
        ).all()
        
        horarios = {}
        for h in horarios_db:
            horarios[h.dia_semana] = (h.hora_inicio, h.hora_fim)
        
        # Padrão se não configurado
        if not horarios:
            for dia in range(5):  # seg-sex
                horarios[dia] = (time(8, 0), time(18, 0))
        
        self._cache_horarios = horarios
        return horarios
    
    def invalidar_cache(self):
        """Invalida cache de feriados e horários"""
        self._cache_feriados.clear()
        self._cache_horarios = None
    
    # ==================== Validação de Dias Úteis ====================
    
    def eh_dia_util(self, data: date) -> bool:
        """
        Verifica se é dia útil (não é fim de semana e não é feriado)
        
        Args:
            data: Data para verificar
        
        Returns:
            True se é dia útil, False caso contrário
        """
        # Verifica se é fim de semana (5=sab, 6=dom)
        if data.weekday() >= 5:
            return False
        
        # Verifica se é feriado
        feriados = self._carregar_feriados(data.year)
        return data not in feriados
    
    def obter_horario_comercial(self, data: date) -> Optional[Tuple[time, time]]:
        """
        Obtém horário comercial para um dia específico
        
        Args:
            data: Data para consultar
        
        Returns:
            Tupla (hora_inicio, hora_fim) ou None se não é dia útil
        """
        if not self.eh_dia_util(data):
            return None
        
        horarios = self._carregar_horarios_comerciais()
        dia_semana = data.weekday()
        
        return horarios.get(dia_semana, (time(8, 0), time(18, 0)))
    
    # ==================== Cálculo de Horas Úteis ====================
    
    def calcular_horas_uteis(
        self,
        data_inicio: datetime,
        data_fim: datetime
    ) -> float:
        """
        Calcula horas úteis entre duas datas (considerando horário comercial e dias úteis)
        
        Args:
            data_inicio: Data/hora inicial
            data_fim: Data/hora final
        
        Returns:
            Número de horas úteis
        """
        if data_inicio >= data_fim:
            return 0.0
        
        total_horas = 0.0
        current_date = data_inicio.date()
        current_time = data_inicio.time()
        
        while current_date <= data_fim.date():
            horario_comercial = self.obter_horario_comercial(current_date)
            
            if horario_comercial:  # É dia útil
                hora_inicio_comercial = horario_comercial[0]
                hora_fim_comercial = horario_comercial[1]
                
                # Ajusta tempo inicial se estiver antes do horário comercial
                if current_date == data_inicio.date():
                    tempo_inicio = max(current_time, hora_inicio_comercial)
                else:
                    tempo_inicio = hora_inicio_comercial
                
                # Ajusta tempo final se for depois do horário comercial
                if current_date == data_fim.date():
                    tempo_fim = min(data_fim.time(), hora_fim_comercial)
                else:
                    tempo_fim = hora_fim_comercial
                
                # Calcula horas do dia
                if tempo_inicio < tempo_fim:
                    dt_inicio = datetime.combine(current_date, tempo_inicio)
                    dt_fim = datetime.combine(current_date, tempo_fim)
                    horas_dia = (dt_fim - dt_inicio).total_seconds() / 3600
                    total_horas += horas_dia
            
            # Avança para próximo dia
            current_date += timedelta(days=1)
            current_time = time(0, 0)
        
        return total_horas
    
    # ==================== Gerenciamento de Pausas ====================
    
    def pausar_automaticamente(
        self,
        chamado_id: int,
        status_atual: str,
        data_mudanca: datetime
    ) -> Optional[PausaSLA]:
        """
        Pausa automaticamente o SLA se o status está em STATUS_PAUSA
        
        Args:
            chamado_id: ID do chamado
            status_atual: Status atual do chamado
            data_mudanca: Timestamp da mudança de status
        
        Returns:
            Pausa criada ou None
        """
        if status_atual not in STATUS_PAUSA:
            return None
        
        # Verifica se já existe pausa ativa
        pausa_ativa = self.db.query(PausaSLA).filter(
            and_(
                PausaSLA.chamado_id == chamado_id,
                PausaSLA.fim.is_(None)
            )
        ).first()
        
        if pausa_ativa:
            return pausa_ativa  # Já pausado
        
        # Cria pausa automática
        pausa = PausaSLA(
            chamado_id=chamado_id,
            inicio=data_mudanca,
            tipo="status",
            status_pausante=status_atual,
            motivo=f"Pausa automática - Status: {status_atual}"
        )
        
        self.db.add(pausa)
        self.db.flush()
        
        logger.info(f"SLA pausado automaticamente para chamado {chamado_id} (status: {status_atual})")
        return pausa
    
    def retomar_automaticamente(
        self,
        chamado_id: int,
        status_atual: str,
        data_mudanca: datetime
    ) -> bool:
        """
        Retoma automaticamente o SLA se o status sai de STATUS_PAUSA
        
        Args:
            chamado_id: ID do chamado
            status_atual: Status atual do chamado
            data_mudanca: Timestamp da mudança de status
        
        Returns:
            True se retomou, False caso contrário
        """
        if status_atual in STATUS_PAUSA:
            return False  # Não retoma se ainda está pausado
        
        pausa_ativa = self.db.query(PausaSLA).filter(
            and_(
                PausaSLA.chamado_id == chamado_id,
                PausaSLA.fim.is_(None)
            )
        ).first()
        
        if not pausa_ativa:
            return False  # Não tem pausa ativa
        
        # Retoma a pausa
        pausa_ativa.fim = data_mudanca
        duracao = (data_mudanca - pausa_ativa.inicio).total_seconds() / 3600
        pausa_ativa.duracao_horas = duracao
        
        self.db.flush()
        
        logger.info(f"SLA retomado para chamado {chamado_id} (duração pausa: {duracao:.2f}h)")
        return True
    
    def calcular_tempo_pausado(self, chamado_id: int) -> float:
        """
        Calcula total de horas pausadas (apenas pausas finalizadas)
        
        Args:
            chamado_id: ID do chamado
        
        Returns:
            Total de horas pausadas
        """
        pausas = self.db.query(PausaSLA).filter(
            and_(
                PausaSLA.chamado_id == chamado_id,
                PausaSLA.fim.isnot(None)  # Apenas pausas finalizadas
            )
        ).all()
        
        total_horas = sum(p.duracao_horas for p in pausas if p.duracao_horas)
        return total_horas
    
    def calcular_tempo_pausado_ativo(self, chamado_id: int) -> float:
        """
        Calcula horas de pausa ativa (em andamento)
        
        Args:
            chamado_id: ID do chamado
        
        Returns:
            Horas de pausa em andamento
        """
        pausa_ativa = self.db.query(PausaSLA).filter(
            and_(
                PausaSLA.chamado_id == chamado_id,
                PausaSLA.fim.is_(None)
            )
        ).first()
        
        if not pausa_ativa:
            return 0.0
        
        duracao = (datetime.utcnow() - pausa_ativa.inicio).total_seconds() / 3600
        return duracao
    
    # ==================== Cálculo de SLA ====================
    
    def obter_configuracao_sla(self, prioridade: str) -> Optional[ConfiguracaoSLA]:
        """Obtém configuração de SLA para uma prioridade"""
        return self.db.query(ConfiguracaoSLA).filter(
            and_(
                ConfiguracaoSLA.prioridade == prioridade,
                ConfiguracaoSLA.ativo == True
            )
        ).first()
    
    def calcular_sla(
        self,
        chamado: Chamado
    ) -> Dict:
        """
        Calcula informações de SLA completas para um chamado
        
        Args:
            chamado: Objeto Chamado
        
        Returns:
            Dicionário com informações de SLA
        """
        config = self.obter_configuracao_sla(chamado.prioridade)
        if not config:
            logger.warning(f"Sem configuração SLA para prioridade: {chamado.prioridade}")
            return self._criar_resultado_vazio()
        
        # Data final para cálculo
        if chamado.status in STATUS_FINAL:
            data_ref = chamado.data_conclusao or chamado.cancelado_em or datetime.utcnow()
        else:
            data_ref = datetime.utcnow()
        
        # ==================== Cálculo de Resposta ====================
        tempo_resposta_decorrido = 0.0
        tempo_resposta_pausado = 0.0
        percentual_resposta = 0.0
        resposta_em_risco = False
        resposta_vencida = False
        resposta_em_dia = True
        
        if not chamado.data_primeira_resposta:
            # Ainda não respondeu - calcula até agora
            tempo_resposta_decorrido = self.calcular_horas_uteis(
                chamado.data_abertura,
                data_ref
            )
            tempo_resposta_pausado = self.calcular_tempo_pausado(chamado.id)
            
            tempo_efetivo = max(0, tempo_resposta_decorrido - tempo_resposta_pausado)
            percentual_resposta = (tempo_efetivo / config.tempo_resposta_horas * 100) if config.tempo_resposta_horas > 0 else 0
            
            resposta_vencida = tempo_efetivo >= config.tempo_resposta_horas
            resposta_em_risco = percentual_resposta >= config.percentual_risco and not resposta_vencida
            resposta_em_dia = not resposta_vencida and not resposta_em_risco
        
        # ==================== Cálculo de Resolução ====================
        tempo_resolucao_decorrido = self.calcular_horas_uteis(
            chamado.data_abertura,
            data_ref
        )
        tempo_resolucao_pausado = self.calcular_tempo_pausado(chamado.id)
        
        tempo_efetivo_resolucao = max(0, tempo_resolucao_decorrido - tempo_resolucao_pausado)
        percentual_resolucao = (tempo_efetivo_resolucao / config.tempo_resolucao_horas * 100) if config.tempo_resolucao_horas > 0 else 0
        
        # Só marca como vencido/risco se ainda está aberto
        resolucao_vencida = False
        resolucao_em_risco = False
        resolucao_em_dia = True
        
        if chamado.status not in STATUS_FINAL:
            resolucao_vencida = tempo_efetivo_resolucao >= config.tempo_resolucao_horas
            resolucao_em_risco = percentual_resolucao >= config.percentual_risco and not resolucao_vencida
            resolucao_em_dia = not resolucao_vencida and not resolucao_em_risco
        
        # Status de pausa
        pausado = chamado.status in STATUS_PAUSA
        ativo = chamado.status in STATUS_CONTA
        
        return {
            "tempo_resposta_limite_horas": config.tempo_resposta_horas,
            "tempo_resposta_decorrido_horas": round(tempo_resposta_decorrido, 2),
            "tempo_resposta_pausado_horas": round(tempo_resposta_pausado, 2),
            "percentual_resposta": round(percentual_resposta, 2),
            "resposta_em_risco": resposta_em_risco,
            "resposta_vencida": resposta_vencida,
            "resposta_em_dia": resposta_em_dia,
            
            "tempo_resolucao_limite_horas": config.tempo_resolucao_horas,
            "tempo_resolucao_decorrido_horas": round(tempo_resolucao_decorrido, 2),
            "tempo_resolucao_pausado_horas": round(tempo_resolucao_pausado, 2),
            "percentual_resolucao": round(percentual_resolucao, 2),
            "resolucao_em_risco": resolucao_em_risco,
            "resolucao_vencida": resolucao_vencida,
            "resolucao_em_dia": resolucao_em_dia,
            
            "pausado": pausado,
            "ativo": ativo,
        }
    
    def _criar_resultado_vazio(self) -> Dict:
        """Cria resultado vazio quando não há configuração"""
        return {
            "tempo_resposta_limite_horas": 0,
            "tempo_resposta_decorrido_horas": 0.0,
            "tempo_resposta_pausado_horas": 0.0,
            "percentual_resposta": 0.0,
            "resposta_em_risco": False,
            "resposta_vencida": False,
            "resposta_em_dia": True,
            
            "tempo_resolucao_limite_horas": 0,
            "tempo_resolucao_decorrido_horas": 0.0,
            "tempo_resolucao_pausado_horas": 0.0,
            "percentual_resolucao": 0.0,
            "resolucao_em_risco": False,
            "resolucao_vencida": False,
            "resolucao_em_dia": True,
            
            "pausado": False,
            "ativo": False,
        }
    
    # ==================== Atualização em Lote ====================
    
    def recalcular_todos(self) -> Dict:
        """
        Recalcula SLA para todos os chamados ativos
        
        Returns:
            Dicionário com estatísticas
        """
        inicio = datetime.utcnow()
        
        chamados = self.db.query(Chamado).filter(
            Chamado.deletado_em.is_(None)
        ).all()
        
        stats = {
            "total_processados": len(chamados),
            "em_risco": 0,
            "vencidos": 0,
            "pausados": 0,
            "tempo_ms": 0
        }
        
        for chamado in chamados:
            resultado = self.calcular_sla(chamado)
            
            # Atualiza ou cria InfoSLAChamado
            info = self.db.query(InfoSLAChamado).filter(
                InfoSLAChamado.chamado_id == chamado.id
            ).first()
            
            if not info:
                info = InfoSLAChamado(chamado_id=chamado.id)
                self.db.add(info)
            
            # Atualiza campos
            for key, value in resultado.items():
                if hasattr(info, key):
                    setattr(info, key, value)
            
            info.ultima_atualizacao = datetime.utcnow()
            
            # Conta estatísticas
            if resultado["pausado"]:
                stats["pausados"] += 1
            if resultado["resolucao_em_risco"]:
                stats["em_risco"] += 1
            if resultado["resolucao_vencida"]:
                stats["vencidos"] += 1
        
        self.db.commit()
        
        # Log
        tempo_ms = int((datetime.utcnow() - inicio).total_seconds() * 1000)
        stats["tempo_ms"] = tempo_ms
        
        log = LogCalculoSLA(
            tipo="batch",
            chamados_processados=stats["total_processados"],
            tempo_execucao_ms=tempo_ms,
            chamados_em_risco=stats["em_risco"],
            chamados_vencidos=stats["vencidos"],
            chamados_pausados=stats["pausados"],
            sucesso=True
        )
        self.db.add(log)
        self.db.commit()
        
        logger.info(f"Recálculo em lote concluído: {stats['total_processados']} chamados em {tempo_ms}ms")
        
        return stats
