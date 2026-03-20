from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.db import get_db, engine
from ..models.notification_settings import NotificationSettings
from ..schemas.notification_settings import NotificationSettingsOut, NotificationSettingsCreate, NotificationSettingsUpdate

router = APIRouter(prefix="/notification-settings", tags=["TI - Configurações de Notificações"])

@router.get("", response_model=NotificationSettingsOut)
def get_notification_settings(db: Session = Depends(get_db)):
    """
    Retorna as configurações globais de notificações do sistema.
    Se não existir, cria uma com valores padrão.
    """
    try:
        # Garante que a tabela existe
        NotificationSettings.__table__.create(bind=engine, checkfirst=True)
        
        # Tenta buscar a primeira (e única) configuração
        settings = db.query(NotificationSettings).first()
        
        if not settings:
            # Se não existir, cria com valores padrão
            settings = NotificationSettings()
            db.add(settings)
            db.commit()
            db.refresh(settings)
        
        return settings
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao obter configurações: {e}")

@router.put("", response_model=NotificationSettingsOut)
def update_notification_settings(
    settings_update: NotificationSettingsUpdate,
    db: Session = Depends(get_db)
):
    """
    Atualiza as configurações globais de notificações do sistema.
    """
    try:
        # Garante que a tabela existe
        NotificationSettings.__table__.create(bind=engine, checkfirst=True)
        
        # Tenta buscar a primeira configuração
        settings = db.query(NotificationSettings).first()
        
        if not settings:
            # Se não existir, cria com os dados fornecidos
            settings = NotificationSettings(**settings_update.model_dump(exclude_unset=True))
            db.add(settings)
        else:
            # Atualiza apenas os campos fornecidos
            update_data = settings_update.model_dump(exclude_unset=True)
            for key, value in update_data.items():
                setattr(settings, key, value)
            db.add(settings)
        
        db.commit()
        db.refresh(settings)
        return settings
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar configurações: {e}")

@router.post("/reset", response_model=NotificationSettingsOut)
def reset_notification_settings(db: Session = Depends(get_db)):
    """
    Reseta as configurações para os valores padrão.
    """
    try:
        # Garante que a tabela existe
        NotificationSettings.__table__.create(bind=engine, checkfirst=True)
        
        # Deleta a configuração atual
        db.query(NotificationSettings).delete()
        db.commit()
        
        # Cria nova com valores padrão
        settings = NotificationSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)
        
        return settings
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao resetar configurações: {e}")
