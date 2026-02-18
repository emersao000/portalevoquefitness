from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel

class PowerBIDashboardOut(BaseModel):
    id: int
    dashboard_id: str
    title: str
    description: str | None = None
    report_id: str
    dataset_id: str | None = None
    category: str
    category_name: str
    order: int
    ativo: bool
    criado_em: datetime
    atualizado_em: datetime

    class Config:
        from_attributes = True

class PowerBIDashboardCreate(BaseModel):
    dashboard_id: str
    title: str
    description: str | None = None
    report_id: str
    dataset_id: str | None = None
    category: str
    category_name: str
    order: int = 0
    ativo: bool = True

class PowerBIDashboardUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    report_id: str | None = None
    dataset_id: str | None = None
    category: str | None = None
    category_name: str | None = None
    order: int | None = None
    ativo: bool | None = None
