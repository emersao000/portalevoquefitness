from __future__ import annotations
from pydantic import BaseModel

class UnidadeCreate(BaseModel):
    id: int | None = None
    nome: str
    cidade: str | None = None

class UnidadeOut(BaseModel):
    id: int
    nome: str
    cidade: str

    class Config:
        from_attributes = True
