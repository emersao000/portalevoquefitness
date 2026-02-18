from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class NotificationSettingsBase(BaseModel):
    chamado_enabled: bool = True
    sistema_enabled: bool = True
    alerta_enabled: bool = True
    erro_enabled: bool = True
    som_habilitado: bool = True
    som_tipo: str = "notificacao"
    estilo_exibicao: str = "toast"
    posicao: str = "top-right"
    duracao: int = 5
    tamanho: str = "medio"
    mostrar_icone: bool = True
    mostrar_acao: bool = True

class NotificationSettingsCreate(NotificationSettingsBase):
    pass

class NotificationSettingsUpdate(BaseModel):
    chamado_enabled: Optional[bool] = None
    sistema_enabled: Optional[bool] = None
    alerta_enabled: Optional[bool] = None
    erro_enabled: Optional[bool] = None
    som_habilitado: Optional[bool] = None
    som_tipo: Optional[str] = None
    estilo_exibicao: Optional[str] = None
    posicao: Optional[str] = None
    duracao: Optional[int] = None
    tamanho: Optional[str] = None
    mostrar_icone: Optional[bool] = None
    mostrar_acao: Optional[bool] = None

class NotificationSettingsOut(NotificationSettingsBase):
    id: int
    criado_em: datetime
    atualizado_em: datetime

    class Config:
        from_attributes = True
