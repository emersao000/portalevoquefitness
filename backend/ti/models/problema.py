from __future__ import annotations
from sqlalchemy import Integer, String, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from core.db import Base

class Problema(Base):
    __tablename__ = "problema"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nome: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    prioridade: Mapped[str] = mapped_column(String(20), nullable=False, default="Normal")
    requer_internet: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    tempo_resolucao_horas: Mapped[int | None] = mapped_column(Integer, nullable=True)
