from __future__ import annotations
from pydantic import BaseModel, Field, ConfigDict, AliasChoices

class ProblemaCreate(BaseModel):
    # Accept both legacy and new field names; provide sensible defaults
    nome: str
    prioridade: str = Field(default="Normal", validation_alias=AliasChoices("prioridade", "prioridade_padrao"))
    requer_internet: bool = Field(default=False, validation_alias=AliasChoices("requer_internet", "requer_item_internet"))
    tempo_resolucao_horas: int | None = Field(default=None, description="Tempo máximo para resolver em horas")
    ativo: bool | None = None

    model_config = ConfigDict(populate_by_name=True, extra="ignore")

class ProblemaUpdate(BaseModel):
    prioridade: str | None = Field(default=None, description="Prioridade do problema")
    tempo_resolucao_horas: int | None = Field(default=None, description="Tempo máximo para resolver em horas")
    requer_internet: bool | None = Field(default=None, description="Se requer item de internet")

    model_config = ConfigDict(populate_by_name=True, extra="ignore", str_strip_whitespace=True)

class ProblemaOut(BaseModel):
    id: int
    nome: str
    prioridade: str
    requer_internet: bool
    tempo_resolucao_horas: int | None = None

    class Config:
        from_attributes = True
