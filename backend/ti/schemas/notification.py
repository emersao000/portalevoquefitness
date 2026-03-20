from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel

class NotificationOut(BaseModel):
    id: int
    tipo: str
    titulo: str
    mensagem: str | None = None
    recurso: str | None = None
    recurso_id: int | None = None
    acao: str | None = None
    dados: str | None = None
    lido: bool
    criado_em: datetime

    class Config:
        from_attributes = True
