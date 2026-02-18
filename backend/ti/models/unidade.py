from __future__ import annotations
from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from core.db import Base

class Unidade(Base):
    __tablename__ = "unidade"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nome: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    cidade: Mapped[str] = mapped_column(String(120), nullable=False)
