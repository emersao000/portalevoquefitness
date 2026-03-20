from __future__ import annotations
import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse, Response, FileResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware
from io import BytesIO
from ti.api import chamados_router, unidades_router, problemas_router, notifications_router, notification_settings_router, alerts_router, email_debug_router, powerbi_router, metrics_router
try:
    from ti.api.grupos import router as grupos_router
    print("✅ [GRUPOS] Router importado com sucesso")
except Exception as _grupos_err:
    import traceback as _tb
    print(f"❌ [GRUPOS] Falha ao importar router: {_grupos_err}")
    _tb.print_exc()
    grupos_router = None
from ti.api.usuarios import router as usuarios_router
from ti.api.dashboard_permissions import router as dashboard_permissions_router
from auth0.routes import router as auth0_router
from core.realtime import mount_socketio
# sla_router removido — endpoints SLA registrados diretamente abaixo
import json
from typing import Any, List, Dict
import uuid
from sqlalchemy.orm import Session
from core.db import get_db, engine
from ti.models.media import Media
from ti.scripts.create_performance_indices import create_indices

# Verificar configuração de email do Graph
try:
    from core.email_msgraph import _have_graph_config, CLIENT_ID, CLIENT_SECRET, TENANT_ID, USER_ID
    if _have_graph_config():
        print("✅ [EMAIL] Configuração do Microsoft Graph OK")
        print(f"   CLIENT_ID: {CLIENT_ID[:20]}...")
        print(f"   USER_ID: {USER_ID}")
    else:
        print("⚠️  [EMAIL] Configuração do Microsoft Graph INCOMPLETA - emails NÃO serão enviados")
        print(f"   CLIENT_ID: {'✗' if not CLIENT_ID else '✓'}")
        print(f"   CLIENT_SECRET: {'✗' if not CLIENT_SECRET else '✓'}")
        print(f"   TENANT_ID: {'✗' if not TENANT_ID else '✓'}")
        print(f"   USER_ID: {'✗' if not USER_ID else '✓'}")
except Exception as e:
    print(f"⚠️  [EMAIL] Erro ao verificar configuração: {e}")

# Create the FastAPI application (HTTP)
_http = FastAPI(title="Evoque API - TI", version="1.0.0")

# ── VERSÃO: 2026-02-18-v4 ────────────────────────────────────────────────────
# Endpoints SLA registrados IMEDIATAMENTE após criação do app
# para garantir que existam independente de qualquer erro posterior
# ─────────────────────────────────────────────────────────────────────────────
from typing import Optional as _Optional
from datetime import datetime as _datetime
from fastapi import Query as _Q

@_http.get("/api/version")
def api_version():
    return {"version": "2026-02-18-v4", "sla_endpoint": "registrado"}

@_http.get("/api/sla/dashboard", tags=["SLA"])
async def sla_dashboard(
    data_inicio: _Optional[_datetime] = _Q(None),
    data_fim: _Optional[_datetime] = _Q(None),
    db=Depends(get_db),
):
    try:
        from modules.sla.service import SlaService
        return SlaService(db).obter_dashboard(data_inicio, data_fim)
    except Exception as _e:
        import logging as _lg
        _lg.getLogger("sla").error(f"Erro dashboard SLA: {_e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro SLA: {str(_e)}")

@_http.get("/api/sla/dashboard/resumo", tags=["SLA"])
async def sla_dashboard_resumo(db=Depends(get_db)):
    try:
        from modules.sla.service import SlaService
        data = SlaService(db).obter_dashboard()
        return {k: data.get(k) for k in [
            "percentual_cumprimento", "percentual_em_risco", "percentual_vencidos",
            "chamados_em_risco", "chamados_vencidos", "chamados_pausados",
            "chamados_abertos", "tempo_medio_resposta_horas", "tempo_medio_resolucao_horas",
            "tempo_medio_resposta_formatado", "tempo_medio_resolucao_formatado", "ultima_atualizacao",
        ]}
    except Exception as _e:
        raise HTTPException(status_code=500, detail=f"Erro SLA resumo: {str(_e)}")

@_http.get("/api/sla/chamado/{chamado_id}", tags=["SLA"])
async def sla_chamado(chamado_id: int, db=Depends(get_db)):
    try:
        from modules.sla.service import SlaService
        result = SlaService(db).calcular_sla_chamado(chamado_id)
        if not result:
            raise HTTPException(status_code=404, detail="Chamado não encontrado ou anterior ao SLA")
        return result
    except HTTPException:
        raise
    except Exception as _e:
        raise HTTPException(status_code=500, detail=f"Erro SLA chamado: {str(_e)}")

@_http.post("/api/sla/chamado/{chamado_id}/pausar", tags=["SLA"])
async def sla_pausar(chamado_id: int, status: str = _Q(...), db=Depends(get_db)):
    try:
        from modules.sla.service import SlaService
        result = SlaService(db).pausar_sla_chamado(chamado_id, status)
        return {"chamado_id": chamado_id, "status": status, "alterado": result}
    except Exception as _e:
        raise HTTPException(status_code=500, detail=f"Erro ao pausar SLA: {str(_e)}")

@_http.get("/api/sla/health", tags=["SLA"])
async def sla_health():
    return {"status": "ok", "modulo": "sla", "timestamp": _datetime.utcnow().isoformat()}

# ─── SLA Configurações ────────────────────────────────────────────────────────

@_http.get("/api/sla/configuracoes", tags=["SLA Config"])
async def listar_configuracoes_sla(db=Depends(get_db)):
    try:
        from modules.sla.models import ConfiguracaoSLA
        configs = db.query(ConfiguracaoSLA).order_by(ConfiguracaoSLA.prioridade).all()
        return [
            {
                "id": c.id, "prioridade": c.prioridade,
                "tempo_resposta_horas": c.tempo_resposta_horas,
                "tempo_resolucao_horas": c.tempo_resolucao_horas,
                "percentual_risco": c.percentual_risco,
                "considera_horario_comercial": c.considera_horario_comercial,
                "considera_feriados": c.considera_feriados,
                "escalar_automaticamente": c.escalar_automaticamente,
                "notificar_em_risco": c.notificar_em_risco,
                "descricao": c.descricao, "ativo": c.ativo,
                "criado_em": c.criado_em, "atualizado_em": c.atualizado_em,
            }
            for c in configs
        ]
    except Exception as _e:
        raise HTTPException(status_code=500, detail=f"Erro ao listar configuracoes SLA: {str(_e)}")


@_http.post("/api/sla/configuracoes", tags=["SLA Config"])
async def criar_configuracao_sla(body: dict, db=Depends(get_db)):
    try:
        from modules.sla.models import ConfiguracaoSLA
        existe = db.query(ConfiguracaoSLA).filter(ConfiguracaoSLA.prioridade == body.get("prioridade")).first()
        if existe:
            raise HTTPException(status_code=400, detail=f"Configuracao para '{body.get('prioridade')}' ja existe")
        config = ConfiguracaoSLA(**{k: v for k, v in body.items() if k != "id"})
        db.add(config)
        db.commit()
        db.refresh(config)
        return {"id": config.id, "prioridade": config.prioridade, "ativo": config.ativo}
    except HTTPException:
        raise
    except Exception as _e:
        raise HTTPException(status_code=500, detail=f"Erro ao criar configuracao SLA: {str(_e)}")


@_http.put("/api/sla/configuracoes/{config_id}", tags=["SLA Config"])
async def atualizar_configuracao_sla(config_id: int, body: dict, db=Depends(get_db)):
    try:
        from modules.sla.models import ConfiguracaoSLA
        config = db.query(ConfiguracaoSLA).filter(ConfiguracaoSLA.id == config_id).first()
        if not config:
            raise HTTPException(status_code=404, detail="Configuracao nao encontrada")
        campos = [
            "tempo_resposta_horas", "tempo_resolucao_horas", "percentual_risco",
            "considera_horario_comercial", "considera_feriados",
            "escalar_automaticamente", "notificar_em_risco", "descricao", "ativo"
        ]
        for campo in campos:
            if campo in body:
                setattr(config, campo, body[campo])
        config.atualizado_em = _datetime.utcnow()
        db.commit()
        return {"id": config.id, "prioridade": config.prioridade, "atualizado": True}
    except HTTPException:
        raise
    except Exception as _e:
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar configuracao SLA: {str(_e)}")


@_http.delete("/api/sla/configuracoes/{config_id}", tags=["SLA Config"])
async def deletar_configuracao_sla(config_id: int, db=Depends(get_db)):
    try:
        from modules.sla.models import ConfiguracaoSLA
        config = db.query(ConfiguracaoSLA).filter(ConfiguracaoSLA.id == config_id).first()
        if not config:
            raise HTTPException(status_code=404, detail="Configuracao nao encontrada")
        db.delete(config)
        db.commit()
        return {"deletado": True}
    except HTTPException:
        raise
    except Exception as _e:
        raise HTTPException(status_code=500, detail=f"Erro ao deletar configuracao SLA: {str(_e)}")


# ─── SLA Horário Comercial ────────────────────────────────────────────────────

@_http.get("/api/sla/horario-comercial", tags=["SLA Config"])
async def listar_horarios_comerciais(db=Depends(get_db)):
    try:
        from modules.sla.models import HorarioComercial
        horarios = db.query(HorarioComercial).order_by(HorarioComercial.dia_semana).all()
        return [
            {
                "id": h.id, "dia_semana": h.dia_semana,
                "hora_inicio": h.hora_inicio.strftime("%H:%M") if h.hora_inicio else None,
                "hora_fim": h.hora_fim.strftime("%H:%M") if h.hora_fim else None,
                "ativo": h.ativo,
            }
            for h in horarios
        ]
    except Exception as _e:
        raise HTTPException(status_code=500, detail=f"Erro ao listar horarios: {str(_e)}")


@_http.post("/api/sla/horario-comercial", tags=["SLA Config"])
async def criar_horario_comercial(body: dict, db=Depends(get_db)):
    try:
        from modules.sla.models import HorarioComercial
        from datetime import time as dtime
        parts_i = body["hora_inicio"].split(":")
        parts_f = body["hora_fim"].split(":")
        horario = HorarioComercial(
            dia_semana=body["dia_semana"],
            hora_inicio=dtime(int(parts_i[0]), int(parts_i[1])),
            hora_fim=dtime(int(parts_f[0]), int(parts_f[1])),
            ativo=body.get("ativo", True)
        )
        db.add(horario)
        db.commit()
        db.refresh(horario)
        return {"id": horario.id, "dia_semana": horario.dia_semana}
    except Exception as _e:
        raise HTTPException(status_code=500, detail=f"Erro ao criar horario: {str(_e)}")


@_http.put("/api/sla/horario-comercial/{horario_id}", tags=["SLA Config"])
async def atualizar_horario_comercial(horario_id: int, body: dict, db=Depends(get_db)):
    try:
        from modules.sla.models import HorarioComercial
        from datetime import time as dtime
        horario = db.query(HorarioComercial).filter(HorarioComercial.id == horario_id).first()
        if not horario:
            raise HTTPException(status_code=404, detail="Horario nao encontrado")
        if "hora_inicio" in body and body["hora_inicio"]:
            parts = body["hora_inicio"].split(":")
            horario.hora_inicio = dtime(int(parts[0]), int(parts[1]))
        if "hora_fim" in body and body["hora_fim"]:
            parts = body["hora_fim"].split(":")
            horario.hora_fim = dtime(int(parts[0]), int(parts[1]))
        if "ativo" in body:
            horario.ativo = body["ativo"]
        horario.atualizado_em = _datetime.utcnow()
        db.commit()
        return {"id": horario.id, "atualizado": True}
    except HTTPException:
        raise
    except Exception as _e:
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar horario: {str(_e)}")


@_http.delete("/api/sla/horario-comercial/{horario_id}", tags=["SLA Config"])
async def deletar_horario_comercial(horario_id: int, db=Depends(get_db)):
    try:
        from modules.sla.models import HorarioComercial
        horario = db.query(HorarioComercial).filter(HorarioComercial.id == horario_id).first()
        if not horario:
            raise HTTPException(status_code=404, detail="Horario nao encontrado")
        db.delete(horario)
        db.commit()
        return {"deletado": True}
    except HTTPException:
        raise
    except Exception as _e:
        raise HTTPException(status_code=500, detail=f"Erro ao deletar horario: {str(_e)}")


# ─── SLA Feriados ─────────────────────────────────────────────────────────────

@_http.get("/api/sla/feriados", tags=["SLA Config"])
async def listar_feriados(ano: int = None, db=Depends(get_db)):
    try:
        from modules.sla.models import Feriado
        from sqlalchemy import extract
        q = db.query(Feriado).filter(Feriado.ativo == True)
        if ano:
            q = q.filter(extract("year", Feriado.data) == ano)
        feriados = q.order_by(Feriado.data).all()
        return [
            {
                "id": f.id, "data": f.data.isoformat(), "nome": f.nome,
                "descricao": f.descricao, "tipo": f.tipo,
                "recorrente": f.recorrente, "ativo": f.ativo,
            }
            for f in feriados
        ]
    except Exception as _e:
        raise HTTPException(status_code=500, detail=f"Erro ao listar feriados: {str(_e)}")


@_http.post("/api/sla/feriados", tags=["SLA Config"])
async def criar_feriado(body: dict, db=Depends(get_db)):
    try:
        from modules.sla.models import Feriado
        from datetime import date as ddate
        data = ddate.fromisoformat(body["data"])
        feriado = Feriado(
            data=data, nome=body["nome"],
            descricao=body.get("descricao"),
            tipo=body.get("tipo", "nacional"),
            recorrente=body.get("recorrente", False),
            ativo=True,
        )
        db.add(feriado)
        db.commit()
        db.refresh(feriado)
        return {"id": feriado.id, "nome": feriado.nome, "data": feriado.data.isoformat()}
    except Exception as _e:
        raise HTTPException(status_code=500, detail=f"Erro ao criar feriado: {str(_e)}")


@_http.put("/api/sla/feriados/{feriado_id}", tags=["SLA Config"])
async def atualizar_feriado(feriado_id: int, body: dict, db=Depends(get_db)):
    try:
        from modules.sla.models import Feriado
        feriado = db.query(Feriado).filter(Feriado.id == feriado_id).first()
        if not feriado:
            raise HTTPException(status_code=404, detail="Feriado nao encontrado")
        for campo in ["nome", "descricao", "tipo", "recorrente", "ativo"]:
            if campo in body:
                setattr(feriado, campo, body[campo])
        feriado.atualizado_em = _datetime.utcnow()
        db.commit()
        return {"id": feriado.id, "atualizado": True}
    except HTTPException:
        raise
    except Exception as _e:
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar feriado: {str(_e)}")


@_http.delete("/api/sla/feriados/{feriado_id}", tags=["SLA Config"])
async def deletar_feriado(feriado_id: int, db=Depends(get_db)):
    try:
        from modules.sla.models import Feriado
        feriado = db.query(Feriado).filter(Feriado.id == feriado_id).first()
        if not feriado:
            raise HTTPException(status_code=404, detail="Feriado nao encontrado")
        feriado.ativo = False
        feriado.atualizado_em = _datetime.utcnow()
        db.commit()
        return {"deletado": True}
    except HTTPException:
        raise
    except Exception as _e:
        raise HTTPException(status_code=500, detail=f"Erro ao deletar feriado: {str(_e)}")


@_http.post("/api/sla/feriados/gerar/{ano}", tags=["SLA Config"])
async def gerar_feriados_ano(ano: int, sobrescrever: bool = False, db=Depends(get_db)):
    try:
        from modules.sla.models import Feriado
        from modules.sla.holidays import gerar_todos_feriados
        from datetime import date as _date
        from sqlalchemy import inspect as _inspect, text as _text
        from core.db import engine as _engine

        # Garante que a tabela existe — cria se necessário
        if not _inspect(_engine).has_table("sla_feriado"):
            print("[GERAR-FERIADOS] Tabela sla_feriado não existe — criando...")
            Feriado.__table__.create(bind=_engine, checkfirst=True)
            print("[GERAR-FERIADOS] Tabela sla_feriado criada com sucesso")

        feriados_gerados = gerar_todos_feriados(ano)
        inseridos = 0
        duplicados = 0
        for f_data in feriados_gerados:
            # Converte string para date — necessário para comparação correta no banco
            data_obj = _date.fromisoformat(f_data["data"]) if isinstance(f_data["data"], str) else f_data["data"]
            existe = db.query(Feriado).filter(
                Feriado.data == data_obj, Feriado.ativo == True
            ).first()
            if existe:
                if sobrescrever:
                    db.delete(existe)
                    db.flush()
                else:
                    duplicados += 1
                    continue
            feriado = Feriado(
                data=data_obj, nome=f_data["nome"],
                descricao=f_data.get("descricao", ""),
                tipo=f_data.get("tipo", "nacional"),
                recorrente=f_data.get("recorrente", False), ativo=True,
            )
            db.add(feriado)
            inseridos += 1
        db.commit()
        return {"ano": ano, "inseridos": inseridos, "duplicados": duplicados, "total": len(feriados_gerados)}
    except Exception as _e:
        import traceback
        print(f"\n[GERAR-FERIADOS] ❌ ERRO ao gerar feriados para {ano}:")
        print(f"[GERAR-FERIADOS] Tipo: {type(_e).__name__}")
        print(f"[GERAR-FERIADOS] Mensagem: {str(_e)}")
        traceback.print_exc()
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Erro ao gerar feriados ({type(_e).__name__}): {str(_e)}")


# ─────────────────────────────────────────────────────────────────────────────

# Criar índices de performance na inicialização
try:
    create_indices()
except Exception as e:
    print(f"⚠️  Erro ao criar índices de performance: {e}")

# Criar tabela de cache de métricas na inicialização
try:
    from ti.scripts.create_metrics_cache_table import create_metrics_cache_table
    create_metrics_cache_table()
    print("✅ Tabela metrics_cache_db criada com sucesso")
except Exception as e:
    print(f"⚠️  Erro ao criar tabela metrics_cache_db: {e}")


# Limpar estado de migrações anteriores que falharam
try:
    from ti.scripts.cleanup_migration_state import cleanup_migration_state
    cleanup_migration_state()
    print("✅ Limpeza de estado de migração concluída")
except Exception as e:
    print(f"⚠️  Aviso ao limpar estado: {e}")

# Executar migração do historico_status na inicialização
try:
    from ti.scripts.migrate_historico_status import migrate_historico_status
    migrate_historico_status()
    print("✅ Migração historico_status executada com sucesso")
except Exception as e:
    print(f"⚠️  Erro ao migrar historico_status: {e}")

# Adicionar colunas autor_email e autor_nome ao historico_status
try:
    from ti.scripts.migrate_historico_status_autor import migrate_historico_status_autor
    migrate_historico_status_autor()
except Exception as e:
    print(f"⚠️  Erro ao migrar colunas autor em historico_status: {e}")

# Adicionar foreign key constraint para usuario_id em historico_status
try:
    from ti.scripts.add_fk_usuario_id import add_fk_usuario_id
    add_fk_usuario_id()
except Exception as e:
    print(f"⚠️  Erro ao adicionar FK de usuario_id em historico_status: {e}")

# Criar tabela de configurações de notificações na inicialização
try:
    from ti.scripts.setup_notification_settings import create_notification_settings_table
    create_notification_settings_table()
except Exception as e:
    print(f"⚠️  Erro ao criar tabela notification_settings: {e}")

# Adicionar coluna retroativo se não existir
try:
    from ti.scripts.add_retroativo_column import add_retroativo_column
    add_retroativo_column()
except Exception as e:
    print(f"⚠️  Erro ao adicionar coluna retroativo: {e}")

# Restaurar status original dos chamados retroativos a partir do histórico
try:
    from ti.scripts.restore_retroativo_status import restore_retroativo_status
    restore_retroativo_status()
except Exception as e:
    print(f"⚠️  Erro ao restaurar status dos chamados retroativos: {e}")

# Marcar todos os chamados retroativos no banco de dados
try:
    from ti.scripts.mark_all_retroativo import mark_retroativo_tickets
    mark_retroativo_tickets()
except Exception as e:
    print(f"⚠️  Erro ao marcar chamados retroativos: {e}")

# Limpar cache de métricas para recalcular com filtro SLA
try:
    from ti.scripts.clear_metrics_cache import clear_metrics_cache as clear_cache
    clear_cache()
except Exception as e:
    print(f"⚠️  Erro ao limpar cache de métricas: {e}")

# Executar migração automática de status de chamados na inicialização
try:
    from ti.scripts.auto_migrate_status_values import auto_migrate_status_values
    auto_migrate_status_values()
except Exception as e:
    print(f"⚠️  Erro na migração automática de status: {e}")

# Criar índices compostos para acelerar listagem de chamados
try:
    from ti.scripts.create_composite_indexes import create_composite_indexes
    create_composite_indexes()
except Exception as e:
    print(f"⚠️  Erro ao criar índices compostos: {e}")

# Remover registros de "Mudança automática" gerados por versão antiga do código
try:
    from ti.scripts.cleanup_historico_automatico import cleanup_historico_automatico
    cleanup_historico_automatico()
except Exception as e:
    print(f"⚠️  Erro ao limpar histórico automático: {e}")

# Criar tabelas SLA automaticamente se não existirem
try:
    from ti.models.sla_pausa import SLAPausa
    from modules.sla.models import ConfiguracaoSLA, HorarioComercial, Feriado, InfoSLAChamado, LogCalculoSLA
    from core.db import engine, Base
    # Cria todas as tabelas SLA de uma vez usando o Base compartilhado
    for tbl_model in [SLAPausa, ConfiguracaoSLA, HorarioComercial, Feriado, InfoSLAChamado, LogCalculoSLA]:
        try:
            tbl_model.__table__.create(bind=engine, checkfirst=True)
        except Exception as tbl_err:
            print(f"⚠️  Erro ao criar tabela {tbl_model.__tablename__}: {tbl_err}")
    print("✅  Tabelas SLA verificadas/criadas")
    # Popula configurações padrão de SLA se a tabela estiver vazia
    from core.db import SessionLocal
    _db = SessionLocal()
    try:
        if _db.query(ConfiguracaoSLA).count() == 0:
            _defaults = [
                ConfiguracaoSLA(prioridade="Crítica",  tempo_resposta_horas=1,  tempo_resolucao_horas=4,  percentual_risco=70),
                ConfiguracaoSLA(prioridade="Alta",     tempo_resposta_horas=2,  tempo_resolucao_horas=8,  percentual_risco=75),
                ConfiguracaoSLA(prioridade="Normal",   tempo_resposta_horas=4,  tempo_resolucao_horas=16, percentual_risco=80),
                ConfiguracaoSLA(prioridade="Baixa",    tempo_resposta_horas=8,  tempo_resolucao_horas=40, percentual_risco=80),
            ]
            _db.add_all(_defaults)
            _db.commit()
            print("✅  Configurações padrão de SLA inseridas")
    except Exception as seed_err:
        print(f"⚠️  Erro ao popular configurações SLA: {seed_err}")
    finally:
        _db.close()
except Exception as e:
    print(f"⚠️  Erro ao criar tabelas SLA: {e}")

# Static uploads mount
_base_dir = Path(__file__).resolve().parent
_uploads = _base_dir / "uploads"
_uploads.mkdir(parents=True, exist_ok=True)
_http.mount("/uploads", StaticFiles(directory=str(_uploads), html=False), name="uploads")

_allowed_origins = [
    "http://localhost:3005",
    "http://127.0.0.1:3005",
    "http://localhost:5173",  # Vite default dev port
    "http://127.0.0.1:5173",
    "http://147.93.70.206:3005",  # VPS production IP
]

# Adicionar domínios de produção se disponíveis nas env vars
_prod_frontend_url = os.getenv("FRONTEND_URL", "").strip()
_prod_domain = os.getenv("PRODUCTION_DOMAIN", "").strip()
_financial_portal_url = os.getenv("FINANCIAL_PORTAL_URL", "").strip()

if _prod_frontend_url:
    _allowed_origins.append(_prod_frontend_url)
if _prod_domain:
    _allowed_origins.append(f"https://{_prod_domain}")
    _allowed_origins.append(f"http://{_prod_domain}")
if _financial_portal_url:
    _allowed_origins.append(_financial_portal_url)

_http.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Middleware para logar todas as requisições Auth0
@_http.middleware("http")
async def log_auth_requests(request: Request, call_next):
    """Log all Auth0-related requests for debugging"""
    if "/api/auth" in request.url.path:
        print(f"\n[MIDDLEWARE] 📥 Incoming request")
        print(f"[MIDDLEWARE] Method: {request.method}")
        print(f"[MIDDLEWARE] Path: {request.url.path}")
        print(f"[MIDDLEWARE] Full URL: {request.url}")
        print(f"[MIDDLEWARE] Headers:")
        for header, value in request.headers.items():
            if header.lower() not in ["authorization"]:
                print(f"[MIDDLEWARE]   - {header}: {value}")
            else:
                print(f"[MIDDLEWARE]   - {header}: ***[REDACTED]***")

    try:
        response = await call_next(request)

        if "/api/auth" in request.url.path:
            print(f"[MIDDLEWARE] 📤 Response status: {response.status_code}")
            print(f"[MIDDLEWARE] Response headers: {dict(response.headers)}")

        return response
    except Exception as e:
        print(f"[MIDDLEWARE] ❌ Exception occurred: {type(e).__name__}: {str(e)}")
        raise

@_http.get("/api/ping")
def ping():
    return {"message": "pong"}

@_http.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute("SELECT 1")
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        print(f"Database health check failed: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "database": str(e)}, 500


@_http.get("/api/test-backend")
def test_backend():
    """Simples teste para confirmar que o backend foi reiniciado"""
    return {"status": "Backend está rodando com o código atualizado!", "timestamp": "OK"}


@_http.get("/api/debug/routes")
def debug_routes():
    """Debug - listar todas as rotas registradas"""
    routes = []
    for route in _http.routes:
        if hasattr(route, 'path'):
            routes.append({
                "path": route.path,
                "methods": getattr(route, 'methods', []) or ['GET'],
            })
    return {
        "total_routes": len(routes),
        "routes": sorted(routes, key=lambda x: x['path']),
        "powerbi_embed_token_registered": any("/powerbi/embed-token" in r['path'] for r in routes),
    }


@_http.post("/api/login-media/upload")
async def upload_login_media(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file:
        raise HTTPException(status_code=400, detail="Arquivo ausente")

    content_type = (file.content_type or "").lower()
    print(f"[UPLOAD] Arquivo: {file.filename}, Content-Type: {content_type}")

    if content_type.startswith("image/"):
        kind = "foto"
    elif content_type.startswith("video/"):
        kind = "video"
    else:
        raise HTTPException(status_code=400, detail="Tipo de arquivo não suportado")

    original_name = Path(file.filename or "arquivo").name
    titulo = Path(original_name).stem or "mídia"

    data = await file.read()
    print(f"[UPLOAD] Tamanho do arquivo: {len(data)} bytes")

    try:
        m = Media(
            tipo=kind,
            titulo=titulo,
            descricao=None,
            arquivo_blob=data,
            mime_type=content_type,
            tamanho_bytes=len(data),
            status="ativo",
        )
        db.add(m)
        db.commit()
        db.refresh(m)

        print(f"[UPLOAD] Salvo com ID: {m.id}")

        m.url = f"/api/login-media/{m.id}/download"
        db.add(m)
        db.commit()

        media_type = "image" if kind == "foto" else "video"
        result = {
            "id": m.id,
            "type": media_type,
            "url": f"/api/login-media/{m.id}/download",
            "mime": m.mime_type,
        }
        print(f"[UPLOAD] Resposta: {result}")
        return result
    except Exception as e:
        print(f"[UPLOAD] Falha ao salvar registro: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Falha ao salvar registro: {str(e)}")


@_http.get("/api/login-media/debug/all")
def login_media_debug_all(db: Session = Depends(get_db)):
    """Lista TODOS os vídeos (ativo e inativo) para debug"""
    try:
        all_media = db.query(Media).all()
        return {
            "total": len(all_media),
            "items": [
                {
                    "id": m.id,
                    "tipo": m.tipo,
                    "titulo": m.titulo,
                    "mime_type": m.mime_type,
                    "tamanho_bytes": m.tamanho_bytes,
                    "arquivo_blob_size": len(m.arquivo_blob) if m.arquivo_blob else 0,
                    "status": m.status,
                }
                for m in all_media
            ]
        }
    except Exception as e:
        print(f"[DEBUG_ALL] Erro: {e}")
        import traceback
        traceback.print_exc()
        return {"erro": str(e)}


@_http.get("/api/login-media")
def login_media(db: Session = Depends(get_db)):
    try:
        try:
            Media.__table__.create(bind=engine, checkfirst=True)
        except Exception as create_err:
            print(f"Erro ao criar tabela: {create_err}")
        q = db.query(Media).filter(Media.status == "ativo").order_by(Media.id.desc()).all()
        out = []
        for m in q:
            media_type = "image" if m.tipo == "foto" else "video" if m.tipo == "video" else "image"
            out.append(
                {
                    "id": m.id,
                    "type": media_type,
                    "url": f"/api/login-media/{m.id}/download",
                    "title": m.titulo,
                    "description": m.descricao,
                    "mime": m.mime_type,
                }
            )
        return out
    except Exception as e:
        print(f"Erro ao listar mídias: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao listar mídias: {str(e)}")


@_http.get("/api/login-media/{item_id}/download")
def download_login_media(item_id: int, request: Request, db: Session = Depends(get_db)):
    print(f"\n[DL] ==== START ID:{item_id} ====")
    try:
        m = db.query(Media).filter(Media.id == int(item_id)).first()
        print(f"[DL] Query result: {m is not None}")

        if not m:
            print(f"[DL] Not found")
            raise HTTPException(status_code=404, detail="Not found")

        print(f"[DL] Type:{m.tipo} Status:{m.status} Title:{m.titulo}")

        blob = m.arquivo_blob
        print(f"[DL] Blob type: {type(blob).__name__} Size: {len(blob) if blob else 0}")

        if not blob:
            raise HTTPException(status_code=404, detail="No data")

        mime = m.mime_type or "application/octet-stream"
        # Sanitize filename: remove emojis and non-ASCII characters for HTTP headers
        title_clean = (m.titulo or "media").encode("ascii", errors="ignore").decode("ascii")
        name = title_clean.replace(" ", "_").replace("/", "_").replace("\\", "_")
        if not name or name.strip() == "":
            name = "media"
        file_size = len(blob)

        # Check for Range header (HTTP 206 Partial Content)
        range_header = request.headers.get("range")

        if range_header:
            # Parse range header (e.g., "bytes=0-1023")
            try:
                range_value = range_header.replace("bytes=", "")
                if "-" in range_value:
                    start_str, end_str = range_value.split("-")
                    start = int(start_str) if start_str else 0
                    end = int(end_str) if end_str else file_size - 1

                    # Validate range
                    if start < 0 or end >= file_size or start > end:
                        raise ValueError("Invalid range")

                    chunk_size = end - start + 1
                    print(f"[DL] Range request: bytes {start}-{end}/{file_size}")

                    return Response(
                        content=blob[start:end + 1],
                        status_code=206,
                        media_type=mime,
                        headers={
                            "Content-Disposition": f"inline; filename={name}",
                            "Content-Range": f"bytes {start}-{end}/{file_size}",
                            "Accept-Ranges": "bytes",
                            "Content-Length": str(chunk_size),
                        }
                    )
            except (ValueError, AttributeError) as e:
                print(f"[DL] Invalid range header: {e}")
                # Fall through to normal response if range is invalid

        print(f"[DL] Returning: {len(blob)} bytes as {mime}")
        print(f"[DL] ==== END ====\n")

        return Response(
            content=blob,
            media_type=mime,
            headers={
                "Content-Disposition": f"inline; filename={name}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(file_size),
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"[DL] EXCEPTION: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@_http.get("/api/login-media/{item_id}/debug")
def login_media_debug(item_id: int, db: Session = Depends(get_db)):
    """Debug de um vídeo específico"""
    try:
        m = db.query(Media).filter(Media.id == int(item_id)).first()
        if not m:
            return {"erro": "Não encontrada", "id": item_id}
        return {
            "id": m.id,
            "tipo": m.tipo,
            "titulo": m.titulo,
            "mime_type": m.mime_type,
            "tamanho_bytes": m.tamanho_bytes,
            "arquivo_blob_size": len(m.arquivo_blob) if m.arquivo_blob else 0,
            "arquivo_blob_type": type(m.arquivo_blob).__name__,
            "status": m.status,
        }
    except Exception as e:
        print(f"[DEBUG_{item_id}] Erro: {e}")
        import traceback
        traceback.print_exc()
        return {"erro": str(e)}


@_http.delete("/api/login-media/{item_id}")
async def delete_login_media(item_id: int, db: Session = Depends(get_db)):
    try:
        m = db.query(Media).filter(Media.id == int(item_id)).first()
        if not m:
            raise HTTPException(status_code=404, detail="Item não encontrado")
        m.status = "inativo"
        db.add(m)
        db.commit()
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao remover mídia: {e}")


# ══════════════════════════════════════════════════════════════════════════════
# WEBSOCKET ENDPOINT - Comunicação em tempo real
# ══════════════════════════════════════════════════════════════════════════════

class ConnectionManager:
    """Gerenciador de conexões WebSocket"""
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        self.active_connections[session_id] = websocket
        print(f"✅ [WebSocket] Cliente conectado: {session_id}")
        print(f"   Total de conexões ativas: {len(self.active_connections)}")

    def disconnect(self, session_id: str):
        if session_id in self.active_connections:
            del self.active_connections[session_id]
            print(f"🔴 [WebSocket] Cliente desconectado: {session_id}")
            print(f"   Total de conexões ativas: {len(self.active_connections)}")

    async def send_personal_message(self, message: str, session_id: str):
        if session_id in self.active_connections:
            try:
                await self.active_connections[session_id].send_text(message)
            except Exception as e:
                print(f"⚠️ [WebSocket] Erro ao enviar mensagem para {session_id}: {e}")

    async def send_json(self, data: dict, session_id: str):
        if session_id in self.active_connections:
            try:
                await self.active_connections[session_id].send_json(data)
            except Exception as e:
                print(f"⚠️ [WebSocket] Erro ao enviar JSON para {session_id}: {e}")

    async def broadcast(self, message: str):
        disconnected = []
        for session_id, connection in self.active_connections.items():
            try:
                await connection.send_text(message)
            except Exception as e:
                print(f"⚠️ [WebSocket] Erro no broadcast para {session_id}: {e}")
                disconnected.append(session_id)
        
        # Remover conexões que falharam
        for session_id in disconnected:
            self.disconnect(session_id)

    async def broadcast_json(self, data: dict):
        disconnected = []
        for session_id, connection in self.active_connections.items():
            try:
                await connection.send_json(data)
            except Exception as e:
                print(f"⚠️ [WebSocket] Erro no broadcast JSON para {session_id}: {e}")
                disconnected.append(session_id)
        
        # Remover conexões que falharam
        for session_id in disconnected:
            self.disconnect(session_id)


# Instância global do gerenciador de conexões
ws_manager = ConnectionManager()


@_http.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, sessionId: str = None):
    """
    Endpoint WebSocket para comunicação em tempo real.
    Aceita conexões com parâmetro sessionId opcional.
    """
    session_id = sessionId or str(uuid.uuid4())
    
    print(f"\n{'='*60}")
    print(f"[WebSocket] Nova conexão recebida")
    print(f"   Session ID: {session_id}")
    print(f"   Client: {websocket.client}")
    print(f"   Headers Origin: {websocket.headers.get('origin', 'N/A')}")
    print(f"{'='*60}\n")
    
    try:
        # Aceitar a conexão
        await ws_manager.connect(websocket, session_id)
        
        # Enviar mensagem de boas-vindas
        await websocket.send_json({
            "type": "connection",
            "status": "connected",
            "sessionId": session_id,
            "message": "Conexão WebSocket estabelecida com sucesso"
        })
        
        # Loop de mensagens
        while True:
            try:
                # Receber mensagem do cliente
                data = await websocket.receive_text()
                
                # Log da mensagem recebida
                print(f"📨 [WebSocket] Mensagem de {session_id}: {data[:200]}...")
                
                # Processar mensagem
                try:
                    message = json.loads(data)
                    message_type = message.get("type", "unknown")
                    
                    # Responder baseado no tipo de mensagem
                    if message_type == "ping":
                        await websocket.send_json({
                            "type": "pong",
                            "sessionId": session_id,
                            "timestamp": str(_datetime.utcnow().isoformat())
                        })
                    elif message_type == "subscribe":
                        # Cliente quer se inscrever em um canal
                        channel = message.get("channel", "default")
                        await websocket.send_json({
                            "type": "subscribed",
                            "channel": channel,
                            "sessionId": session_id
                        })
                    else:
                        # Echo padrão para outros tipos
                        await websocket.send_json({
                            "type": "echo",
                            "original": message,
                            "sessionId": session_id
                        })
                    
                except json.JSONDecodeError:
                    # Se não for JSON válido, enviar echo como texto
                    await websocket.send_json({
                        "type": "echo",
                        "message": data,
                        "sessionId": session_id
                    })
                    
            except WebSocketDisconnect:
                print(f"🔴 [WebSocket] Cliente {session_id} desconectou normalmente")
                break
            except Exception as e:
                print(f"⚠️ [WebSocket] Erro no loop de {session_id}: {e}")
                import traceback
                traceback.print_exc()
                break
                
    except Exception as e:
        print(f"❌ [WebSocket] Erro na conexão {session_id}: {e}")
        import traceback
        traceback.print_exc()
    finally:
        ws_manager.disconnect(session_id)


@_http.get("/api/ws/status")
def websocket_status():
    """Retorna o status das conexões WebSocket ativas"""
    return {
        "status": "ok",
        "active_connections": len(ws_manager.active_connections),
        "sessions": list(ws_manager.active_connections.keys())
    }


@_http.post("/api/ws/broadcast")
async def websocket_broadcast(message: Dict[str, Any]):
    """Envia uma mensagem para todos os clientes WebSocket conectados"""
    try:
        await ws_manager.broadcast_json(message)
        return {
            "status": "ok",
            "sent_to": len(ws_manager.active_connections)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro no broadcast: {str(e)}")


# ══════════════════════════════════════════════════════════════════════════════
# FIM DO WEBSOCKET ENDPOINT
# ══════════════════════════════════════════════════════════════════════════════


# Register all routers (only once to avoid conflicts)
# Auth0 router must come first since it has its own /api/auth prefix
_http.include_router(auth0_router)

# Other routers with /api prefix
_http.include_router(chamados_router, prefix="/api")
_http.include_router(usuarios_router, prefix="/api")
_http.include_router(unidades_router, prefix="/api")
_http.include_router(problemas_router, prefix="/api")
_http.include_router(notifications_router, prefix="/api")
_http.include_router(notification_settings_router, prefix="/api")
_http.include_router(alerts_router, prefix="/api")
_http.include_router(email_debug_router, prefix="/api")
_http.include_router(powerbi_router, prefix="/api")
_http.include_router(metrics_router, prefix="/api")
_http.include_router(dashboard_permissions_router, prefix="")
if grupos_router is not None:
    _http.include_router(grupos_router, prefix="/api")
    print("✅ [GRUPOS] Router registrado em /api/grupos")
else:
    print("❌ [GRUPOS] Router NÃO registrado — verifique os logs acima")
# sla_router removido — endpoints SLA registrados diretamente (ver acima)

# Wrap with Socket.IO ASGI app (exports as 'app')
app = mount_socketio(_http)


# Register event loop for Socket.IO sync-to-async bridge
import asyncio
from core.realtime import set_event_loop

@_http.on_event("startup")
async def startup_event():
    """Register the event loop for Socket.IO event emission from sync context"""
    try:
        loop = asyncio.get_event_loop()
        set_event_loop(loop)
        print(f"[STARTUP] ✓ Event loop registered for Socket.IO: {loop}")
        print(f"[STARTUP] ✓ WebSocket endpoint disponível em /ws")
        print(f"[STARTUP] ✓ Socket.IO disponível em /socket.io")
    except Exception as e:
        print(f"[STARTUP] ⚠️  Failed to register event loop: {e}")


@_http.on_event("shutdown")
async def shutdown_event():
    """Shutdown event"""
    print(f"[SHUTDOWN] Fechando {len(ws_manager.active_connections)} conexões WebSocket...")
    pass
