"""
Schemas Pydantic para validação de dados do módulo SLA
"""
from datetime import datetime, date, time
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator


# ==================== Configuração de SLA ====================
class ConfiguracaoSLABase(BaseModel):
    prioridade: str = Field(..., min_length=1, max_length=50)
    tempo_resposta_horas: float = Field(..., gt=0)
    tempo_resolucao_horas: float = Field(..., gt=0)
    percentual_risco: float = Field(default=80.0, ge=0, le=100)
    considera_horario_comercial: bool = True
    considera_feriados: bool = True
    escalar_automaticamente: bool = False
    notificar_em_risco: bool = True
    descricao: Optional[str] = None
    ativo: bool = True


class ConfiguracaoSLACreate(ConfiguracaoSLABase):
    pass


class ConfiguracaoSLAUpdate(BaseModel):
    tempo_resposta_horas: Optional[float] = Field(None, gt=0)
    tempo_resolucao_horas: Optional[float] = Field(None, gt=0)
    percentual_risco: Optional[float] = Field(None, ge=0, le=100)
    considera_horario_comercial: Optional[bool] = None
    considera_feriados: Optional[bool] = None
    escalar_automaticamente: Optional[bool] = None
    notificar_em_risco: Optional[bool] = None
    descricao: Optional[str] = None
    ativo: Optional[bool] = None


class ConfiguracaoSLAResponse(ConfiguracaoSLABase):
    id: int
    criado_em: datetime
    atualizado_em: datetime
    
    class Config:
        from_attributes = True


# ==================== Horário Comercial ====================
class HorarioComercialBase(BaseModel):
    dia_semana: int = Field(..., ge=0, le=6)
    hora_inicio: time
    hora_fim: time
    ativo: bool = True
    
    @field_validator('hora_fim')
    @classmethod
    def validar_horario(cls, v: time, info) -> time:
        """Valida que hora_fim > hora_inicio"""
        if 'hora_inicio' in info.data and v <= info.data['hora_inicio']:
            raise ValueError('hora_fim deve ser maior que hora_inicio')
        return v


class HorarioComercialCreate(HorarioComercialBase):
    pass


class HorarioComercialUpdate(BaseModel):
    hora_inicio: Optional[time] = None
    hora_fim: Optional[time] = None
    ativo: Optional[bool] = None


class HorarioComercialResponse(HorarioComercialBase):
    id: int
    criado_em: datetime
    atualizado_em: datetime
    
    class Config:
        from_attributes = True


# ==================== Feriados ====================
class FeriadoBase(BaseModel):
    data: date
    nome: str = Field(..., min_length=1, max_length=200)
    descricao: Optional[str] = None
    tipo: str = "nacional"  # nacional, ponto_facultativo, municipio, estadual
    recorrente: bool = False  # Repete todo ano?
    ativo: bool = True


class FeriadoCreate(FeriadoBase):
    pass


class FeriadoUpdate(BaseModel):
    nome: Optional[str] = Field(None, min_length=1, max_length=200)
    descricao: Optional[str] = None
    tipo: Optional[str] = None
    recorrente: Optional[bool] = None
    ativo: Optional[bool] = None


class FeriadoResponse(FeriadoBase):
    id: int
    criado_em: datetime
    atualizado_em: datetime
    
    class Config:
        from_attributes = True


# ==================== Pausas de SLA ====================
class PausaSLABase(BaseModel):
    chamado_id: int
    motivo: Optional[str] = Field(None, max_length=500)
    tipo: str = "manual"  # manual ou status


class PausaSLACreate(PausaSLABase):
    pass


class PausaSLARetomar(BaseModel):
    motivo_retomada: Optional[str] = None


class PausaSLAResponse(PausaSLABase):
    id: int
    inicio: datetime
    fim: Optional[datetime] = None
    duracao_horas: float
    status_pausante: Optional[str] = None
    criado_em: datetime
    atualizado_em: datetime
    
    class Config:
        from_attributes = True


# ==================== Info SLA do Chamado ====================
class InfoSLAChamadoResponse(BaseModel):
    """Informações de SLA de um chamado específico"""
    chamado_id: int
    
    # Resposta
    tempo_resposta_limite_horas: Optional[float]
    tempo_resposta_decorrido_horas: float
    tempo_resposta_pausado_horas: float
    percentual_resposta: float
    resposta_em_risco: bool
    resposta_vencida: bool
    resposta_em_dia: bool
    
    # Resolução
    tempo_resolucao_limite_horas: Optional[float]
    tempo_resolucao_decorrido_horas: float
    tempo_resolucao_pausado_horas: float
    percentual_resolucao: float
    resolucao_em_risco: bool
    resolucao_vencida: bool
    resolucao_em_dia: bool
    
    # Status
    pausado: bool
    ativo: bool
    ultima_atualizacao: datetime
    
    class Config:
        from_attributes = True


# ==================== Métricas ====================
class MetricasSLA(BaseModel):
    """Métricas gerais de SLA"""
    total_chamados: int
    chamados_abertos: int
    chamados_em_risco: int
    chamados_vencidos: int
    chamados_pausados: int
    percentual_em_risco: float
    percentual_vencidos: float
    percentual_cumprimento: float
    tempo_medio_resposta_horas: float
    tempo_medio_resolucao_horas: float


class MetricasPorPrioridade(BaseModel):
    """Métricas de SLA por prioridade"""
    prioridade: str
    total: int
    em_risco: int
    vencidos: int
    pausados: int
    percentual_em_risco: float
    percentual_vencidos: float
    tempo_medio_resposta_horas: float
    tempo_medio_resolucao_horas: float


# ==================== Log de Cálculo ====================
class LogCalculoSLAResponse(BaseModel):
    id: int
    tipo: str
    data_execucao: datetime
    chamados_processados: int
    tempo_execucao_ms: int
    chamados_em_risco: int
    chamados_vencidos: int
    chamados_pausados: int
    sucesso: bool
    mensagem_erro: Optional[str] = None
    
    class Config:
        from_attributes = True


# ==================== Feriados em Lote ====================
class FeriadosLoteResponse(BaseModel):
    """Resposta ao gerar feriados automaticamente"""
    ano: int
    total_feriados: int
    inseridos: int
    duplicados: int
    feriados: List[FeriadoResponse]


# ==================== Relatório Chamado ====================
class RelatorioChamadoSLA(BaseModel):
    """Relatório completo de SLA de um chamado"""
    chamado_id: int
    codigo: str
    protocolo: Optional[str]
    prioridade: str
    status: str
    data_abertura: datetime
    data_primeira_resposta: Optional[datetime]
    data_conclusao: Optional[datetime]
    
    # Resposta
    tempo_resposta_limite_horas: float
    tempo_resposta_decorrido_horas: float
    tempo_resposta_pausado_horas: float
    percentual_resposta: float
    resposta_status: str  # "em_dia", "em_risco", "vencido"
    
    # Resolução
    tempo_resolucao_limite_horas: float
    tempo_resolucao_decorrido_horas: float
    tempo_resolucao_pausado_horas: float
    percentual_resolucao: float
    resolucao_status: str  # "em_dia", "em_risco", "vencido"
    
    # Pausas
    pausado_atualmente: bool
    total_pausas: int
    tempo_total_pausado_horas: float
    
    # Timestamp
    ultima_atualizacao: datetime


# ==================== Requests ====================
class RecalcularSLARequest(BaseModel):
    """Request para recalcular SLA em lote"""
    apenas_abertos: bool = True
    apenas_ativos: bool = True


class GerarFeriadosRequest(BaseModel):
    """Request para gerar feriados para um ano"""
    ano: int = Field(..., ge=2020, le=2050)
    sobrescrever: bool = False  # Se deve sobrescrever feriados existentes
