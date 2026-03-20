from __future__ import annotations
from datetime import date, datetime
from sqlalchemy import Integer, String, Date, DateTime, Text, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.db import Base

class Chamado(Base):
    __tablename__ = "chamado"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    codigo: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    protocolo: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    solicitante: Mapped[str] = mapped_column(String(100), nullable=False)
    cargo: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(120), nullable=False)
    telefone: Mapped[str] = mapped_column(String(20), nullable=False)
    unidade: Mapped[str] = mapped_column(String(100), nullable=False)
    problema: Mapped[str] = mapped_column(String(100), nullable=False)
    internet_item: Mapped[str | None] = mapped_column(String(50), nullable=True)
    descricao: Mapped[str | None] = mapped_column(Text, nullable=True)
    data_visita: Mapped[date | None] = mapped_column(Date, nullable=True)
    data_abertura: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    data_primeira_resposta: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    data_conclusao: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="Aberto")
    prioridade: Mapped[str] = mapped_column(String(20), nullable=False, default="Normal")
    retroativo: Mapped[bool] = mapped_column(nullable=False, default=False)

    status_assumido_por_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("user.id"), nullable=True)
    status_assumido_em: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    concluido_por_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("user.id"), nullable=True)
    concluido_em: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    cancelado_por_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("user.id"), nullable=True)
    cancelado_em: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    usuario_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("user.id"), nullable=True)
    deletado_em: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    __table_args__ = (
        Index("ix_chamado_deletado_em", "deletado_em"),
        Index("ix_chamado_usuario_id", "usuario_id"),
        Index("ix_chamado_email", "email"),
        Index("ix_chamado_status_assumido_por_id", "status_assumido_por_id"),
        Index("ix_chamado_status", "status"),
        Index("ix_chamado_data_abertura", "data_abertura"),
        # Compostos para as queries mais frequentes
        Index("ix_chamado_admin_list", "deletado_em", "id"),
        Index("ix_chamado_assumido_list", "deletado_em", "status_assumido_por_id", "id"),
    )

    anexos: Mapped[list["ChamadoAnexo"]] = relationship("ChamadoAnexo", cascade="all, delete-orphan", back_populates="chamado", lazy="noload")
    historicos_status: Mapped[list["HistoricoStatus"]] = relationship("HistoricoStatus", cascade="all, delete-orphan", back_populates="chamado", lazy="noload")
    historicos_ticket: Mapped[list["HistoricoTicket"]] = relationship("HistoricoTicket", cascade="all, delete-orphan", back_populates="chamado", lazy="noload")
    historicos_anexo: Mapped[list["HistoricoAnexo"]] = relationship("HistoricoAnexo", cascade="all, delete-orphan", back_populates="chamado", lazy="noload")
    pausas_sla: Mapped[list["SLAPausa"]] = relationship("SLAPausa", cascade="all, delete-orphan", back_populates="chamado", lazy="noload")
