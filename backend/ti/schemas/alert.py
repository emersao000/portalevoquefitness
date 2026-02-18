from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel

class AlertOut(BaseModel):
    id: int
    title: str | None = None
    message: str | None = None
    severity: str | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    link: str | None = None
    media_id: int | None = None
    imagem_blob: bytes | None = None
    imagem_mime_type: str | None = None
    ativo: bool | None = True
    criado_em: datetime | None = None

    class Config:
        from_attributes = True

class AlertCreate(BaseModel):
    title: str | None = None
    message: str | None = None
    severity: str | None = "info"
    start_at: datetime | None = None
    end_at: datetime | None = None
    link: str | None = None
    media_id: int | None = None
    imagem_blob: bytes | None = None
    imagem_mime_type: str | None = None
    ativo: bool | None = True
