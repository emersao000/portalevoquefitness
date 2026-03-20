from sqlalchemy import Column, Integer, String, Text, DateTime, Enum, LargeBinary, Boolean, JSON
from sqlalchemy.sql import func
from core.db import Base

class Alert(Base):
    __tablename__ = "alert"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    severity = Column(Enum('low', 'medium', 'high', 'critical'), nullable=False, default='low')
    pages = Column(JSON, nullable=True, default=None)
    show_on_home = Column(Boolean, nullable=False, default=False)
    created_by = Column(String(255), nullable=True)
    ativo = Column(Boolean, nullable=False, default=True)
    usuarios_visualizaram = Column(JSON, nullable=True, default=None, comment='Array de objetos com informações de visualização: {id, email, nome, sobrenome, visualizado_em}')
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
    imagem_blob = Column(LargeBinary, nullable=True)
    imagem_mime_type = Column(String(100), nullable=True)
