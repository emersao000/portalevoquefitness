from __future__ import annotations
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel, Field, field_serializer
from .attachment import AnexoOut

BRAZIL_OFFSET = timedelta(hours=-3)
BRAZIL_TZ = timezone(BRAZIL_OFFSET)

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

    @field_serializer("t")
    def serialize_t(self, dt: datetime) -> str:
        """
        Garante que o datetime sempre seja serializado com info de timezone.
        Datetimes naive são tratados como horário de Brasília (UTC-3),
        pois o backend usa now_brazil_naive() para gravar timestamps locais.
        """
        if dt.tzinfo is None:
            # Naive → assume Brasília (UTC-3)
            dt = dt.replace(tzinfo=BRAZIL_TZ)
        else:
            # Aware → converte para Brasília antes de serializar
            dt = dt.astimezone(BRAZIL_TZ)
        return dt.isoformat()

class HistoricoResponse(BaseModel):
    items: list[HistoricoItem]
