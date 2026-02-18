from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, Field
from .attachment import AnexoOut

class TicketCreate(BaseModel):
    assunto: str
    mensagem: str
    destinatarios: str = Field(..., description="Lista de emails separados por vírgula")

class HistoricoItem(BaseModel):
    t: datetime
    tipo: str
    label: str
    anexos: list[AnexoOut] | None = None
    usuario_id: int | None = None
    usuario_nome: str | None = None
    usuario_email: str | None = None

class HistoricoResponse(BaseModel):
    items: list[HistoricoItem]
