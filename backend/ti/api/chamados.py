from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Body, Request
from sqlalchemy.orm import Session
from sqlalchemy import and_
from core.db import get_db, engine
from auth0.validator import verify_auth0_token
from ti.schemas.chamado import (
    ChamadoCreate,
    ChamadoOut,
    ChamadoStatusUpdate,
    ChamadoDeleteRequest,
    ALLOWED_STATUSES,
)
from ti.services.chamados import criar_chamado as service_criar
from core.realtime import sio
from werkzeug.security import check_password_hash
from ..models.notification import Notification
import json
from core.utils import now_brazil_naive
from ..models import Chamado, User, TicketAnexo, ChamadoAnexo, HistoricoTicket, HistoricoStatus, HistoricoAnexo
from ti.models.metrics_cache import MetricsCacheDB
from ti.schemas.attachment import AnexoOut
from ti.schemas.ticket import HistoricoItem, HistoricoResponse
from sqlalchemy import inspect, text
from core.email_msgraph import send_async, send_chamado_abertura, send_chamado_status

from fastapi.responses import Response
from sqlalchemy import insert
import json
from datetime import datetime, timedelta

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def get_current_user_from_request(request: Request) -> dict | None:
    """
    Extrai o usuário do JWT token no header Authorization se disponível.
    Retorna None se não houver token ou se a validação falhar.
    """
    try:
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return None

        token = auth_header.replace("Bearer ", "").strip()
        if not token:
            return None

        # Valida o token JWT
        user_data = verify_auth0_token(token)
        return user_data
    except Exception as e:
        print(f"[AUTH] Erro ao extrair usuário do JWT: {e}")
        return None

# ============================================================================
# CACHE MANAGER INLINED - Chamados de hoje com reset à meia-noite
# ============================================================================

class ChamadosTodayCounter:
    """
    Counter para "chamados hoje" com reset automático à meia-noite.

    Armazenado no banco como cache com chave especial "chamados_hoje_{data}"
    Permite recuperar valor mesmo após reinicialização do servidor.
    """

    @staticmethod
    def get_cache_key_today() -> str:
        """Gera chave de cache baseada na data de hoje"""
        hoje = now_brazil_naive().date().isoformat()
        return f"chamados_hoje:{hoje}"

    @staticmethod
    def get_cache_key_for_date(date: datetime) -> str:
        """Gera chave de cache para uma data específica"""
        return f"chamados_hoje:{date.date().isoformat()}"

    @staticmethod
    def get_count(db: Session) -> int:
        """Obtém contador de chamados de hoje"""
        try:
            cache_key = ChamadosTodayCounter.get_cache_key_today()

            cached = db.query(MetricsCacheDB).filter(
                MetricsCacheDB.cache_key == cache_key
            ).first()

            if cached and cached.expires_at and cached.expires_at > now_brazil_naive():
                try:
                    return int(json.loads(cached.cache_value))
                except:
                    return 0

            # Se expirou, recalcula (isso só deve acontecer após meia-noite)
            return ChamadosTodayCounter._recalculate(db)

        except Exception as e:
            print(f"[CACHE] Erro ao obter contador de hoje: {e}")
            return 0

    @staticmethod
    def increment(db: Session, count: int = 1) -> int:
        """Incrementa contador de chamados de hoje"""
        try:
            cache_key = ChamadosTodayCounter.get_cache_key_today()

            # Obtém valor atual
            cached = db.query(MetricsCacheDB).filter(
                MetricsCacheDB.cache_key == cache_key
            ).first()

            # Se expirou (passou meia-noite), recalcula
            if not cached or (cached.expires_at and cached.expires_at <= now_brazil_naive()):
                new_value = ChamadosTodayCounter._recalculate(db)
                return new_value + count

            # Incrementa o valor existente
            try:
                current_value = int(json.loads(cached.cache_value))
            except:
                current_value = 0

            new_value = current_value + count

            # Atualiza cache com expire à meia-noite
            agora = now_brazil_naive()
            proximo_dia = (agora + timedelta(days=1)).replace(
                hour=0, minute=0, second=0, microsecond=0
            )

            cached.cache_value = json.dumps(new_value)
            cached.calculated_at = agora
            cached.expires_at = proximo_dia
            db.add(cached)
            db.commit()

            return new_value

        except Exception as e:
            print(f"[CACHE] Erro ao incrementar contador: {e}")
            try:
                db.rollback()
            except:
                pass
            return ChamadosTodayCounter._recalculate(db)

    @staticmethod
    def decrement(db: Session, count: int = 1) -> int:
        """Decrementa contador de chamados de hoje (para cancelamentos)"""
        try:
            cache_key = ChamadosTodayCounter.get_cache_key_today()

            cached = db.query(MetricsCacheDB).filter(
                MetricsCacheDB.cache_key == cache_key
            ).first()

            if not cached or (cached.expires_at and cached.expires_at <= now_brazil_naive()):
                return ChamadosTodayCounter._recalculate(db)

            try:
                current_value = int(json.loads(cached.cache_value))
            except:
                current_value = 0

            new_value = max(0, current_value - count)

            agora = now_brazil_naive()
            proximo_dia = (agora + timedelta(days=1)).replace(
                hour=0, minute=0, second=0, microsecond=0
            )

            try:
                cached.cache_value = json.dumps(new_value)
                cached.calculated_at = agora
                cached.expires_at = proximo_dia
                db.add(cached)
                db.commit()
            except Exception as commit_error:
                db.rollback()
                print(f"[CACHE] Erro ao commit decrement: {commit_error}")
                raise

            return new_value

        except Exception as e:
            print(f"[CACHE] Erro ao decrementar contador: {e}")
            try:
                db.rollback()
            except:
                pass
            return ChamadosTodayCounter._recalculate(db)

    @staticmethod
    def _recalculate(db: Session) -> int:
        """Recalcula contador de hoje a partir do banco de dados"""
        try:
            hoje = now_brazil_naive().replace(hour=0, minute=0, second=0, microsecond=0)

            count = db.query(Chamado).filter(
                and_(
                    Chamado.data_abertura >= hoje,
                    Chamado.status != "Expirado"
                )
            ).count()

            # Salva no cache com expire à meia-noite
            cache_key = ChamadosTodayCounter.get_cache_key_today()
            agora = now_brazil_naive()
            proximo_dia = (agora + timedelta(days=1)).replace(
                hour=0, minute=0, second=0, microsecond=0
            )

            try:
                existing = db.query(MetricsCacheDB).filter(
                    MetricsCacheDB.cache_key == cache_key
                ).first()

                if existing:
                    existing.cache_value = json.dumps(count)
                    existing.calculated_at = agora
                    existing.expires_at = proximo_dia
                    db.add(existing)
                else:
                    new_cache = MetricsCacheDB(
                        cache_key=cache_key,
                        cache_value=json.dumps(count),
                        calculated_at=agora,
                        expires_at=proximo_dia,
                    )
                    db.add(new_cache)

                db.commit()
            except Exception as commit_error:
                db.rollback()
                print(f"[CACHE] Erro ao commit recalculate: {commit_error}")

            return count

        except Exception as e:
            print(f"[CACHE] Erro ao recalcular contador: {e}")
            try:
                db.rollback()
            except:
                pass
            return 0


class IncrementalMetricsCache:
    """
    Cache de métricas mensais com cálculos incrementais.

    Estratégia:
    - Cache persiste até final do mês (dia 28/29/30/31 às 23:59:59)
    - Quando um chamado é alterado, recalcula apenas aquele chamado
    - Soma resultado com cache base para obter novas métricas
    - Reset automático no dia 1º do próximo mês às 00:00
    """

    @staticmethod
    def get_cache_key_month() -> str:
        """Gera chave de cache para o mês atual"""
        agora = now_brazil_naive()
        ano_mes = agora.strftime("%Y-%m")
        return f"sla_metrics_mes:{ano_mes}"

    @staticmethod
    def get_expire_time_for_month() -> datetime:
        """Retorna data/hora do último segundo do mês"""
        agora = now_brazil_naive()

        # Calcula último dia do mês
        if agora.month == 12:
            proximo_mes = agora.replace(year=agora.year + 1, month=1, day=1)
        else:
            proximo_mes = agora.replace(month=agora.month + 1, day=1)

        # Último segundo do mês = um segundo antes de virar para o próximo mês
        ultimo_segundo = proximo_mes - timedelta(seconds=1)
        return ultimo_segundo

    @staticmethod
    def get_metrics(db: Session) -> dict:
        """Obtém métricas mensais do cache com fallback robusto"""
        try:
            cache_key = IncrementalMetricsCache.get_cache_key_month()

            # Tenta obter do cache
            try:
                cached = db.query(MetricsCacheDB).filter(
                    MetricsCacheDB.cache_key == cache_key
                ).first()

                if cached and cached.expires_at and cached.expires_at > now_brazil_naive():
                    try:
                        metrics = json.loads(cached.cache_value)
                        # Validação básica
                        if all(k in metrics for k in ["total", "dentro_sla", "fora_sla"]):
                            return metrics
                    except (json.JSONDecodeError, ValueError):
                        print(f"[CACHE] Cache corrompido para {cache_key}, recalculando...")
                        pass
            except Exception as cache_error:
                print(f"[CACHE] Erro ao buscar cache do banco: {cache_error}")
                pass

            # Cache não existe ou expirou, recalcula (de forma otimizada)
            return IncrementalMetricsCache._calculate_month(db)

        except Exception as e:
            print(f"[CACHE] Erro ao obter métricas mensais: {e}")
            # Retorna valores seguros
            return {
                "total": 0,
                "dentro_sla": 0,
                "fora_sla": 0,
                "percentual_dentro": 0,
                "percentual_fora": 0,
            }

    @staticmethod
    def update_for_chamado(db: Session, chamado_id: int) -> None:
        """
        Atualiza métricas incrementalmente quando um chamado é alterado.

        Em vez de recalcular TUDO, calcula apenas aquele chamado
        e soma com as métricas em cache.
        """
        try:
            chamado = db.query(Chamado).filter(Chamado.id == chamado_id).first()
            if not chamado:
                return

            # Obtém métricas atuais do cache
            metricas_atuais = IncrementalMetricsCache.get_metrics(db)

            # SLA foi removido - apenas invalida o cache
            IncrementalMetricsCache.invalidate_cache(db)

        except Exception as e:
            print(f"[CACHE] Erro ao atualizar métricas para chamado {chamado_id}: {e}")

    @staticmethod
    def _calculate_month(db: Session) -> dict:
        """Calcula métricas mensais do zero com debouncing"""
        try:
            cache_key = IncrementalMetricsCache.get_cache_key_month()

            def calculate_metrics():
                agora = now_brazil_naive()
                mes_inicio = agora.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

                # Métricas básicas (SLA removido)
                metricas = {
                    "total": 0,
                    "dentro_sla": 0,
                    "fora_sla": 0,
                    "percentual_dentro": 0,
                    "percentual_fora": 0,
                    "updated_at": agora.isoformat(),
                }

                # Salva no cache
                IncrementalMetricsCache._save_metrics(db, metricas)

                return metricas

            # Cálculo simples (SLA foi removido)
            result = calculate_metrics()

            if result is None:
                # Fallback se cálculo falhar
                return {
                    "total": 0,
                    "dentro_sla": 0,
                    "fora_sla": 0,
                    "percentual_dentro": 0,
                    "percentual_fora": 0,
                }

            return result

        except Exception as e:
            print(f"[CACHE] Erro ao calcular métricas mensais: {e}")
            return {
                "total": 0,
                "dentro_sla": 0,
                "fora_sla": 0,
                "percentual_dentro": 0,
                "percentual_fora": 0,
            }

    @staticmethod
    def _save_metrics(db: Session, metricas: dict) -> None:
        """Salva métricas no cache com expiração até fim do mês"""
        try:
            cache_key = IncrementalMetricsCache.get_cache_key_month()
            expire_time = IncrementalMetricsCache.get_expire_time_for_month()

            agora = now_brazil_naive()
            cache_value = json.dumps(metricas)

            try:
                existing = db.query(MetricsCacheDB).filter(
                    MetricsCacheDB.cache_key == cache_key
                ).first()

                if existing:
                    existing.cache_value = cache_value
                    existing.calculated_at = agora
                    existing.expires_at = expire_time
                    db.add(existing)
                else:
                    new_cache = MetricsCacheDB(
                        cache_key=cache_key,
                        cache_value=cache_value,
                        calculated_at=agora,
                        expires_at=expire_time,
                    )
                    db.add(new_cache)

                db.commit()
            except Exception as commit_error:
                db.rollback()
                print(f"[CACHE] Erro ao commit métricas: {commit_error}")

        except Exception as e:
            print(f"[CACHE] Erro ao salvar métricas: {e}")
            try:
                db.rollback()
            except:
                pass

    @staticmethod
    def _save_chamado_status(
        db: Session,
        chamado_id: int,
        dentro_sla: bool
    ) -> None:
        """Salva status de SLA do chamado para referência incremental"""
        try:
            cache_key = f"chamado_sla_status:{chamado_id}"

            expire_time = IncrementalMetricsCache.get_expire_time_for_month()
            agora = now_brazil_naive()

            cache_value = json.dumps({"dentro_sla": dentro_sla})

            try:
                existing = db.query(MetricsCacheDB).filter(
                    MetricsCacheDB.cache_key == cache_key
                ).first()

                if existing:
                    existing.cache_value = cache_value
                    existing.calculated_at = agora
                    existing.expires_at = expire_time
                    db.add(existing)
                else:
                    new_cache = MetricsCacheDB(
                        cache_key=cache_key,
                        cache_value=cache_value,
                        calculated_at=agora,
                        expires_at=expire_time,
                    )
                    db.add(new_cache)

                db.commit()
            except Exception as commit_error:
                db.rollback()
                print(f"[CACHE] Erro ao commit status do chamado: {commit_error}")

        except Exception as e:
            print(f"[CACHE] Erro ao salvar status do chamado: {e}")
            try:
                db.rollback()
            except:
                pass

    @staticmethod
    def invalidate_cache(db: Session) -> None:
        """Invalida o cache de métricas"""
        try:
            cache_key = IncrementalMetricsCache.get_cache_key_month()
            cached = db.query(MetricsCacheDB).filter(
                MetricsCacheDB.cache_key == cache_key
            ).first()
            if cached:
                db.delete(cached)
                db.commit()
        except Exception as e:
            print(f"[CACHE] Erro ao invalidar cache: {e}")


# ============================================================================
# Imports necessários adicionados
# ============================================================================

router = APIRouter(prefix="/chamados", tags=["TI - Chamados"])


def _normalize_status(s: str) -> str:
    """
    Normaliza o status para o formato padrão.
    Formatos aceitos: Aberto, Em atendimento, Aguardando, Concluído, Expirado
    """
    if not s:
        return "Aberto"
    
    # Remove espaços extras e converte para lowercase para comparação
    s_lower = s.strip().lower()
    
    # Mapeamento direto baseado em lowercase
    mapping_lower = {
        "aberto": "Aberto",
        "em andamento": "Em atendimento",
        "emandamento": "Em atendimento",
        "em_atendimento": "Em atendimento",
        "em atendimento": "Em atendimento",
        "aguardando": "Aguardando",
        "analise": "Aguardando",
        "emanalise": "Aguardando",
        "em_analise": "Aguardando",
        "em_análise": "Aguardando",
        "análise": "Aguardando",
        "concluído": "Concluído",
        "concluido": "Concluído",
        "finalizado": "Concluído",
        "expirado": "Expirado",
        "cancelado": "Expirado",
    }
    
    if s_lower in mapping_lower:
        return mapping_lower[s_lower]
    
    # Se não encontrou, verifica se já está no formato correto
    if s in ALLOWED_STATUSES:
        return s
    
    # Caso padrão
    print(f"[NORMALIZE] Status não reconhecido: '{s}' - retornando 'Aberto'")
    return "Aberto" 


def _table_exists(table_name: str) -> bool:
    """Verifica se uma tabela existe no banco de dados"""
    try:
        from sqlalchemy import inspect as sa_inspect
        insp = sa_inspect(engine)
        return insp.has_table(table_name)
    except Exception:
        return False


@router.get("", response_model=list[ChamadoOut])
def listar_chamados(db: Session = Depends(get_db), after_date: str = None):
    """
    Lista todos os chamados nao deletados.

    Query params:
    - after_date: Data no formato YYYY-MM-DD para filtrar chamados posteriores a essa data (baseado em data_abertura)
    """
    import logging
    _log = logging.getLogger("ti.api.chamados")

    # Garantir que a tabela existe
    try:
        Chamado.__table__.create(bind=engine, checkfirst=True)
    except Exception:
        pass

    # Garantir coluna retroativo existe (migracao defensiva)
    try:
        insp = inspect(engine)
        cols = [c["name"] for c in insp.get_columns("chamado")]
        if "retroativo" not in cols:
            with engine.connect() as conn:
                conn.execute(text("ALTER TABLE chamado ADD COLUMN retroativo BOOLEAN NOT NULL DEFAULT 0"))
                conn.commit()
            _log.info("[CHAMADOS] Coluna retroativo adicionada ao banco")
    except Exception as mig_err:
        _log.warning(f"[CHAMADOS] Aviso na migracao de retroativo: {mig_err}")

    try:
        from datetime import datetime

        query = db.query(Chamado).filter(Chamado.deletado_em.is_(None))

        # Aplicar filtro de data se fornecido
        if after_date:
            try:
                date_obj = datetime.strptime(after_date, "%Y-%m-%d")
                query = query.filter(Chamado.data_abertura >= date_obj)
            except ValueError:
                pass

        chamados = query.order_by(Chamado.id.desc()).all()
        return chamados

    except Exception as e:
        _log.error(f"[CHAMADOS] Erro ao listar chamados: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro ao listar chamados: {str(e)}")


@router.post("", response_model=ChamadoOut)
def criar_chamado(payload: ChamadoCreate, db: Session = Depends(get_db)):
    try:
        try:
            Chamado.__table__.create(bind=engine, checkfirst=True)
        except Exception:
            pass
        ch = service_criar(db, payload)

        # ATUALIZAÇÃO REAL-TIME: Incrementa contador de "chamados hoje"
        chamados_hoje = ChamadosTodayCounter.increment(db)

        try:
            Notification.__table__.create(bind=engine, checkfirst=True)
            dados = json.dumps({
                "id": ch.id,
                "codigo": ch.codigo,
                "protocolo": ch.protocolo,
                "status": ch.status,
            }, ensure_ascii=False)
            n = Notification(
                tipo="chamado",
                titulo=f"Novo chamado {ch.codigo}",
                mensagem=f"{ch.solicitante} abriu um chamado de {ch.problema} na unidade {ch.unidade}",
                recurso="chamado",
                recurso_id=ch.id,
                acao="criado",
                dados=dados,
            )
            db.add(n)
            db.commit()
            db.refresh(n)
            import anyio
            anyio.from_thread.run(sio.emit, "chamado:created", {"id": ch.id})
            anyio.from_thread.run(sio.emit, "notification:new", {
                "id": n.id,
                "tipo": n.tipo,
                "titulo": n.titulo,
                "mensagem": n.mensagem,
                "recurso": n.recurso,
                "recurso_id": n.recurso_id,
                "acao": n.acao,
                "dados": n.dados,
                "lido": n.lido,
                "criado_em": n.criado_em.isoformat() if n.criado_em else None,
            })
            # EMITE ATUALIZAÇÃO DE MÉTRICAS EM TEMPO REAL
            metricas = IncrementalMetricsCache.get_metrics(db)
            anyio.from_thread.run(sio.emit, "metrics:updated", {
                "chamados_hoje": chamados_hoje,
                "timestamp": now_brazil_naive().isoformat(),
            })
        except Exception as e:
            print(f"[WebSocket] Erro ao emitir eventos: {e}")
            pass
        try:
            print(f"[CHAMADOS] 📧 Chamado {ch.codigo} criado. Disparando envio de email de abertura...")
            send_async(send_chamado_abertura, ch)
            print(f"[CHAMADOS] ✅ send_async() foi chamado com sucesso para send_chamado_abertura")
        except Exception as e:
            print(f"[CHAMADOS] ❌ ERRO ao chamar send_async para send_chamado_abertura: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
        db.refresh(ch)
        db.expunge(ch)
        return ch
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao criar chamado: {e}")


def _cols(table: str) -> set[str]:
    try:
        insp = inspect(engine)
        return {c.get("name") for c in insp.get_columns(table)}
    except Exception:
        return set()


def _ensure_column(table: str, column: str, ddl: str) -> None:
    try:
        if column not in _cols(table):
            with engine.connect() as conn:
                conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}")
    except Exception:
        pass


def _insert_attachment(db: Session, table: str, values: dict) -> int:
    cols = _cols(table)
    # Map aliases to support legacy schemas
    if "arquivo_nome" in cols and "arquivo_nome" not in values and "nome_arquivo" in values:
        values["arquivo_nome"] = values["nome_arquivo"]
    if "arquivo_caminho" in cols and "arquivo_caminho" not in values and "caminho_arquivo" in values:
        values["arquivo_caminho"] = values["caminho_arquivo"]
    if "criado_em" in cols and "criado_em" not in values and "data_upload" in values:
        values["criado_em"] = values["data_upload"]
    data = {k: v for k, v in values.items() if k in cols}
    if not data:
        raise HTTPException(status_code=500, detail="Estrutura da tabela de anexo inválida")
    cols_sql = ", ".join(data.keys())
    params_sql = ", ".join(f":{k}" for k in data.keys())
    res = db.execute(text(f"INSERT INTO {table} ({cols_sql}) VALUES ({params_sql})"), data)
    rid = res.lastrowid  # type: ignore[attr-defined]
    db.flush()
    return int(rid or 0)


def _update_path(db: Session, table: str, rid: int, path: str) -> None:
    cols = _cols(table)
    if "caminho_arquivo" in cols:
        db.execute(text(f"UPDATE {table} SET caminho_arquivo=:p WHERE id=:i"), {"p": path, "i": rid})
    if "arquivo_caminho" in cols:
        db.execute(text(f"UPDATE {table} SET arquivo_caminho=:p WHERE id=:i"), {"p": path, "i": rid})


def _select_anexo_query(table: str) -> str:
    cols = _cols(table)
    name_expr = ("nome_original" if "nome_original" in cols else ("arquivo_nome" if "arquivo_nome" in cols else "NULL")) + " AS nome_original"
    path_expr = ("caminho_arquivo" if "caminho_arquivo" in cols else ("arquivo_caminho" if "arquivo_caminho" in cols else "NULL")) + " AS caminho_arquivo"
    mime_expr = ("tipo_mime" if "tipo_mime" in cols else ("mime_type" if "mime_type" in cols else "NULL")) + " AS tipo_mime"
    size_expr = ("tamanho_bytes" if "tamanho_bytes" in cols else "NULL") + " AS tamanho_bytes"
    date_expr = ("data_upload" if "data_upload" in cols else ("criado_em" if "criado_em" in cols else "NULL")) + " AS data_upload"
    return f"SELECT id, {name_expr}, {path_expr}, {mime_expr}, {size_expr}, {date_expr} FROM {table}"


def _select_download_query(table: str) -> str:
    cols = _cols(table)
    nome_arq = ("nome_arquivo" if "nome_arquivo" in cols else ("arquivo_nome" if "arquivo_nome" in cols else "NULL")) + " AS nome_arquivo"
    nome_orig = ("nome_original" if "nome_original" in cols else ("arquivo_nome" if "arquivo_nome" in cols else "NULL")) + " AS nome_original"
    mime_expr = ("tipo_mime" if "tipo_mime" in cols else ("mime_type" if "mime_type" in cols else "NULL")) + " AS tipo_mime"
    conteudo = ("conteudo" if "conteudo" in cols else "NULL") + " AS conteudo"
    return f"SELECT id, {nome_arq}, {nome_orig}, {mime_expr}, {conteudo} FROM {table} WHERE id=:i"


@router.post("/with-attachments", response_model=ChamadoOut)
def criar_chamado_com_anexos(
    solicitante: str = Form(...),
    cargo: str = Form(...),
    email: str = Form(...),
    telefone: str = Form(...),
    unidade: str = Form(...),
    problema: str = Form(...),
    internetItem: str | None = Form(None),
    visita: str | None = Form(None),
    descricao: str | None = Form(None),
    files: list[UploadFile] = File(default=[]),
    autor_email: str | None = Form(None),
    db: Session = Depends(get_db),
):
    try:
        try:
            Chamado.__table__.create(bind=engine, checkfirst=True)
            ChamadoAnexo.__table__.create(bind=engine, checkfirst=True)
            _ensure_column("chamado_anexo", "conteudo", "MEDIUMBLOB NULL")
        except Exception:
            pass
        payload = ChamadoCreate(
            solicitante=solicitante,
            cargo=cargo,
            email=email,
            telefone=telefone,
            unidade=unidade,
            problema=problema,
            internetItem=internetItem,
            visita=visita,
            descricao=descricao,
        )
        ch = service_criar(db, payload)

        # Salva o usuario_id de quem abriu o chamado, se fornecido
        if autor_email:
            try:
                user_autor = db.query(User).filter(User.email == autor_email).first()
                if user_autor and ch.usuario_id is None:
                    ch.usuario_id = user_autor.id
                    db.add(ch)
                    db.commit()
                    db.refresh(ch)
            except Exception as e:
                print(f"[CHAMADOS] Aviso ao vincular usuario_id: {e}")

        if files:
            user_id = None
            if autor_email:
                try:
                    user = db.query(User).filter(User.email == autor_email).first()
                    user_id = user.id if user else None
                except Exception:
                    user_id = None
            import hashlib
            saved = 0
            for f in files:
                try:
                    safe_name = (f.filename or "arquivo")
                    content = f.file.read()
                    ext = safe_name.rsplit(".", 1)[-1].lower() if "." in safe_name else None
                    sha = hashlib.sha256(content).hexdigest()
                    now = now_brazil_naive()
                    rid = _insert_attachment(db, "chamado_anexo", {
                        "chamado_id": ch.id,
                        "nome_original": safe_name,
                        "nome_arquivo": safe_name,
                        "arquivo_nome": safe_name,
                        "caminho_arquivo": "pending",
                        "arquivo_caminho": "pending",
                        "tamanho_bytes": len(content),
                        "tipo_mime": f.content_type or None,
                        "extensao": ext or None,
                        "hash_arquivo": sha,
                        "data_upload": now,
                        "criado_em": now,
                        "usuario_upload_id": user_id,
                        "descricao": None,
                        "ativo": True,
                        "conteudo": content,
                    })
                    if rid:
                        _update_path(db, "chamado_anexo", rid, f"api/chamados/anexos/chamado/{rid}")
                        saved += 1
                except Exception:
                    continue
            db.commit()
            if files and saved == 0:
                raise HTTPException(status_code=500, detail="Falha ao salvar anexos da abertura")
            # Try to gather saved attachments and send them with the opening email
            try:
                attach_rows = db.execute(text("SELECT id, nome_original, tipo_mime FROM chamado_anexo WHERE chamado_id=:i"), {"i": ch.id}).fetchall()
                attachments_payload = []
                import base64
                for ar in attach_rows:
                    try:
                        aid = int(ar[0])
                        nome = ar[1] or f"anexo_{aid}"
                        mime = ar[2] or "application/octet-stream"
                        res = db.execute(text(_select_download_query("chamado_anexo")), {"i": aid}).fetchone()
                        if res and res[4]:
                            content = res[4]
                            b64 = base64.b64encode(content).decode("ascii")
                            attachments_payload.append({
                                "name": nome,
                                "contentType": mime,
                                "contentBytes": b64,
                            })
                    except Exception:
                        continue
                # send async email with attachments
                try:
                    print(f"[CHAMADOS] 📧 Chamado {ch.codigo} criado com anexos. Disparando envio de email...")
                    if attachments_payload:
                        send_async(send_chamado_abertura, ch, attachments_payload)
                        print(f"[CHAMADOS] ✅ send_async() chamado com {len(attachments_payload)} anexo(s)")
                    else:
                        send_async(send_chamado_abertura, ch)
                        print(f"[CHAMADOS] ✅ send_async() chamado sem anexos")
                except Exception as e:
                    print(f"[CHAMADOS] ❌ ERRO ao chamar send_async: {type(e).__name__}: {e}")
                    import traceback
                    traceback.print_exc()
            except Exception:
                pass
        else:
            # No files: still send the opening email
            try:
                print(f"[CHAMADOS] 📧 Chamado {ch.codigo} criado sem anexos. Disparando envio de email...")
                send_async(send_chamado_abertura, ch)
                print(f"[CHAMADOS] ✅ send_async() foi chamado com sucesso")
            except Exception as e:
                print(f"[CHAMADOS] ❌ ERRO ao chamar send_async: {type(e).__name__}: {e}")
                import traceback
                traceback.print_exc()

        # REFRESH e EXPUNGE ANTES de qualquer operação async para evitar estado transitório
        try:
            db.refresh(ch)
            db.expunge(ch)
        except Exception as e:
            print(f"[REFRESH] Erro ao refresh chamado: {e}")
            # Mesmo com erro, continue com o resto da operação
            pass

        # EMITE ATUALIZAÇÃO DE MÉTRICAS EM TEMPO REAL (sem dependência de db após refresh)
        try:
            metricas = IncrementalMetricsCache.get_metrics(db)
            import anyio
            anyio.from_thread.run(sio.emit, "metrics:updated", {
                "chamados_hoje": 1,
                "timestamp": now_brazil_naive().isoformat(),
            })
        except Exception as e:
            print(f"[WebSocket] Erro ao emitir eventos de métricas: {e}")
            pass

        return ch
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao criar chamado com anexos: {e}")


@router.post("/{chamado_id}/ticket")
def enviar_ticket(
    chamado_id: int,
    assunto: str = Form(...),
    mensagem: str = Form(...),
    destinatarios: str = Form(...),
    autor_email: str | None = Form(None),
    files: list[UploadFile] = File(default=[]),
    request: Request,
    db: Session = Depends(get_db),
):
    try:
        # Verificar se o chamado existe e não foi deletado
        chamado = db.query(Chamado).filter(
            (Chamado.id == chamado_id) & (Chamado.deletado_em.is_(None))
        ).first()
        if not chamado:
            raise HTTPException(status_code=404, detail="Chamado não encontrado")

        # garantir tabelas necessárias para anexos de ticket
        TicketAnexo.__table__.create(bind=engine, checkfirst=True)
        _ensure_column("ticket_anexos", "conteudo", "MEDIUMBLOB NULL")

        # Se não foi fornecido author_email no formulário, tenta extrair do JWT token
        if not autor_email:
            current_user = get_current_user_from_request(request)
            if current_user and current_user.get("email"):
                autor_email = current_user.get("email")
                print(f"[TICKET] 📧 Usando email do JWT token para ticket: {autor_email}")

        user_id = None
        if autor_email:
            try:
                user = db.query(User).filter(User.email == autor_email).first()
                user_id = user.id if user else None
            except Exception:
                user_id = None
        # registrar histórico via ORM
        h = HistoricoTicket(
            chamado_id=chamado_id,
            usuario_id=user_id or None,
            assunto=assunto,
            mensagem=mensagem,
            destinatarios=destinatarios,
            data_envio=now_brazil_naive(),
        )
        db.add(h)
        db.commit()
        db.refresh(h)
        h_id = h.id
        # salvar anexos em tickets_anexos com metadados e caminho
        if files:
            import hashlib
            saved = 0
            for f in files:
                try:
                    safe_name = (f.filename or "arquivo")
                    content = f.file.read()
                    ext = safe_name.rsplit(".", 1)[-1].lower() if "." in safe_name else None
                    sha = hashlib.sha256(content).hexdigest()
                    now = now_brazil_naive()
                    rid = _insert_attachment(db, "ticket_anexos", {
                        "chamado_id": chamado_id,
                        "nome_original": safe_name,
                        "nome_arquivo": safe_name,
                        "arquivo_nome": safe_name,
                        "caminho_arquivo": "pending",
                        "arquivo_caminho": "pending",
                        "tamanho_bytes": len(content),
                        "tipo_mime": f.content_type or None,
                        "extensao": ext or None,
                        "hash_arquivo": sha,
                        "data_upload": now,
                        "criado_em": now,
                        "usuario_upload_id": user_id,
                        "descricao": None,
                        "ativo": True,
                        "origem": "ticket",
                        "conteudo": content,
                    })
                    if rid:
                        _update_path(db, "ticket_anexos", rid, f"api/chamados/anexos/ticket/{rid}")
                        saved += 1
                except Exception:
                    continue
            db.commit()
            if files and saved == 0:
                raise HTTPException(status_code=500, detail="Falha ao salvar anexos do ticket")
        # Enviar email de ticket enviado
        try:
            print(f"[CHAMADOS] 📧 Ticket #{h_id} enviado para chamado {chamado_id}. Disparando email...")
            # Construir e-mail de ticket enviado
            from core.email_msgraph import send_mail
            subject = f"[Evoque TI] Novo ticket - Chamado {chamado.codigo}"
            html_body = f"""
            <p>Olá,</p>
            <p>Um novo ticket foi enviado no chamado <strong>{chamado.codigo}</strong>:</p>
            <p><strong>Assunto:</strong> {assunto}</p>
            <p><strong>Mensagem:</strong></p>
            <p>{mensagem.replace(chr(10), '<br>')}</p>
            <p>Acesse o portal para ver mais detalhes.</p>
            """
            # Enviamos para os destinatários especificados e CC para TI
            to_emails = [e.strip() for e in destinatarios.split(';') if e.strip()] if destinatarios else []
            if to_emails:
                send_async(send_mail, subject, html_body, to=to_emails)
                print(f"[CHAMADOS] ✅ Email de ticket enviado para {len(to_emails)} destinatário(s)")
        except Exception as e:
            print(f"[CHAMADOS] ❌ ERRO ao enviar email de ticket: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
        return {"ok": True, "historico_id": h_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao enviar ticket: {e}")


@router.get("/anexos/chamado/{anexo_id}")
def baixar_anexo_chamado(anexo_id: int, db: Session = Depends(get_db)):
    sql = _select_download_query("chamado_anexo")
    res = db.execute(text(sql), {"i": anexo_id}).fetchone()
    if not res or not res[4]:
        raise HTTPException(status_code=404, detail="Anexo não encontrado")
    nome = res[1] or res[2] or f"anexo_{anexo_id}"
    mime = res[3] or "application/octet-stream"
    headers = {"Content-Disposition": f"inline; filename={nome}"}
    return Response(content=res[4], media_type=mime, headers=headers)


@router.get("/anexos/ticket/{anexo_id}")
def baixar_anexo_ticket(anexo_id: int, db: Session = Depends(get_db)):
    sql = _select_download_query("ticket_anexos")
    res = db.execute(text(sql), {"i": anexo_id}).fetchone()
    if not res or not res[4]:
        raise HTTPException(status_code=404, detail="Anexo não encontrado")
    nome = res[1] or res[2] or f"anexo_{anexo_id}"
    mime = res[3] or "application/octet-stream"
    headers = {"Content-Disposition": f"inline; filename={nome}"}
    return Response(content=res[4], media_type=mime, headers=headers)


@router.get("/{chamado_id}/historico", response_model=HistoricoResponse)
def obter_historico(chamado_id: int, db: Session = Depends(get_db)):
    try:
        items: list[HistoricoItem] = []
        ch = db.query(Chamado).filter(
            (Chamado.id == chamado_id) & (Chamado.deletado_em.is_(None))
        ).first()
        if not ch:
            raise HTTPException(status_code=404, detail="Chamado não encontrado")
        # anexos enviados na abertura (chamado_anexo) e descrição do chamado
        sql_an = _select_anexo_query("chamado_anexo") + " WHERE chamado_id=:i ORDER BY data_upload ASC"
        rows = db.execute(text(sql_an), {"i": chamado_id}).fetchall()
        anexos_abertura = None
        first_dt = ch.data_abertura or now_brazil_naive()
        if rows:
            first_dt = rows[0][5] or first_dt
            class _CA:
                def __init__(self, r):
                    self.id, self.nome_original, self.caminho_arquivo, self.mime_type, self.tamanho_bytes, self.data_upload = r
            anexos_abertura = [AnexoOut.model_validate(_CA(r)) for r in rows]
        # Busca o usuário que abriu o chamado
        usuario_abertura = None
        usuario_abertura_nome = None
        usuario_abertura_email = None
        if ch.usuario_id:
            usuario_abertura = db.query(User).filter(User.id == ch.usuario_id).first()
        if usuario_abertura:
            usuario_abertura_nome = f"{usuario_abertura.nome} {usuario_abertura.sobrenome}".strip()
            usuario_abertura_email = usuario_abertura.email
        else:
            # Fallback: usa nome/email direto do chamado (preenchido pelo formulário)
            usuario_abertura_nome = ch.solicitante or None
            usuario_abertura_email = ch.email or None

        # Item 1: Aberto em
        items.append(HistoricoItem(
            t=first_dt,
            tipo="abertura",
            label="Chamado aberto",
            anexos=anexos_abertura,
            usuario_id=ch.usuario_id,
            usuario_nome=usuario_abertura_nome,
            usuario_email=usuario_abertura_email,
        ))
        # Item 2: Descrição (se houver)
        if ch.descricao:
            items.append(HistoricoItem(
                t=first_dt,
                tipo="abertura",
                label=f"Descrição: \n{ch.descricao}",
                anexos=None,
                usuario_id=ch.usuario_id,
                usuario_nome=usuario_abertura_nome,
                usuario_email=usuario_abertura_email,
            ))
        try:
            Notification.__table__.create(bind=engine, checkfirst=True)
            HistoricoStatus.__table__.create(bind=engine, checkfirst=True)
            # Priorize historico_status for status events
            hs_rows = db.query(HistoricoStatus).filter(HistoricoStatus.chamado_id == chamado_id).order_by(HistoricoStatus.created_at.asc()).all()
            print(f"[HISTORICO] chamado_id={chamado_id}: encontrado(s) {len(hs_rows)} registro(s) em historico_status")

            # Ler também autor_email e autor_nome via SQL direto (caso colunas existam)
            autor_extras: dict[int, dict] = {}
            try:
                rows_extra = db.execute(text(
                    "SELECT id, autor_email, autor_nome FROM historico_status WHERE chamado_id = :cid"
                ), {"cid": chamado_id}).fetchall()
                for row in rows_extra:
                    autor_extras[row[0]] = {"autor_email": row[1], "autor_nome": row[2]}
            except Exception:
                pass  # Colunas ainda não existem — fallback normal

            for r in hs_rows:
                usuario = None
                nome_display = None
                email_display = None

                # 1) Tenta via usuario_id (mais confiável — dado no banco)
                if r.usuario_id:
                    usuario = db.query(User).filter(User.id == r.usuario_id).first()

                if usuario:
                    nome_display = f"{usuario.nome} {usuario.sobrenome}".strip()
                    email_display = usuario.email
                else:
                    # 2) Fallback: autor_nome / autor_email salvos diretamente no registro
                    extra = autor_extras.get(r.id, {})
                    autor_nome_extra = extra.get("autor_nome")
                    autor_email_extra = extra.get("autor_email")

                    if autor_nome_extra:
                        nome_display = autor_nome_extra
                        email_display = autor_email_extra
                    elif autor_email_extra:
                        # Tenta achar o user pelo email salvo
                        try:
                            from sqlalchemy import func as sa_func
                            u2 = db.query(User).filter(
                                sa_func.lower(User.email) == autor_email_extra.lower()
                            ).first()
                            if u2:
                                nome_display = f"{u2.nome} {u2.sobrenome}".strip()
                                email_display = u2.email
                            else:
                                # Sem nome, mas temos email — usa email como nome
                                nome_display = autor_email_extra
                                email_display = autor_email_extra
                        except Exception:
                            nome_display = autor_email_extra
                            email_display = autor_email_extra
                    else:
                        # Sem email nem nome — tenta extrair de Notification ou database logs
                        print(f"[HISTORICO] ⚠️  Registro {r.id} sem usuario_id, autor_email, ou autor_nome")

                # Monta label legível a partir da descricao
                label_text = r.descricao or f"Status: {r.status}"
                # Remove prefixos de migração legados
                if label_text.startswith("Migrado: "):
                    label_text = label_text.replace("Migrado: ", "", 1)

                items.append(HistoricoItem(
                    t=r.criado_em or now_brazil_naive(),
                    tipo="status",
                    label=label_text,
                    anexos=None,
                    usuario_id=r.usuario_id,
                    usuario_nome=nome_display,
                    usuario_email=email_display,
                ))
            # Fallback somente se não houver historico_status
            if not hs_rows:
                notas = db.query(Notification).filter(
                    Notification.recurso == "chamado",
                    Notification.recurso_id == chamado_id,
                ).order_by(Notification.criado_em.asc()).all()
                for n in notas:
                    if n.acao == "status":
                        usuario = None
                        nome_fallback = None
                        email_fallback = None
                        if n.usuario_id:
                            usuario = db.query(User).filter(User.id == n.usuario_id).first()
                            if usuario:
                                nome_fallback = f"{usuario.nome} {usuario.sobrenome}".strip()
                                email_fallback = usuario.email

                        # Se não achou usuário por ID, tenta extrair email da mensagem
                        if not nome_fallback and n.mensagem:
                            # Tenta extrair email da mensagem (se houver)
                            nome_fallback = n.mensagem or "Usuário do sistema"

                        items.append(HistoricoItem(
                            t=n.criado_em or now_brazil_naive(),
                            tipo="status",
                            label=n.mensagem or "Status atualizado",
                            anexos=None,
                            usuario_id=n.usuario_id,
                            usuario_nome=nome_fallback,
                            usuario_email=email_fallback,
                        ))
        except Exception as e:
            import traceback
            print(f"[HISTORICO] ❌ ERRO ao buscar historico_status: {e}")
            print(traceback.format_exc())
        # histórico (historico_tickets via ORM) - ignora se tabela não existir
        try:
            hs = db.query(HistoricoTicket).filter(HistoricoTicket.chamado_id == chamado_id).order_by(HistoricoTicket.data_envio.asc()).all()
        except Exception:
            hs = []
        for h in hs:
            anexos_ticket = []
            try:
                from datetime import timedelta
                start = (h.data_envio or now_brazil_naive()) - timedelta(minutes=3)
                end = (h.data_envio or now_brazil_naive()) + timedelta(minutes=3)
                sql_ta = _select_anexo_query("ticket_anexos") + " WHERE chamado_id=:i"
                tas = db.execute(text(sql_ta), {"i": chamado_id}).fetchall()
                for ta in tas:
                    dt = ta[5]
                    if dt and start <= dt <= end:
                        class _A:
                            id, nome_original, caminho_arquivo, mime_type, tamanho_bytes, data_upload = ta
                        anexos_ticket.append(_A())
            except Exception:
                pass
            usuario = None
            if h.usuario_id:
                usuario = db.query(User).filter(User.id == h.usuario_id).first()
            items.append(HistoricoItem(
                t=h.data_envio or now_brazil_naive(),
                tipo="ticket",
                label=f"{h.assunto}",
                anexos=[AnexoOut.model_validate(a) for a in anexos_ticket] if anexos_ticket else None,
                usuario_id=h.usuario_id,
                usuario_nome=f"{usuario.nome} {usuario.sobrenome}" if usuario else None,
                usuario_email=usuario.email if usuario else None,
            ))
        items_sorted = sorted(items, key=lambda x: x.t)
        return HistoricoResponse(items=items_sorted)
    except HTTPException:
        raise
    except Exception:
        # Retorna o que foi possível montar para não quebrar o painel
        try:
            items_sorted = sorted(items, key=lambda x: x.t)
            return HistoricoResponse(items=items_sorted)
        except Exception:
            return HistoricoResponse(items=[])


@router.patch("/{chamado_id}/status", response_model=ChamadoOut)
def atualizar_status(chamado_id: int, payload: ChamadoStatusUpdate, request: Request, db: Session = Depends(get_db)):
    try:
        novo = _normalize_status(payload.status)
        if novo not in ALLOWED_STATUSES:
            raise HTTPException(status_code=400, detail="Status inválido")
        ch = db.query(Chamado).filter(
            (Chamado.id == chamado_id) & (Chamado.deletado_em.is_(None))
        ).first()
        if not ch:
            raise HTTPException(status_code=404, detail="Chamado não encontrado")
        prev = ch.status or "Aberto"
        ch.status = novo
        if prev == "Aberto" and novo != "Aberto" and ch.data_primeira_resposta is None:
            ch.data_primeira_resposta = now_brazil_naive()
        if novo == "Concluído":
            ch.data_conclusao = now_brazil_naive()

        # ── Resolve quem está alterando o status ───────────────────────────────
        autor_usuario_id = None
        autor_nome_str = None
        autor_email_str = (payload.autor_email or "").strip() or None

        # Se não foi fornecido author_email no payload, tenta extrair do JWT token
        if not autor_email_str:
            current_user = get_current_user_from_request(request)
            if current_user and current_user.get("email"):
                autor_email_str = current_user.get("email")
                print(f"[HISTORICO STATUS] 📧 Usando email do JWT token: {autor_email_str}")

        if autor_email_str:
            try:
                # MySQL é case-insensitive por padrão para utf8mb4_unicode_ci,
                # mas usamos lower() para garantir em qualquer collation
                from sqlalchemy import func as sa_func
                autor = db.query(User).filter(
                    sa_func.lower(User.email) == autor_email_str.lower()
                ).first()
                if autor:
                    autor_usuario_id = autor.id
                    autor_nome_str = f"{autor.nome} {autor.sobrenome}".strip()
                    print(f"[HISTORICO STATUS] ✅ Autor identificado: {autor_nome_str} (id={autor_usuario_id})")
                else:
                    # Se o usuário não foi encontrado, mas temos email, usa ele como fallback
                    autor_nome_str = None  # Será preenchido apenas se encontrarmos o usuário
                    print(f"[HISTORICO STATUS] ⚠️  Email '{autor_email_str}' não encontrado na tabela User, mas será armazenado no histórico")
            except Exception as e:
                print(f"[HISTORICO STATUS] ⚠️  Erro ao buscar autor: {e}")
        else:
            print(f"[HISTORICO STATUS] ⚠️  Nenhum autor_email fornecido no payload")

        db.add(ch)
        db.commit()  # garante persistência do status antes dos logs
        db.refresh(ch)

        # Pausa/retomada automatica de SLA
        try:
            from modules.sla.service import SlaService
            SlaService(db).pausar_sla_chamado(ch.id, novo)
        except Exception as sla_err:
            print(f'[SLA] Erro pausa automatica: {sla_err}')

        # DECREMENTAR CONTADOR DE HOJE SE CANCELADO
        if novo == "Expirado" and prev != "Expirado":
            ChamadosTodayCounter.decrement(db, 1)

        # ── Histórico e notificações (nunca bloqueiam o retorno) ──────────────
        try:
            Notification.__table__.create(bind=engine, checkfirst=True)
            HistoricoTicket.__table__.create(bind=engine, checkfirst=True)
            HistoricoStatus.__table__.create(bind=engine, checkfirst=True)

            agora = now_brazil_naive()

            # Fechar histórico anterior
            try:
                ultimo_historico = db.query(HistoricoStatus).filter(
                    HistoricoStatus.chamado_id == ch.id
                ).order_by(HistoricoStatus.data_inicio.desc()).first()
                if ultimo_historico and not ultimo_historico.data_fim:
                    ultimo_historico.data_fim = agora
                    db.add(ultimo_historico)
                    db.commit()
            except Exception as e:
                print(f"[HISTORICO - Fechar anterior ERROR] {e}")
                db.rollback()

            # Criar notificação
            dados = json.dumps({
                "id": ch.id,
                "codigo": ch.codigo,
                "protocolo": ch.protocolo,
                "status": ch.status,
                "status_anterior": prev,
            }, ensure_ascii=False)
            n = Notification(
                tipo="chamado",
                titulo=f"Status atualizado: {ch.codigo}",
                mensagem=f"{prev} → {ch.status}",
                recurso="chamado",
                recurso_id=ch.id,
                acao="status",
                dados=dados,
            )
            db.add(n)

            # ── Registrar historico_status via INSERT direto (evita falha por coluna ausente no ORM)
            try:
                descricao_hs = f"{prev} → {ch.status}"
                db.execute(text(
                    "INSERT INTO historico_status "
                    "(chamado_id, status, descricao, usuario_id, autor_email, autor_nome, data_inicio, created_at, updated_at) "
                    "VALUES (:cid, :status, :desc, :uid, :email, :nome, :dt, :dt, :dt)"
                ), {
                    "cid": ch.id,
                    "status": ch.status,
                    "desc": descricao_hs,
                    "uid": autor_usuario_id,
                    "email": autor_email_str,
                    "nome": autor_nome_str,
                    "dt": agora,
                })
                db.add(n)
                db.commit()
                print(f"[HISTORICO STATUS] ✅ Salvo: chamado_id={ch.id}, '{prev}' → '{ch.status}', usuario_id={autor_usuario_id}, nome='{autor_nome_str}'")
            except Exception as e:
                import traceback
                print(f"[HISTORICO STATUS] ❌ ERRO ao salvar (insert direto): {e}")
                print(traceback.format_exc())
                # Tenta fallback sem as colunas extras (caso não existam ainda no banco)
                try:
                    db.rollback()
                    db.execute(text(
                        "INSERT INTO historico_status "
                        "(chamado_id, status, descricao, usuario_id, data_inicio, created_at, updated_at) "
                        "VALUES (:cid, :status, :desc, :uid, :dt, :dt, :dt)"
                    ), {
                        "cid": ch.id,
                        "status": ch.status,
                        "desc": f"{prev} → {ch.status}",
                        "uid": autor_usuario_id,
                        "dt": agora,
                    })
                    db.add(n)
                    db.commit()
                    print(f"[HISTORICO STATUS] ✅ Salvo (fallback sem colunas extras)")
                except Exception as e2:
                    print(f"[HISTORICO STATUS] ❌ Fallback também falhou: {e2}")
                    db.rollback()

        except Exception as e:
            print(f"[STATUS] Erro em histórico/notificação (não bloqueia): {e}")
            try:
                db.rollback()
            except Exception:
                pass

        # ── Emitir via Socket.IO (cada chamada isolada, nunca bloqueia retorno) ──
        try:
            import anyio
            try:
                anyio.from_thread.run(sio.emit, "chamado:status", {"id": ch.id, "status": ch.status})
            except Exception:
                pass
            try:
                anyio.from_thread.run(sio.emit, "metrics:updated", {
                    "timestamp": now_brazil_naive().isoformat(),
                })
            except Exception:
                pass
        except Exception:
            pass

        # ── Email de notificação ───────────────────────────────────────────────
        try:
            send_async(send_chamado_status, ch, prev)
        except Exception as e:
            print(f"[CHAMADOS] ❌ ERRO ao enviar email: {type(e).__name__}: {e}")

        # ── Re-query limpa para retornar (evita estado corrompido da sessão) ───
        ch_final = db.query(Chamado).filter(Chamado.id == chamado_id).first()
        return ch_final
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar status: {e}")


@router.post("/{chamado_id}/assign", response_model=ChamadoOut)
def atribuir_chamado(chamado_id: int, payload: dict = Body(...), db: Session = Depends(get_db)):
    try:
        agent_id = payload.get("agent_id")
        if not agent_id:
            raise HTTPException(status_code=400, detail="agent_id é obrigatório")

        # Buscar o agente (usuário)
        agent = db.query(User).filter(User.id == agent_id).first()
        if not agent:
            raise HTTPException(status_code=404, detail="Agente não encontrado")

        # Buscar o chamado
        ch = db.query(Chamado).filter(
            (Chamado.id == chamado_id) & (Chamado.deletado_em.is_(None))
        ).first()
        if not ch:
            raise HTTPException(status_code=404, detail="Chamado não encontrado")

        # Atualizar a atribuição
        ch.status_assumido_por_id = agent_id
        ch.status_assumido_em = now_brazil_naive()
        db.add(ch)
        db.commit()
        db.refresh(ch)

        # Criar notificação
        try:
            Notification.__table__.create(bind=engine, checkfirst=True)
            dados = json.dumps({
                "id": ch.id,
                "codigo": ch.codigo,
                "agente_id": agent_id,
                "agente_nome": agent.nome,
            }, ensure_ascii=False)

            n = Notification(
                tipo="chamado",
                titulo=f"Chamado atribuído: {ch.codigo}",
                mensagem=f"Chamado {ch.protocolo} foi atribuído para {agent.nome}",
                recurso="chamado",
                recurso_id=chamado_id,
                acao="atribuido",
                dados=dados,
            )
            db.add(n)
            db.commit()
            db.refresh(n)
        except Exception as e:
            print(f"[ASSIGN] Erro ao criar notificação: {e}")

        return ch
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao atribuir chamado: {e}")


@router.delete("/{chamado_id}")
def deletar_chamado(chamado_id: int, payload: ChamadoDeleteRequest = Body(...), db: Session = Depends(get_db)):
    try:
        # Validar usuário e senha
        user = db.query(User).filter(User.email == payload.email).first()
        if not user:
            raise HTTPException(status_code=401, detail="Usuário não encontrado")
        from werkzeug.security import check_password_hash as _chk
        if not _chk(user.senha_hash, payload.senha):
            raise HTTPException(status_code=401, detail="Senha inválida")

        # Buscar o chamado
        ch = db.query(Chamado).filter(
            (Chamado.id == chamado_id) & (Chamado.deletado_em.is_(None))
        ).first()
        if not ch:
            raise HTTPException(status_code=404, detail="Chamado não encontrado")

        print(f"[SOFT DELETE] Iniciando soft delete do chamado {chamado_id}")

        # Guardar informações do chamado
        chamado_info = {
            'id': ch.id,
            'codigo': ch.codigo,
            'protocolo': ch.protocolo,
            'status': ch.status,
        }

        # Soft delete: marcar como deletado
        agora = now_brazil_naive()
        ch.deletado_em = agora
        db.add(ch)
        db.commit()
        db.refresh(ch)

        print(f"[SOFT DELETE] Chamado {chamado_id} marcado como deletado")

        # Decrementar contador se o chamado não estava cancelado
        if chamado_info['status'] != "Expirado":
            try:
                ChamadosTodayCounter.decrement(db, 1)
                print(f"[SOFT DELETE] Contador decrementado")
            except Exception as e:
                print(f"[SOFT DELETE] Erro ao decrementar contador: {e}")

        # Criar notificação de exclusão
        try:
            Notification.__table__.create(bind=engine, checkfirst=True)
            dados = json.dumps({
                "id": chamado_info['id'],
                "codigo": chamado_info['codigo'],
                "protocolo": chamado_info['protocolo'],
            }, ensure_ascii=False)

            n = Notification(
                tipo="chamado",
                titulo=f"Chamado excluído: {chamado_info['codigo']}",
                mensagem=f"Chamado {chamado_info['protocolo']} foi removido da visualização",
                recurso="chamado",
                recurso_id=chamado_id,
                acao="excluido",
                dados=dados,
            )
            db.add(n)
            db.commit()
            db.refresh(n)

            # Emitir eventos WebSocket
            import anyio
            anyio.from_thread.run(sio.emit, "chamado:deleted", {
                "id": chamado_id,
                "codigo": chamado_info['codigo'],
                "protocolo": chamado_info['protocolo'],
            })
            anyio.from_thread.run(sio.emit, "notification:new", {
                "id": n.id,
                "tipo": n.tipo,
                "titulo": n.titulo,
                "mensagem": n.mensagem,
                "recurso": n.recurso,
                "recurso_id": n.recurso_id,
                "acao": n.acao,
                "dados": n.dados,
                "lido": n.lido,
                "criado_em": n.criado_em.isoformat() if n.criado_em else None,
            })

            # Emitir atualização de métricas
            metricas = IncrementalMetricsCache.get_metrics(db)
            anyio.from_thread.run(sio.emit, "metrics:updated", {
                "timestamp": now_brazil_naive().isoformat(),
            })

            print(f"[SOFT DELETE] Notificação e eventos WebSocket emitidos")
        except Exception as e:
            print(f"[SOFT DELETE] Erro ao criar notificação/WebSocket: {e}")
            # Não falhar a operação por causa disso

        return {
            "ok": True,
            "message": f"Chamado {chamado_info['codigo']} excluído com sucesso",
            "detalhes": {
                "chamado_id": chamado_id,
                "codigo": chamado_info['codigo'],
                "protocolo": chamado_info['protocolo'],
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"[SOFT DELETE] ERRO GERAL: {e}")
        print(f"[SOFT DELETE] TRACEBACK: {traceback.format_exc()}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao excluir chamado: {e}")


@router.get("/report/last-30-days")
def get_last_30_days_attended_tickets(db: Session = Depends(get_db)):
    """
    Retorna os chamados atendidos (Concluído) nos últimos 30 dias com todos os detalhes para relatório Excel.
    Inclui: ID, Código, Nome do Solicitante, Problema, Status, Data de Abertura, Data da Última Atualização
    """
    try:
        try:
            Chamado.__table__.create(bind=engine, checkfirst=True)
        except Exception:
            pass

        from datetime import timedelta

        # Calcular a data de 30 dias atrás usando horário do Brasil
        now = now_brazil_naive()
        thirty_days_ago = now - timedelta(days=30)

        # Buscar chamados com status "Concluído" nos últimos 30 dias
        chamados = db.query(Chamado).filter(
            and_(
                Chamado.deletado_em.is_(None),
                Chamado.status == "Concluído",
                Chamado.data_conclusao >= thirty_days_ago
            )
        ).order_by(Chamado.data_conclusao.desc()).all()

        # Construir resposta com dados formatados para Excel
        result = {
            "count": len(chamados),
            "total": len(chamados),
            "data_relatorio": now.isoformat(),
            "tickets": [
                {
                    "id": ch.id,
                    "codigo": ch.codigo,
                    "protocolo": ch.protocolo,
                    "solicitante": ch.solicitante,
                    "problema": ch.problema,
                    "descricao": ch.descricao or "",
                    "status": ch.status,
                    "prioridade": ch.prioridade,
                    "unidade": ch.unidade,
                    "data_abertura": ch.data_abertura.isoformat() if ch.data_abertura else None,
                    "data_conclusao": ch.data_conclusao.isoformat() if ch.data_conclusao else None,
                    "data_ultima_atualizacao": ch.data_conclusao.isoformat() if ch.data_conclusao else None,
                }
                for ch in chamados
            ]
        }

        return result
    except Exception as e:
        import traceback
        print(f"[LAST 30 DAYS] ERRO: {e}")
        print(f"[LAST 30 DAYS] TRACEBACK: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Erro ao buscar relatório: {e}")


@router.get("/report")
def get_attended_tickets_report(start_date: str = "", end_date: str = "", db: Session = Depends(get_db)):
    """
    Retorna os chamados atendidos (Concluído) em um período específico com todos os detalhes para relatório Excel.

    Query params:
    - start_date: Data inicial (formato: YYYY-MM-DD)
    - end_date: Data final (formato: YYYY-MM-DD)

    Inclui: ID, Código, Nome do Solicitante, Problema, Status, Data de Abertura, Data da Última Atualização
    """
    try:
        try:
            Chamado.__table__.create(bind=engine, checkfirst=True)
        except Exception:
            pass

        from datetime import timedelta, datetime

        # Usar datas fornecidas ou padrão para últimos 30 dias
        now = now_brazil_naive()

        if start_date and end_date:
            try:
                # Parse das datas fornecidas
                start = datetime.strptime(start_date, "%Y-%m-%d").replace(
                    hour=0, minute=0, second=0, microsecond=0
                )
                end = datetime.strptime(end_date, "%Y-%m-%d").replace(
                    hour=23, minute=59, second=59, microsecond=999999
                )
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail="Datas devem estar no formato YYYY-MM-DD"
                )
        else:
            # Padrão: últimos 30 dias
            end = now.replace(hour=23, minute=59, second=59, microsecond=999999)
            start = now - timedelta(days=30)
            start = start.replace(hour=0, minute=0, second=0, microsecond=0)

        # Buscar TODOS os chamados abertos no período (por data de abertura)
        # Inclui: Aberto, Em atendimento, Aguardando, Concluído, Expirado
        print(f"[REPORT] Datas recebidas: start_date='{start_date}' end_date='{end_date}'")
        print(f"[REPORT] Datas convertidas: {start} a {end}")
        print(f"[REPORT] Comparação de tipos: start type={type(start)}, end type={type(end)}")

        chamados = db.query(Chamado).filter(
            and_(
                Chamado.deletado_em.is_(None),
                Chamado.data_abertura >= start,
                Chamado.data_abertura <= end
            )
        ).order_by(Chamado.data_abertura.desc()).all()

        print(f"[REPORT] Encontrados {len(chamados)} chamados com o filtro")

        # Construir resposta com dados formatados para Excel
        result = {
            "count": len(chamados),
            "total": len(chamados),
            "data_relatorio": now.isoformat(),
            "period": {
                "start": start.isoformat(),
                "end": end.isoformat()
            },
            "tickets": [
                {
                    "id": ch.id,
                    "codigo": ch.codigo,
                    "protocolo": ch.protocolo,
                    "solicitante": ch.solicitante,
                    "problema": ch.problema,
                    "descricao": ch.descricao or "",
                    "status": ch.status,
                    "prioridade": ch.prioridade,
                    "unidade": ch.unidade,
                    "data_abertura": ch.data_abertura.isoformat() if ch.data_abertura else None,
                    "data_conclusao": ch.data_conclusao.isoformat() if ch.data_conclusao else None,
                    "data_ultima_atualizacao": ch.data_conclusao.isoformat() if ch.data_conclusao else None,
                }
                for ch in chamados
            ]
        }

        return result
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"[REPORT] ERRO: {e}")
        print(f"[REPORT] TRACEBACK: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Erro ao buscar relatório: {e}")
