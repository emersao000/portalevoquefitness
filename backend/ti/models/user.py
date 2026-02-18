from __future__ import annotations
from datetime import datetime
from sqlalchemy import Integer, String, Boolean, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.db import Base
from core.utils import now_brazil_naive

class User(Base):
    __tablename__ = "user"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nome: Mapped[str] = mapped_column(String(150), nullable=False)
    sobrenome: Mapped[str] = mapped_column(String(150), nullable=False)
    usuario: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    senha_hash: Mapped[str] = mapped_column(String(255), nullable=True)
    alterar_senha_primeiro_acesso: Mapped[bool] = mapped_column(Boolean, default=False)
    nivel_acesso: Mapped[str] = mapped_column(String(50), nullable=False)
    setor: Mapped[str | None] = mapped_column(String(255), nullable=True)
    _setores: Mapped[str | None] = mapped_column("_setores", Text, nullable=True)
    _bi_subcategories: Mapped[str | None] = mapped_column("_bi_subcategories", Text, nullable=True)
    bloqueado: Mapped[bool] = mapped_column(Boolean, default=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    auth0_id: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)
    data_criacao: Mapped[datetime] = mapped_column(DateTime, default=now_brazil_naive)
    ultimo_acesso: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    tentativas_login: Mapped[int] = mapped_column(Integer, default=0)
    bloqueado_ate: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    session_revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
