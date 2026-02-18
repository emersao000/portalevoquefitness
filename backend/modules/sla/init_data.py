"""
Script para inicializar configurações padrão e dados de SLA
Execute uma vez no início do projeto
"""
from datetime import time
from sqlalchemy.orm import Session
import logging

from .models import ConfiguracaoSLA, HorarioComercial, Feriado
from .holidays import gerar_todos_feriados

logger = logging.getLogger("sla.init")


def inicializar_configuracoes_sla(db: Session, sobrescrever: bool = False):
    """
    Cria configurações padrão de SLA por prioridade
    
    Args:
        db: Sessão do banco
        sobrescrever: Se deve sobrescrever configurações existentes
    """
    configuracoes_padrao = [
        {
            "prioridade": "Urgente",
            "tempo_resposta_horas": 1.0,
            "tempo_resolucao_horas": 4.0,
            "percentual_risco": 75.0,
            "considera_horario_comercial": True,
            "considera_feriados": True,
            "escalar_automaticamente": True,
            "notificar_em_risco": True,
            "descricao": "Prioridade Urgente - Resposta em 1h, Resolução em 4h"
        },
        {
            "prioridade": "Alta",
            "tempo_resposta_horas": 2.0,
            "tempo_resolucao_horas": 8.0,
            "percentual_risco": 80.0,
            "considera_horario_comercial": True,
            "considera_feriados": True,
            "escalar_automaticamente": True,
            "notificar_em_risco": True,
            "descricao": "Prioridade Alta - Resposta em 2h, Resolução em 8h (1 dia útil)"
        },
        {
            "prioridade": "Normal",
            "tempo_resposta_horas": 4.0,
            "tempo_resolucao_horas": 24.0,
            "percentual_risco": 85.0,
            "considera_horario_comercial": True,
            "considera_feriados": True,
            "escalar_automaticamente": False,
            "notificar_em_risco": True,
            "descricao": "Prioridade Normal - Resposta em 4h, Resolução em 24h (3 dias úteis)"
        },
        {
            "prioridade": "Baixa",
            "tempo_resposta_horas": 8.0,
            "tempo_resolucao_horas": 40.0,
            "percentual_risco": 90.0,
            "considera_horario_comercial": True,
            "considera_feriados": True,
            "escalar_automaticamente": False,
            "notificar_em_risco": False,
            "descricao": "Prioridade Baixa - Resposta em 8h, Resolução em 40h (5 dias úteis)"
        }
    ]
    
    for config_data in configuracoes_padrao:
        existe = db.query(ConfiguracaoSLA).filter(
            ConfiguracaoSLA.prioridade == config_data["prioridade"]
        ).first()
        
        if existe:
            if sobrescrever:
                # Atualiza campos
                for key, value in config_data.items():
                    setattr(existe, key, value)
                logger.info(f"✓ Configuração '{config_data['prioridade']}' atualizada")
            else:
                logger.info(f"✓ Configuração '{config_data['prioridade']}' já existe")
        else:
            nova_config = ConfiguracaoSLA(**config_data, ativo=True)
            db.add(nova_config)
            logger.info(f"✓ Configuração '{config_data['prioridade']}' criada")
    
    db.commit()


def inicializar_horario_comercial(db: Session, sobrescrever: bool = False):
    """
    Cria horário comercial padrão (08:00-18:00, seg-sex)
    
    Args:
        db: Sessão do banco
        sobrescrever: Se deve sobrescrever horários existentes
    """
    # Horário padrão: 8h-18h de segunda a sexta
    horarios_padrao = [
        {"dia_semana": 0, "hora_inicio": time(8, 0), "hora_fim": time(18, 0)},   # Segunda
        {"dia_semana": 1, "hora_inicio": time(8, 0), "hora_fim": time(18, 0)},   # Terça
        {"dia_semana": 2, "hora_inicio": time(8, 0), "hora_fim": time(18, 0)},   # Quarta
        {"dia_semana": 3, "hora_inicio": time(8, 0), "hora_fim": time(18, 0)},   # Quinta
        {"dia_semana": 4, "hora_inicio": time(8, 0), "hora_fim": time(18, 0)},   # Sexta
    ]
    
    if sobrescrever:
        # Remove horários antigos
        db.query(HorarioComercial).delete()
        logger.info("✓ Horários comerciais anteriores removidos")
    
    for horario_data in horarios_padrao:
        existe = db.query(HorarioComercial).filter(
            HorarioComercial.dia_semana == horario_data["dia_semana"]
        ).first()
        
        if not existe:
            novo_horario = HorarioComercial(**horario_data, ativo=True)
            db.add(novo_horario)
            dia_nome = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"][horario_data["dia_semana"]]
            logger.info(f"✓ Horário {dia_nome}: 08:00-18:00 criado")
    
    db.commit()


def inicializar_feriados(db: Session, ano_inicio: int = 2026, ano_fim: int = 2027):
    """
    Cria feriados brasileiros fixos e móveis para um intervalo de anos
    
    Args:
        db: Sessão do banco
        ano_inicio: Primeiro ano (padrão 2026)
        ano_fim: Último ano (padrão 2027)
    """
    feriados_criados = 0
    feriados_duplicados = 0
    
    for ano in range(ano_inicio, ano_fim + 1):
        feriados = gerar_todos_feriados(ano)
        
        for feriado_data in feriados:
            from datetime import date
            data_obj = date.fromisoformat(feriado_data["data"])
            
            existe = db.query(Feriado).filter(
                Feriado.data == data_obj
            ).first()
            
            if existe:
                feriados_duplicados += 1
                continue
            
            novo_feriado = Feriado(
                data=data_obj,
                nome=feriado_data["nome"],
                descricao=f"Feriado brasileiro - {feriado_data.get('tipo', 'nacional')}",
                tipo=feriado_data.get("tipo", "nacional"),
                recorrente=feriado_data.get("recorrente", False),
                ativo=True
            )
            
            db.add(novo_feriado)
            feriados_criados += 1
    
    db.commit()
    logger.info(f"✓ {feriados_criados} feriados criados")
    if feriados_duplicados > 0:
        logger.info(f"⚠️ {feriados_duplicados} feriados já existiam")


def inicializar_completo(db: Session, anos_feriado=(2026, 2027)):
    """
    Inicializa todos os dados padrão de SLA
    
    Args:
        db: Sessão do banco
        anos_feriado: Intervalo de anos para gerar feriados
    """
    logger.info("=" * 60)
    logger.info("Inicializando módulo SLA com dados padrão")
    logger.info("=" * 60)
    
    try:
        logger.info("\n1. Criando configurações de SLA...")
        inicializar_configuracoes_sla(db)
        
        logger.info("\n2. Criando horário comercial...")
        inicializar_horario_comercial(db)
        
        logger.info(f"\n3. Criando feriados ({anos_feriado[0]}-{anos_feriado[1]})...")
        inicializar_feriados(db, anos_feriado[0], anos_feriado[1])
        
        logger.info("\n" + "=" * 60)
        logger.info("✅ Inicialização concluída com sucesso!")
        logger.info("=" * 60)
        
        return True
        
    except Exception as e:
        logger.error(f"\n❌ Erro durante inicialização: {e}")
        db.rollback()
        return False


# Exemplo de uso
if __name__ == "__main__":
    import logging
    
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(name)s - %(levelname)s - %(message)s'
    )
    
    # Você precisa de uma sessão do banco de dados
    # from seu_projeto.database import SessionLocal
    # db = SessionLocal()
    # inicializar_completo(db)
    # db.close()
    
    print("\n📌 Para usar este script:")
    print("   from backend.modules.sla.init_data import inicializar_completo")
    print("   inicializar_completo(db)  # onde db é a sessão do banco")
