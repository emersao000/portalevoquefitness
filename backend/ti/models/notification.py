from __future__ import annotations
from datetime import datetime
from sqlalchemy import Integer, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from core.db import Base
from core.utils import now_brazil_naive

class Notification(Base):
    __tablename__ = "notification"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # Tipo de notificação (ex.: chamado)
    tipo: Mapped[str] = mapped_column(String(50), nullable=False)
    # Título curto da notificação
    titulo: Mapped[str] = mapped_column(String(200), nullable=False)
    # Mensagem detalhada (opcional)
    mensagem: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Recurso relacionado (ex.: 'chamado') e seu id
    recurso: Mapped[str | None] = mapped_column(String(50), nullable=True)
    recurso_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Ação relacionada (ex.: 'criado', 'status_alterado', 'excluido')
    acao: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # Dados adicionais no formato JSON (serializado em texto)
    dados: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Leitura/controle
    lido: Mapped[bool] = mapped_column(Boolean, default=False)
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=now_brazil_naive)
    lido_em: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Destinatário específico (opcional). Se nulo, considerado broadcast/geral
    usuario_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("user.id"), nullable=True)
