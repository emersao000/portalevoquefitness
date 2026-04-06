"""
Modelos de banco de dados para o módulo SLA
Usa o Base compartilhado da aplicação (core.db) para que as tabelas
sejam criadas junto com o restante do banco de dados.

NOTA: Os modelos Chamado, SLAPausa e User são definidos em ti/models/
      e NÃO devem ser re-declarados aqui para evitar conflito de metadados.
"""
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, DateTime, Boolean,
    Float, Text, Time, Date, UniqueConstraint
)
import enum

# Usa o Base compartilhado da aplicação
from core.db import Base


class TipoFeriado(str, enum.Enum):
    """Tipos de feriado"""
    NACIONAL = "nacional"
    PONTO_FACULTATIVO = "ponto_facultativo"
    MUNICIPIO = "municipio"
    ESTADUAL = "estadual"


class StatusChamado(str, enum.Enum):
    """Status válidos do chamado para SLA"""
    ABERTO = "Aberto"
    EM_ATENDIMENTO = "Em atendimento"
    AGUARDANDO = "Aguardando"
    EM_ANALISE = "Em análise"
    CANCELADO = "Expirado"
    CONCLUIDO = "Concluído"


class ConfiguracaoSLA(Base):
    """Configurações de SLA por prioridade"""
    __tablename__ = "sla_configuracao"

    id = Column(Integer, primary_key=True, index=True)
    prioridade = Column(String(50), unique=True, nullable=False, index=True)
    tempo_resposta_horas = Column(Float, nullable=False)
    tempo_resolucao_horas = Column(Float, nullable=False)
    percentual_risco = Column(Float, default=80.0)
    considera_horario_comercial = Column(Boolean, default=True)
    considera_feriados = Column(Boolean, default=True)
    escalar_automaticamente = Column(Boolean, default=False)
    notificar_em_risco = Column(Boolean, default=True)
    descricao = Column(Text)
    ativo = Column(Boolean, default=True)
    criado_em = Column(DateTime, default=datetime.utcnow)
    atualizado_em = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class HorarioComercial(Base):
    """Configuração de horário comercial por dia da semana"""
    __tablename__ = "sla_horario_comercial"

    id = Column(Integer, primary_key=True, index=True)
    dia_semana = Column(Integer, nullable=False, index=True)
    hora_inicio = Column(Time, nullable=False)
    hora_fim = Column(Time, nullable=False)
    ativo = Column(Boolean, default=True)
    criado_em = Column(DateTime, default=datetime.utcnow)
    atualizado_em = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Feriado(Base):
    """Feriados (fixos e moveis) para calculo de SLA"""
    __tablename__ = "sla_feriado"

    id = Column(Integer, primary_key=True, index=True)
    data = Column(Date, nullable=False, index=True)
    nome = Column(String(200), nullable=False)
    descricao = Column(Text)
    tipo = Column(String(50), default=TipoFeriado.NACIONAL.value)
    recorrente = Column(Boolean, default=False)
    ativo = Column(Boolean, default=True)
    criado_em = Column(DateTime, default=datetime.utcnow)
    atualizado_em = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("data", "ativo", name="uq_feriado_data_ativo"),
    )


class InfoSLAChamado(Base):
    """Informacoes calculadas de SLA para cada chamado"""
    __tablename__ = "sla_info_chamado"

    id = Column(Integer, primary_key=True, index=True)
    chamado_id = Column(Integer, nullable=False, unique=True, index=True)

    tempo_resposta_limite_horas = Column(Float)
    tempo_resposta_decorrido_horas = Column(Float, default=0.0)
    tempo_resposta_pausado_horas = Column(Float, default=0.0)
    percentual_resposta = Column(Float, default=0.0)
    resposta_em_risco = Column(Boolean, default=False, index=True)
    resposta_vencida = Column(Boolean, default=False, index=True)
    resposta_em_dia = Column(Boolean, default=True)

    tempo_resolucao_limite_horas = Column(Float)
    tempo_resolucao_decorrido_horas = Column(Float, default=0.0)
    tempo_resolucao_pausado_horas = Column(Float, default=0.0)
    percentual_resolucao = Column(Float, default=0.0)
    resolucao_em_risco = Column(Boolean, default=False, index=True)
    resolucao_vencida = Column(Boolean, default=False, index=True)
    resolucao_em_dia = Column(Boolean, default=True)

    pausado = Column(Boolean, default=False, index=True)
    ativo = Column(Boolean, default=True, index=True)

    ultima_atualizacao = Column(DateTime, default=datetime.utcnow)
    data_ultima_pausa = Column(DateTime)
    data_ultima_retomada = Column(DateTime)


class LogCalculoSLA(Base):
    """Historico de calculos de SLA"""
    __tablename__ = "sla_log_calculo"

    id = Column(Integer, primary_key=True, index=True)
    tipo = Column(String(50))
    data_execucao = Column(DateTime, default=datetime.utcnow)
    chamados_processados = Column(Integer, default=0)
    tempo_execucao_ms = Column(Integer)
    chamados_em_risco = Column(Integer, default=0)
    chamados_vencidos = Column(Integer, default=0)
    chamados_pausados = Column(Integer, default=0)
    sucesso = Column(Boolean, default=True)
    mensagem_erro = Column(Text)
