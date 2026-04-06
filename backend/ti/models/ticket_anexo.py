from __future__ import annotations
from datetime import datetime
from sqlalchemy import Integer, String, DateTime, ForeignKey, Boolean, LargeBinary
from sqlalchemy.orm import Mapped, mapped_column
from core.db import Base

class TicketAnexo(Base):
    __tablename__ = "ticket_anexos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    chamado_id: Mapped[int] = mapped_column(Integer, ForeignKey("chamado.id"), nullable=False)
    nome_original: Mapped[str] = mapped_column(String(255), nullable=False)
    nome_arquivo: Mapped[str] = mapped_column(String(255), nullable=False)
    caminho_arquivo: Mapped[str] = mapped_column(String(500), nullable=False)
    tamanho_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tipo_mime: Mapped[str | None] = mapped_column(String(100), nullable=True)
    extensao: Mapped[str | None] = mapped_column(String(20), nullable=True)
    hash_arquivo: Mapped[str | None] = mapped_column(String(64), nullable=True)
    conteudo: Mapped[bytes | None] = mapped_column(LargeBinary(length=16777215), nullable=True)  # MEDIUMBLOB
    data_upload: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    usuario_upload_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("user.id"), nullable=True)
    descricao: Mapped[str | None] = mapped_column(String(500), nullable=True)
    ativo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    origem: Mapped[str | None] = mapped_column(String(50), nullable=True)
