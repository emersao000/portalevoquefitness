"""Repositório para acesso a dados de SLA"""

from datetime import datetime, timedelta
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from .models import ConfiguracaoSLA, Feriado, LogCalculoSLA, HorarioComercial
from .schemas import PausaSLACreate
try:
    from ti.models.sla_pausa import SLAPausa
except ImportError:
    SLAPausa = None


class SlaRepository:
    """Repositório para operações de SLA"""
    
    def __init__(self, db: Session):
        self.db = db
    
    # ========== Configurações ==========
    
    def obter_config_por_prioridade(self, prioridade: str) -> Optional[ConfiguracaoSLA]:
        """Obtém configuração de SLA por prioridade"""
        return self.db.query(ConfiguracaoSLA).filter(
            ConfiguracaoSLA.prioridade == prioridade.lower(),
            ConfiguracaoSLA.ativo == True
        ).first()
    
    def obter_todas_configs(self) -> List[ConfiguracaoSLA]:
        """Obtém todas as configurações ativas"""
        return self.db.query(ConfiguracaoSLA).filter(
            ConfiguracaoSLA.ativo == True
        ).all()
    
    def criar_config(self, prioridade: str, tempo_resposta: float, tempo_resolucao: float) -> ConfiguracaoSLA:
        """Cria uma nova configuração de SLA"""
        config = ConfiguracaoSLA(
            prioridade=prioridade.lower(),
            tempo_resposta_horas=tempo_resposta,
            tempo_resolucao_horas=tempo_resolucao
        )
        self.db.add(config)
        self.db.commit()
        self.db.refresh(config)
        return config
    
    # ========== Feriados ==========
    
    def obter_feriados_ativo(self) -> List[Feriado]:
        """Obtém todos os feriados ativos"""
        return self.db.query(Feriado).filter(
            Feriado.ativo == True
        ).all()
    
    def obter_feriados_entre(self, data_inicio: datetime, data_fim: datetime) -> List[Feriado]:
        """Obtém feriados entre duas datas"""
        return self.db.query(Feriado).filter(
            and_(
                Feriado.data >= data_inicio,
                Feriado.data <= data_fim,
                Feriado.ativo == True
            )
        ).all()
    
    def criar_feriado(self, data: datetime, nome: str, descricao: str = None) -> Feriado:
        """Cria um novo feriado"""
        feriado = Feriado(
            data=data,
            nome=nome,
            descricao=descricao
        )
        self.db.add(feriado)
        self.db.commit()
        self.db.refresh(feriado)
        return feriado
    
    # ========== Pausas ==========
    
    def obter_pausas_chamado(self, chamado_id: int) -> List[SLAPausa]:
        """Obtém todas as pausas de um chamado"""
        return self.db.query(SLAPausa).filter(
            SLAPausa.chamado_id == chamado_id
        ).order_by(SLAPausa.pausado_em).all()
    
    def obter_pausas_ativas_chamado(self, chamado_id: int) -> List[SLAPausa]:
        """Obtém pausas ativas de um chamado"""
        return self.db.query(SLAPausa).filter(
            and_(
                SLAPausa.chamado_id == chamado_id,
                SLAPausa.ativa == True
            )
        ).all()
    
    def criar_pausa(self, pausa_data: PausaSLACreate, usuario_id: Optional[int] = None) -> SLAPausa:
        """Cria uma nova pausa de SLA"""
        pausa = SLAPausa(
            chamado_id=pausa_data.chamado_id,
            pausado_em=pausa_data.pausado_em,
            motivo=pausa_data.motivo,
            criado_por_id=usuario_id
        )
        self.db.add(pausa)
        self.db.commit()
        self.db.refresh(pausa)
        return pausa
    
    def retiomar_pausa(self, pausa_id: int, retomado_em: datetime = None) -> Optional[SLAPausa]:
        """Retoma uma pausa (marcando como finalizada)"""
        pausa = self.db.query(SLAPausa).filter(SLAPausa.id == pausa_id).first()
        if pausa:
            pausa.retomado_em = retomado_em or datetime.now()
            pausa.ativa = False
            pausa.duracao_minutos = pausa.calcular_duracao()
            self.db.commit()
            self.db.refresh(pausa)
        return pausa
    
    def pausar_automaticamente_se_necessario(self, chamado_id: int, status: str) -> Optional[SLAPausa]:
        """Pausa automaticamente se status é 'Em análise'"""
        if status.lower() != "em análise":
            return None
        
        # Verifica se já tem pausa ativa
        pausas_ativas = self.obter_pausas_ativas_chamado(chamado_id)
        if pausas_ativas:
            return pausas_ativas[0]  # Já tem pausa ativa
        
        # Cria nova pausa
        pausa_data = PausaSLACreate(
            chamado_id=chamado_id,
            pausado_em=datetime.now(),
            motivo="Em análise"
        )
        return self.criar_pausa(pausa_data)
    
    def retomar_pausas_se_necessario(self, chamado_id: int, status: str) -> List[SLAPausa]:
        """Retoma pausas se status mudou de 'Em análise'"""
        if status.lower() == "em análise":
            return []
        
        pausas_ativas = self.obter_pausas_ativas_chamado(chamado_id)
        retomadas = []
        
        for pausa in pausas_ativas:
            self.retiomar_pausa(pausa.id)
            retomadas.append(pausa)
        
        return retomadas
    
    # ========== Logs ==========
    
    def registrar_calculo(
        self,
        calculation_type: str,
        chamados_count: int,
        execution_time_ms: float,
        success: bool = True,
        error_message: str = None
    ) -> LogCalculoSLA:
        """Registra um cálculo de SLA"""
        log = LogCalculoSLA(
            calculation_type=calculation_type,
            chamados_count=chamados_count,
            execution_time_ms=execution_time_ms,
            success=success,
            error_message=error_message
        )
        self.db.add(log)
        self.db.commit()
        self.db.refresh(log)
        return log
    
    def obter_ultimos_logs(self, limit: int = 10) -> List[LogCalculoSLA]:
        """Obtém últimos logs de cálculo"""
        return self.db.query(LogCalculoSLA).order_by(
            LogCalculoSLA.created_at.desc()
        ).limit(limit).all()
