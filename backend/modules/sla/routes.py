"""
API FastAPI para o módulo SLA
Endpoints para gerenciar configurações, feriados, pausas e cálculos de SLA
"""
from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func

from .schemas import (
    ConfiguracaoSLACreate, ConfiguracaoSLAUpdate, ConfiguracaoSLAResponse,
    HorarioComercialCreate, HorarioComercialUpdate, HorarioComercialResponse,
    FeriadoCreate, FeriadoUpdate, FeriadoResponse,
    PausaSLACreate, PausaSLARetomar, PausaSLAResponse,
    InfoSLAChamadoResponse, MetricasSLA, MetricasPorPrioridade,
    LogCalculoSLAResponse, FeriadosLoteResponse, RelatorioChamadoSLA,
    RecalcularSLARequest, GerarFeriadosRequest
)
from .models import (
    ConfiguracaoSLA, HorarioComercial, Feriado, PausaSLA,
    InfoSLAChamado, LogCalculoSLA, Chamado, StatusChamado
)
from .calculator import CalculadorSLA
from .holidays import gerar_todos_feriados

router = APIRouter(prefix="/sla", tags=["SLA"])


# Dependência para obter sessão do banco
def get_db() -> Session:
    """
    Dependência para obter sessão do banco de dados.
    Deve ser implementada no projeto principal.
    """
    raise NotImplementedError("Implemente get_db() no seu projeto")


# ==================== Configurações de SLA ====================

@router.post("/config", response_model=ConfiguracaoSLAResponse, status_code=status.HTTP_201_CREATED)
def criar_configuracao(
    config: ConfiguracaoSLACreate,
    db: Session = Depends(get_db)
):
    """Cria nova configuração de SLA para uma prioridade"""
    # Verifica se já existe
    existe = db.query(ConfiguracaoSLA).filter(
        ConfiguracaoSLA.prioridade == config.prioridade
    ).first()
    
    if existe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Configuração para prioridade '{config.prioridade}' já existe"
        )
    
    db_config = ConfiguracaoSLA(**config.dict())
    db.add(db_config)
    db.commit()
    db.refresh(db_config)
    
    return db_config


@router.get("/config", response_model=List[ConfiguracaoSLAResponse])
def listar_configuracoes(
    apenas_ativas: bool = Query(True),
    db: Session = Depends(get_db)
):
    """Lista configurações de SLA"""
    query = db.query(ConfiguracaoSLA)
    
    if apenas_ativas:
        query = query.filter(ConfiguracaoSLA.ativo == True)
    
    return query.order_by(ConfiguracaoSLA.prioridade).all()


@router.get("/config/{prioridade}", response_model=ConfiguracaoSLAResponse)
def obter_configuracao(
    prioridade: str,
    db: Session = Depends(get_db)
):
    """Obtém configuração de SLA por prioridade"""
    config = db.query(ConfiguracaoSLA).filter(
        ConfiguracaoSLA.prioridade == prioridade
    ).first()
    
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Configuração para '{prioridade}' não encontrada"
        )
    
    return config


@router.put("/config/{config_id}", response_model=ConfiguracaoSLAResponse)
def atualizar_configuracao(
    config_id: int,
    config: ConfiguracaoSLAUpdate,
    db: Session = Depends(get_db)
):
    """Atualiza configuração de SLA"""
    db_config = db.query(ConfiguracaoSLA).filter(
        ConfiguracaoSLA.id == config_id
    ).first()
    
    if not db_config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuração não encontrada"
        )
    
    for field, value in config.dict(exclude_unset=True).items():
        setattr(db_config, field, value)
    
    db.commit()
    db.refresh(db_config)
    
    return db_config


@router.delete("/config/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_configuracao(
    config_id: int,
    db: Session = Depends(get_db)
):
    """Deleta configuração de SLA"""
    db_config = db.query(ConfiguracaoSLA).filter(
        ConfiguracaoSLA.id == config_id
    ).first()
    
    if not db_config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Configuração não encontrada"
        )
    
    db.delete(db_config)
    db.commit()


# ==================== Horário Comercial ====================

@router.post("/horario", response_model=HorarioComercialResponse, status_code=status.HTTP_201_CREATED)
def criar_horario(
    horario: HorarioComercialCreate,
    db: Session = Depends(get_db)
):
    """Cria horário comercial para um dia da semana"""
    # Verifica se já existe para este dia
    existe = db.query(HorarioComercial).filter(
        HorarioComercial.dia_semana == horario.dia_semana
    ).first()
    
    if existe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Horário para dia {horario.dia_semana} já existe"
        )
    
    db_horario = HorarioComercial(**horario.dict())
    db.add(db_horario)
    db.commit()
    db.refresh(db_horario)
    
    return db_horario


@router.get("/horario", response_model=List[HorarioComercialResponse])
def listar_horarios(
    apenas_ativos: bool = Query(True),
    db: Session = Depends(get_db)
):
    """Lista horários comerciais"""
    query = db.query(HorarioComercial)
    
    if apenas_ativos:
        query = query.filter(HorarioComercial.ativo == True)
    
    return query.order_by(HorarioComercial.dia_semana).all()


@router.put("/horario/{horario_id}", response_model=HorarioComercialResponse)
def atualizar_horario(
    horario_id: int,
    horario: HorarioComercialUpdate,
    db: Session = Depends(get_db)
):
    """Atualiza horário comercial"""
    db_horario = db.query(HorarioComercial).filter(
        HorarioComercial.id == horario_id
    ).first()
    
    if not db_horario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Horário não encontrado"
        )
    
    for field, value in horario.dict(exclude_unset=True).items():
        setattr(db_horario, field, value)
    
    db.commit()
    db.refresh(db_horario)
    
    return db_horario


@router.delete("/horario/{horario_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_horario(
    horario_id: int,
    db: Session = Depends(get_db)
):
    """Deleta horário comercial"""
    db_horario = db.query(HorarioComercial).filter(
        HorarioComercial.id == horario_id
    ).first()
    
    if not db_horario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Horário não encontrado"
        )
    
    db.delete(db_horario)
    db.commit()


# ==================== Feriados ====================

@router.post("/feriado", response_model=FeriadoResponse, status_code=status.HTTP_201_CREATED)
def criar_feriado(
    feriado: FeriadoCreate,
    db: Session = Depends(get_db)
):
    """Cria um feriado"""
    # Verifica se já existe
    existe = db.query(Feriado).filter(
        Feriado.data == feriado.data
    ).first()
    
    if existe:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Feriado em {feriado.data} já existe"
        )
    
    db_feriado = Feriado(**feriado.dict())
    db.add(db_feriado)
    db.commit()
    db.refresh(db_feriado)
    
    # Invalida cache
    # Você pode chamar calculator.invalidar_cache() se tiver uma instância global
    
    return db_feriado


@router.get("/feriado", response_model=List[FeriadoResponse])
def listar_feriados(
    ano: Optional[int] = Query(None),
    mes: Optional[int] = Query(None),
    apenas_ativos: bool = Query(True),
    db: Session = Depends(get_db)
):
    """Lista feriados com filtros opcionais"""
    query = db.query(Feriado)
    
    if apenas_ativos:
        query = query.filter(Feriado.ativo == True)
    
    if ano:
        query = query.filter(func.extract('year', Feriado.data) == ano)
    
    if mes:
        query = query.filter(func.extract('month', Feriado.data) == mes)
    
    return query.order_by(Feriado.data).all()


@router.put("/feriado/{feriado_id}", response_model=FeriadoResponse)
def atualizar_feriado(
    feriado_id: int,
    feriado: FeriadoUpdate,
    db: Session = Depends(get_db)
):
    """Atualiza feriado"""
    db_feriado = db.query(Feriado).filter(
        Feriado.id == feriado_id
    ).first()
    
    if not db_feriado:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feriado não encontrado"
        )
    
    for field, value in feriado.dict(exclude_unset=True).items():
        setattr(db_feriado, field, value)
    
    db.commit()
    db.refresh(db_feriado)
    
    return db_feriado


@router.delete("/feriado/{feriado_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_feriado(
    feriado_id: int,
    db: Session = Depends(get_db)
):
    """Deleta feriado"""
    db_feriado = db.query(Feriado).filter(
        Feriado.id == feriado_id
    ).first()
    
    if not db_feriado:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Feriado não encontrado"
        )
    
    db.delete(db_feriado)
    db.commit()


@router.post("/feriado/gerar/{ano}", response_model=FeriadosLoteResponse)
def gerar_feriados_automaticamente(
    ano: int = Query(..., ge=2020, le=2050),
    sobrescrever: bool = Query(False),
    db: Session = Depends(get_db)
):
    """
    Gera automaticamente todos os feriados (fixos + móveis) para um ano
    
    Calcula:
    - Feriados fixos (mesma data todo ano)
    - Feriados móveis baseados na Páscoa (Carnaval, Sexta Santa, Corpus Christi, etc)
    """
    feriados_gerados = gerar_todos_feriados(ano)
    inseridos = 0
    duplicados = 0
    feriados_response = []
    
    for f in feriados_gerados:
        data_obj = date.fromisoformat(f["data"])
        
        # Verifica se já existe
        existe = db.query(Feriado).filter(
            Feriado.data == data_obj
        ).first()
        
        if existe:
            if sobrescrever:
                db.delete(existe)
                db.flush()
            else:
                duplicados += 1
                continue
        
        # Cria novo feriado
        novo_feriado = Feriado(
            data=data_obj,
            nome=f["nome"],
            descricao=f.get("descricao", ""),
            tipo=f.get("tipo", "nacional"),
            recorrente=f.get("recorrente", False),
            ativo=True
        )
        
        db.add(novo_feriado)
        db.flush()
        db.refresh(novo_feriado)
        
        feriados_response.append(FeriadoResponse.from_orm(novo_feriado))
        inseridos += 1
    
    db.commit()
    
    return FeriadosLoteResponse(
        ano=ano,
        total_feriados=len(feriados_gerados),
        inseridos=inseridos,
        duplicados=duplicados,
        feriados=feriados_response
    )


# ==================== Pausas de SLA ====================

@router.post("/pausa", response_model=PausaSLAResponse, status_code=status.HTTP_201_CREATED)
def criar_pausa(
    pausa: PausaSLACreate,
    db: Session = Depends(get_db)
):
    """Cria pausa manual de SLA"""
    # Verifica se chamado existe
    chamado = db.query(Chamado).filter(
        Chamado.id == pausa.chamado_id
    ).first()
    
    if not chamado:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chamado {pausa.chamado_id} não encontrado"
        )
    
    # Cria pausa
    db_pausa = PausaSLA(
        chamado_id=pausa.chamado_id,
        inicio=__import__('datetime').datetime.utcnow(),
        motivo=pausa.motivo,
        tipo="manual"
    )
    
    db.add(db_pausa)
    db.commit()
    db.refresh(db_pausa)
    
    return db_pausa


@router.post("/pausa/{pausa_id}/retomar", response_model=PausaSLAResponse)
def retomar_pausa(
    pausa_id: int,
    retomada: PausaSLARetomar,
    db: Session = Depends(get_db)
):
    """Retoma pausa de SLA"""
    pausa = db.query(PausaSLA).filter(
        PausaSLA.id == pausa_id
    ).first()
    
    if not pausa:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pausa não encontrada"
        )
    
    if pausa.fim is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pausa já foi finalizada"
        )
    
    # Finaliza pausa
    from datetime import datetime
    pausa.fim = datetime.utcnow()
    duracao = (pausa.fim - pausa.inicio).total_seconds() / 3600
    pausa.duracao_horas = duracao
    
    db.commit()
    db.refresh(pausa)
    
    return pausa


@router.get("/pausa", response_model=List[PausaSLAResponse])
def listar_pausas(
    chamado_id: Optional[int] = Query(None),
    apenas_ativas: bool = Query(False),
    db: Session = Depends(get_db)
):
    """Lista pausas de SLA"""
    query = db.query(PausaSLA)
    
    if chamado_id:
        query = query.filter(PausaSLA.chamado_id == chamado_id)
    
    if apenas_ativas:
        query = query.filter(PausaSLA.fim.is_(None))
    
    return query.order_by(PausaSLA.inicio.desc()).all()


@router.delete("/pausa/{pausa_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_pausa(
    pausa_id: int,
    db: Session = Depends(get_db)
):
    """Deleta pausa"""
    pausa = db.query(PausaSLA).filter(
        PausaSLA.id == pausa_id
    ).first()
    
    if not pausa:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pausa não encontrada"
        )
    
    db.delete(pausa)
    db.commit()


# ==================== Cálculos de SLA ====================

@router.get("/chamado/{chamado_id}", response_model=RelatorioChamadoSLA)
def obter_sla_chamado(
    chamado_id: int,
    db: Session = Depends(get_db)
):
    """Obtém informações completas de SLA de um chamado"""
    chamado = db.query(Chamado).filter(
        Chamado.id == chamado_id
    ).first()
    
    if not chamado:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chamado não encontrado"
        )
    
    # Calcula SLA
    calculator = CalculadorSLA(db)
    resultado = calculator.calcular_sla(chamado)
    
    # Determina status
    resposta_status = "em_dia"
    if resultado["resposta_vencida"]:
        resposta_status = "vencido"
    elif resultado["resposta_em_risco"]:
        resposta_status = "em_risco"
    
    resolucao_status = "em_dia"
    if resultado["resolucao_vencida"]:
        resolucao_status = "vencido"
    elif resultado["resolucao_em_risco"]:
        resolucao_status = "em_risco"
    
    # Obtém info de pausas
    pausas = db.query(PausaSLA).filter(
        PausaSLA.chamado_id == chamado_id
    ).all()
    
    total_pausas = len(pausas)
    tempo_pausado = sum(p.duracao_horas for p in pausas if p.duracao_horas)
    pausa_ativa = any(p.fim is None for p in pausas)
    
    return RelatorioChamadoSLA(
        chamado_id=chamado.id,
        codigo=chamado.codigo,
        protocolo=chamado.protocolo,
        prioridade=chamado.prioridade,
        status=chamado.status,
        data_abertura=chamado.data_abertura,
        data_primeira_resposta=chamado.data_primeira_resposta,
        data_conclusao=chamado.data_conclusao,
        
        tempo_resposta_limite_horas=resultado["tempo_resposta_limite_horas"],
        tempo_resposta_decorrido_horas=resultado["tempo_resposta_decorrido_horas"],
        tempo_resposta_pausado_horas=resultado["tempo_resposta_pausado_horas"],
        percentual_resposta=resultado["percentual_resposta"],
        resposta_status=resposta_status,
        
        tempo_resolucao_limite_horas=resultado["tempo_resolucao_limite_horas"],
        tempo_resolucao_decorrido_horas=resultado["tempo_resolucao_decorrido_horas"],
        tempo_resolucao_pausado_horas=resultado["tempo_resolucao_pausado_horas"],
        percentual_resolucao=resultado["percentual_resolucao"],
        resolucao_status=resolucao_status,
        
        pausado_atualmente=pausa_ativa,
        total_pausas=total_pausas,
        tempo_total_pausado_horas=tempo_pausado,
        
        ultima_atualizacao=__import__('datetime').datetime.utcnow()
    )


@router.post("/recalcular")
def recalcular_sla(
    request: RecalcularSLARequest,
    db: Session = Depends(get_db)
):
    """Recalcula SLA para todos os chamados"""
    calculator = CalculadorSLA(db)
    stats = calculator.recalcular_todos()
    
    return {
        "sucesso": True,
        "mensagem": "SLA recalculado com sucesso",
        "total_processados": stats["total_processados"],
        "em_risco": stats["em_risco"],
        "vencidos": stats["vencidos"],
        "pausados": stats["pausados"],
        "tempo_ms": stats["tempo_ms"]
    }


# ==================== Logs ====================

@router.get("/logs", response_model=List[LogCalculoSLAResponse])
def listar_logs(
    limit: int = Query(50, le=500),
    db: Session = Depends(get_db)
):
    """Lista logs de cálculos de SLA"""
    logs = db.query(LogCalculoSLA).order_by(
        LogCalculoSLA.data_execucao.desc()
    ).limit(limit).all()
    
    return logs


# ==================== Health Check ====================

@router.get("/health")
def health_check():
    """Verifica saúde da API SLA"""
    return {
        "status": "ok",
        "versao": "2.0",
        "modulo": "sla",
        "timestamp": __import__('datetime').datetime.utcnow()
    }
