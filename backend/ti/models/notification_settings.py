from __future__ import annotations
from datetime import datetime
from sqlalchemy import Integer, String, Boolean, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column
from core.db import Base
from core.utils import now_brazil_naive

class NotificationSettings(Base):
    __tablename__ = "notification_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    
    # Configurações de tipos de notificação (habilitadas/desabilitadas)
    chamado_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    sistema_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    alerta_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    erro_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Configurações de som
    som_habilitado: Mapped[bool] = mapped_column(Boolean, default=True)
    som_tipo: Mapped[str] = mapped_column(String(50), default="notificacao")  # tipo de som
    
    # Configurações de exibição
    estilo_exibicao: Mapped[str] = mapped_column(String(50), default="toast")  # toast, banner, modal
    posicao: Mapped[str] = mapped_column(String(50), default="top-right")  # top-left, top-right, bottom-left, bottom-right
    duracao: Mapped[int] = mapped_column(Integer, default=5)  # segundos que a notificação aparece
    
    # Configurações de layout
    tamanho: Mapped[str] = mapped_column(String(50), default="medio")  # pequeno, medio, grande
    mostrar_icone: Mapped[bool] = mapped_column(Boolean, default=True)
    mostrar_acao: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Metadata
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=now_brazil_naive)
    atualizado_em: Mapped[datetime] = mapped_column(DateTime, default=now_brazil_naive, onupdate=now_brazil_naive)
