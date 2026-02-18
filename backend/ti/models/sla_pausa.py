from __future__ import annotations
from datetime import datetime
from sqlalchemy import Integer, String, DateTime, Float, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.db import Base


class SLAPausa(Base):
    """Pausas automáticas de SLA (status Aguardando) e manuais"""
    __tablename__ = "sla_pausa"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    chamado_id: Mapped[int] = mapped_column(Integer, ForeignKey("chamado.id"), nullable=False, index=True)

    inicio: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    fim: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    duracao_horas: Mapped[float] = mapped_column(Float, default=0.0)

    tipo: Mapped[str] = mapped_column(String(20), default="status")
    status_pausante: Mapped[str | None] = mapped_column(String(50), nullable=True)
    motivo: Mapped[str | None] = mapped_column(Text, nullable=True)

    criado_em: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    atualizado_em: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    chamado: Mapped["Chamado"] = relationship("Chamado", back_populates="pausas_sla")
