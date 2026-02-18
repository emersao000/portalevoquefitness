from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from io import BytesIO
from datetime import datetime
from pydantic import BaseModel
import base64
import json
from core.db import get_db, engine

# Imports com tratamento de erro
try:
    from ..models.alert import Alert
except ImportError:
    from ti.models.alert import Alert

try:
    from ..schemas.alert import AlertOut, AlertCreate
except ImportError:
    # Se não existir schema, vamos trabalhar sem ele
    AlertOut = None
    AlertCreate = None

class AlertViewRequest(BaseModel):
    usuario_id: Optional[str] = None
    usuario_email: Optional[str] = None
    usuario_nome: Optional[str] = None
    usuario_sobrenome: Optional[str] = None

router = APIRouter(prefix="/alerts", tags=["TI - Alerts"]) 

@router.get("")
def list_alerts(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    """
    Lista todos os alertas do sistema
    """
    try:
        # Criar tabela se não existir
        try:
            Alert.__table__.create(bind=engine, checkfirst=True)
        except Exception:
            pass
        
        # Buscar todos os alertas ordenados por data de criação
        alerts = db.query(Alert).order_by(Alert.created_at.desc()).all()
        
        # Converter para dicionário e processar blob
        result = []
        for alert in alerts:
            alert_dict = {
                "id": alert.id,
                "title": alert.title if alert.title else "",
                "message": alert.message if alert.message else "",
                "description": alert.description if alert.description else "",
                "severity": alert.severity if alert.severity else "low",
                "pages": alert.pages,
                "show_on_home": alert.show_on_home,
                "created_by": alert.created_by,
                "ativo": alert.ativo,
                "usuarios_visualizaram": alert.usuarios_visualizaram,
                "created_at": alert.created_at.isoformat() if alert.created_at else None,
                "updated_at": alert.updated_at.isoformat() if alert.updated_at else None,
                "imagem_mime_type": alert.imagem_mime_type,
                "imagem_blob": None
            }
            
            # Converter blob para base64 se existir
            if alert.imagem_blob:
                try:
                    alert_dict["imagem_blob"] = base64.b64encode(alert.imagem_blob).decode('utf-8')
                except Exception as e:
                    print(f"[ALERTS] Erro ao converter imagem para base64: {e}")
                    alert_dict["imagem_blob"] = None
            
            result.append(alert_dict)
        
        return result
        
    except AttributeError as e:
        print(f"[ALERTS] Erro de atributo - verifique se o modelo Alert está correto: {e}")
        print("[ALERTS] Certifique-se que o modelo Alert tem os campos: id, title, message, description, severity, created_at, updated_at")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro no modelo de dados: {str(e)}")
    except Exception as e:
        print(f"[ALERTS] Erro ao listar alertas: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao listar alertas: {str(e)}")


@router.post("")
async def create_alert(
    title: str = Form(...),
    message: str = Form(...),
    description: Optional[str] = Form(None),
    severity: str = Form("low"),
    pages: Optional[str] = Form(None),
    show_on_home: Optional[bool] = Form(False),
    created_by: Optional[str] = Form(None),
    imagem: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Cria um novo alerta no sistema
    """
    try:
        import json
        print(f"[ALERTS] Iniciando criação de alerta...")
        print(f"[ALERTS] Dados recebidos: title={title}, message={message}, severity={severity}, description={description}, pages={pages}, show_on_home={show_on_home}, created_by={created_by}")

        # Validar severity
        valid_severities = ["low", "medium", "high", "critical"]
        if severity not in valid_severities:
            print(f"[ALERTS] Severity '{severity}' inválido, usando 'low'")
            severity = "low"

        # Processar páginas (JSON string para lista)
        pages_list = None
        if pages:
            try:
                pages_list = json.loads(pages) if isinstance(pages, str) else pages
                print(f"[ALERTS] Páginas processadas: {pages_list}")
            except Exception as e:
                print(f"[ALERTS] Erro ao processar páginas JSON: {e}")
                pages_list = None

        # Processar imagem se fornecida
        imagem_blob = None
        imagem_mime_type = None

        if imagem:
            try:
                print(f"[ALERTS] Processando imagem: {imagem.filename}")
                imagem_blob = await imagem.read()
                imagem_mime_type = imagem.content_type or "image/jpeg"
                print(f"[ALERTS] Imagem processada: {len(imagem_blob)} bytes, tipo: {imagem_mime_type}")
            except Exception as e:
                print(f"[ALERTS] Erro ao processar imagem: {e}")
                # Continua sem imagem se der erro
                imagem_blob = None
                imagem_mime_type = None

        # Criar alerta com todos os campos
        print(f"[ALERTS] Criando objeto Alert...")

        new_alert = Alert(
            title=title,
            message=message,
            description=description,
            severity=severity,
            pages=pages_list,
            show_on_home=show_on_home,
            created_by=created_by,
            ativo=True,
            imagem_blob=imagem_blob,
            imagem_mime_type=imagem_mime_type
        )
        
        print(f"[ALERTS] Salvando no banco de dados...")
        db.add(new_alert)
        db.commit()
        db.refresh(new_alert)
        
        print(f"[ALERTS] Alerta criado com sucesso! ID: {new_alert.id}")
        
        # Preparar resposta
        response = {
            "id": new_alert.id,
            "title": new_alert.title,
            "message": new_alert.message,
            "description": new_alert.description,
            "severity": new_alert.severity,
            "pages": new_alert.pages,
            "show_on_home": new_alert.show_on_home,
            "created_by": new_alert.created_by,
            "ativo": new_alert.ativo,
            "usuarios_visualizaram": new_alert.usuarios_visualizaram,
            "created_at": new_alert.created_at.isoformat() if new_alert.created_at else None,
            "updated_at": new_alert.updated_at.isoformat() if new_alert.updated_at else None,
            "imagem_mime_type": new_alert.imagem_mime_type
        }
        
        # Converter blob para base64 para resposta
        if new_alert.imagem_blob:
            try:
                response["imagem_blob"] = base64.b64encode(new_alert.imagem_blob).decode('utf-8')
            except:
                response["imagem_blob"] = None
        else:
            response["imagem_blob"] = None
        
        return response
        
    except Exception as e:
        db.rollback()
        print(f"[ALERTS] ERRO CRÍTICO ao criar alerta: {str(e)}")
        print(f"[ALERTS] Tipo do erro: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        
        # Mensagem de erro mais detalhada
        error_message = f"Erro ao criar alerta: {str(e)}"
        if "invalid keyword argument" in str(e):
            error_message = f"Erro no modelo de dados. Verifique se os campos do modelo Alert correspondem ao banco de dados: {str(e)}"
        
        raise HTTPException(status_code=500, detail=error_message)


@router.get("/{alert_id}/imagem")
def get_alert_image(alert_id: int, db: Session = Depends(get_db)):
    """
    Retorna a imagem de um alerta específico
    """
    try:
        alert = db.query(Alert).filter(Alert.id == alert_id).first()
        
        if not alert:
            raise HTTPException(status_code=404, detail="Alerta não encontrado")
            
        if not alert.imagem_blob:
            raise HTTPException(status_code=404, detail="Este alerta não possui imagem")

        mime_type = alert.imagem_mime_type or "image/jpeg"
        
        return StreamingResponse(
            BytesIO(alert.imagem_blob),
            media_type=mime_type,
            headers={
                "Content-Disposition": f"inline; filename=alerta_{alert_id}.jpg",
                "Cache-Control": "public, max-age=3600"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ALERTS] Erro ao buscar imagem do alerta {alert_id}: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao buscar imagem: {str(e)}")


@router.delete("/{alert_id}")
def delete_alert(alert_id: int, db: Session = Depends(get_db)):
    """
    Remove um alerta do sistema
    """
    try:
        alert = db.query(Alert).filter(Alert.id == alert_id).first()
        
        if not alert:
            raise HTTPException(status_code=404, detail="Alerta não encontrado")
        
        print(f"[ALERTS] Removendo alerta ID: {alert_id}")
        
        # Deletar permanentemente
        db.delete(alert)
        db.commit()
        
        print(f"[ALERTS] Alerta {alert_id} removido com sucesso")
        
        return {"ok": True, "message": f"Alerta {alert_id} removido com sucesso"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"[ALERTS] Erro ao remover alerta {alert_id}: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao remover alerta: {str(e)}")


@router.post("/{alert_id}/visualizar")
def mark_alert_viewed(
    alert_id: int,
    request_data: AlertViewRequest,
    db: Session = Depends(get_db)
):
    """
    Marca um alerta como visualizado por um usuário
    """
    try:
        alert = db.query(Alert).filter(Alert.id == alert_id).first()

        if not alert:
            raise HTTPException(status_code=404, detail="Alerta não encontrado")

        usuario_id = request_data.usuario_id or "anonymous"
        usuario_email = request_data.usuario_email or usuario_id
        usuario_nome = request_data.usuario_nome or usuario_id
        usuario_sobrenome = request_data.usuario_sobrenome or ""

        # Carregar array de usuários que visualizaram
        usuarios_visualizaram = alert.usuarios_visualizaram
        if not usuarios_visualizaram:
            usuarios_visualizaram = []
        else:
            # Se for JSON, parsear
            if isinstance(usuarios_visualizaram, str):
                try:
                    usuarios_visualizaram = json.loads(usuarios_visualizaram)
                except:
                    usuarios_visualizaram = []

        # Criar objeto de visualização com timestamp
        visualizacao = {
            "id": usuario_id,
            "email": usuario_email,
            "nome": usuario_nome,
            "sobrenome": usuario_sobrenome,
            "visualizado_em": datetime.now().isoformat()
        }

        # Verificar se o usuário já visualizou
        ja_visualizou = any(v.get("id") == usuario_id for v in usuarios_visualizaram if isinstance(v, dict))

        if not ja_visualizou:
            usuarios_visualizaram.append(visualizacao)
            alert.usuarios_visualizaram = usuarios_visualizaram
            db.commit()
            db.refresh(alert)
            print(f"[ALERTS] Alerta {alert_id} marcado como visualizado por {usuario_email}")

        return {"ok": True, "message": "Alerta marcado como visualizado"}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"[ALERTS] Erro ao marcar alerta como visualizado: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao marcar alerta: {str(e)}")


@router.get("/{alert_id}/viewers")
def get_alert_viewers(alert_id: int, db: Session = Depends(get_db)):
    """
    Retorna a lista de usuários que visualizaram um alerta com timestamps
    """
    try:
        alert = db.query(Alert).filter(Alert.id == alert_id).first()

        if not alert:
            raise HTTPException(status_code=404, detail="Alerta não encontrado")

        usuarios_visualizaram = alert.usuarios_visualizaram
        if not usuarios_visualizaram:
            return {"viewers": []}

        # Parsear se for string JSON
        if isinstance(usuarios_visualizaram, str):
            try:
                usuarios_visualizaram = json.loads(usuarios_visualizaram)
            except:
                usuarios_visualizaram = []

        # Converter para lista de dicts ordenada por data
        viewers = []
        for user in usuarios_visualizaram:
            if isinstance(user, dict):
                viewers.append(user)
            else:
                # Legacy format: just a string ID
                viewers.append({
                    "id": user,
                    "email": user,
                    "nome": user,
                    "sobrenome": "",
                    "visualizado_em": None
                })

        # Ordenar por data de visualização (mais recentes primeiro)
        viewers.sort(
            key=lambda x: x.get("visualizado_em") or "",
            reverse=True
        )

        return {"viewers": viewers}

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ALERTS] Erro ao buscar viewers do alerta {alert_id}: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao buscar viewers: {str(e)}")


@router.get("/debug/test")
def debug_test(db: Session = Depends(get_db)):
    """
    Endpoint de debug para testar a estrutura do modelo
    """
    try:
        from sqlalchemy import inspect

        # Inspecionar o modelo
        inspector = inspect(Alert)
        columns = {}
        for col in inspector.columns:
            columns[col.key] = str(col.type)

        # Tentar fazer uma query simples
        count = db.query(Alert).count()

        return {
            "status": "ok",
            "model_columns": columns,
            "total_alerts": count,
            "expected_columns": [
                "id", "title", "message", "description",
                "severity", "pages", "show_on_home", "created_by", "ativo",
                "created_at", "updated_at",
                "imagem_blob", "imagem_mime_type"
            ]
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "type": type(e).__name__
        }
