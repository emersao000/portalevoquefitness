from __future__ import annotations
from datetime import datetime
from sqlalchemy import Integer, String, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column
from core.db import Base


class MetricsCacheDB(Base):
    __tablename__ = "metrics_cache_db"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cache_key: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    cache_value: Mapped[str] = mapped_column(Text, nullable=False)
    calculated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
