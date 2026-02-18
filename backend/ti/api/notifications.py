from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_
from core.db import get_db, engine
from ..models.notification import Notification
from ..schemas.notification import NotificationOut
from typing import Optional

router = APIRouter(prefix="/notifications", tags=["TI - Notificações"])

@router.get("", response_model=list[NotificationOut])
def list_notifications(
    limit: int = 50,
    unread_only: bool = False,
    usuario_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Lista notificações do sistema.

    Parameters:
    - limit: número máximo de notificações a retornar (max 500)
    - unread_only: se True, retorna apenas notificações não lidas
    - usuario_id: filtrar por usuário específico (opcional)
    """
    try:
        try:
            Notification.__table__.create(bind=engine, checkfirst=True)
        except Exception:
            pass

        query = db.query(Notification)

        if unread_only:
            query = query.filter(Notification.lido == False)

        if usuario_id:
            query = query.filter(Notification.usuario_id == usuario_id)

        q = (
            query
            .order_by(Notification.id.desc())
            .limit(max(1, min(500, int(limit))))
        )
        return q.all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao listar notificações: {e}")

@router.get("/stats")
def notification_stats(usuario_id: Optional[int] = None, db: Session = Depends(get_db)):
    """
    Retorna estatísticas de notificações (total, lidas, não lidas).
    """
    try:
        try:
            Notification.__table__.create(bind=engine, checkfirst=True)
        except Exception:
            pass

        query = db.query(Notification)
        if usuario_id:
            query = query.filter(Notification.usuario_id == usuario_id)

        total = query.count()
        unread = query.filter(Notification.lido == False).count()
        read = total - unread

        return {
            "total": total,
            "lidas": read,
            "nao_lidas": unread
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao obter estatísticas: {e}")

@router.patch("/{notification_id}/read", response_model=NotificationOut)
def mark_read(notification_id: int, db: Session = Depends(get_db)):
    """Marca uma notificação específica como lida."""
    try:
        n = db.query(Notification).filter(Notification.id == notification_id).first()
        if not n:
            raise HTTPException(status_code=404, detail="Notificação não encontrada")
        if not n.lido:
            from core.utils import now_brazil_naive
            n.lido = True
            n.lido_em = now_brazil_naive()
            db.add(n)
            db.commit()
            db.refresh(n)
        return n
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar notificação: {e}")

@router.patch("/read-all")
def mark_all_read(db: Session = Depends(get_db)):
    """Marca todas as notificações como lidas."""
    try:
        from core.utils import now_brazil_naive
        now = now_brazil_naive()

        unread_count = db.query(Notification).filter(Notification.lido == False).count()

        if unread_count > 0:
            db.query(Notification).filter(Notification.lido == False).update({
                Notification.lido: True,
                Notification.lido_em: now
            })
            db.commit()

        return {
            "ok": True,
            "message": f"Marcadas {unread_count} notificações como lidas"
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao marcar notificações como lidas: {e}")

@router.delete("/{notification_id}")
def delete_notification(notification_id: int, db: Session = Depends(get_db)):
    """Delete uma notificação específica."""
    try:
        n = db.query(Notification).filter(Notification.id == notification_id).first()
        if not n:
            raise HTTPException(status_code=404, detail="Notificação não encontrada")

        db.delete(n)
        db.commit()

        return {"ok": True, "message": "Notificação deletada com sucesso"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao deletar notificação: {e}")

@router.delete("")
def delete_all_notifications(lido_only: bool = False, db: Session = Depends(get_db)):
    """
    Delete todas as notificações ou apenas as lidas.

    Parameters:
    - lido_only: se True, deleta apenas notificações lidas
    """
    try:
        query = db.query(Notification)

        if lido_only:
            query = query.filter(Notification.lido == True)

        count = query.count()

        if count > 0:
            query.delete()
            db.commit()

        return {
            "ok": True,
            "message": f"Deletadas {count} notificações"
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro ao deletar notificações: {e}")
