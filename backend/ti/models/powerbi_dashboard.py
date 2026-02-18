from datetime import datetime
from sqlalchemy import Integer, String, DateTime, Boolean, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column
from core.db import Base

class PowerBIDashboard(Base):
    __tablename__ = "powerbi_dashboard"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    dashboard_id: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    report_id: Mapped[str] = mapped_column(String(255), nullable=False)
    dataset_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    category_name: Mapped[str] = mapped_column(String(255), nullable=False)
    order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    ativo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    atualizado_em: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    permissoes: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    permissoes_atualizadas_em: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
