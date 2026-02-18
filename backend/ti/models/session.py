from __future__ import annotations
from datetime import datetime, timedelta
from sqlalchemy import Integer, String, Boolean, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.db import Base
from core.utils import now_brazil_naive


class Session(Base):
    __tablename__ = "session"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    session_token: Mapped[str] = mapped_column(String(500), nullable=False, unique=True, index=True)
    refresh_token: Mapped[str | None] = mapped_column(String(500), nullable=True)
    access_token_expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    refresh_token_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_brazil_naive, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=now_brazil_naive, onupdate=now_brazil_naive)

    def is_expired(self) -> bool:
        """Check if session token is expired"""
        return datetime.utcnow() >= self.access_token_expires_at

    def is_refresh_token_expired(self) -> bool:
        """Check if refresh token is expired"""
        if not self.refresh_token_expires_at:
            return True
        return datetime.utcnow() >= self.refresh_token_expires_at

    def refresh(self, new_expires_at: datetime, new_refresh_expires_at: datetime | None = None):
        """Refresh the session tokens"""
        self.access_token_expires_at = new_expires_at
        if new_refresh_expires_at:
            self.refresh_token_expires_at = new_refresh_expires_at
        self.updated_at = now_brazil_naive()

    def revoke(self):
        """Revoke the session"""
        self.is_active = False
        self.updated_at = now_brazil_naive()
