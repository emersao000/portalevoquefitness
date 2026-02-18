from __future__ import annotations
from datetime import datetime
from sqlalchemy import Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.db import Base

class HistoricoTicket(Base):
    __tablename__ = "historicos_tickets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    chamado_id: Mapped[int] = mapped_column(Integer, ForeignKey("chamado.id"), nullable=False)
    usuario_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("user.id"), nullable=True)
    assunto: Mapped[str] = mapped_column(String(255), nullable=False)
    mensagem: Mapped[str] = mapped_column(Text, nullable=False)
    destinatarios: Mapped[str] = mapped_column(String(255), nullable=False)
    data_envio: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    chamado: Mapped["Chamado"] = relationship("Chamado", back_populates="historicos_ticket")
