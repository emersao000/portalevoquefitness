from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel

class AnexoOut(BaseModel):
    id: int
    nome_original: str
    caminho_arquivo: str
    mime_type: str | None = None
    tamanho_bytes: int | None = None
    data_upload: datetime | None = None

    class Config:
        from_attributes = True
