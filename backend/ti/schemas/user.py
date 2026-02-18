from __future__ import annotations
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional

class UserCreate(BaseModel):
    nome: str
    sobrenome: str
    usuario: str
    email: EmailStr
    senha: Optional[str] = Field(default=None, min_length=6)
    nivel_acesso: str
    setores: Optional[List[str]] = None
    bi_subcategories: Optional[List[str]] = None
    alterar_senha_primeiro_acesso: bool = True
    bloqueado: bool = False

class UserUpdate(BaseModel):
    """Schema para atualizar usuário"""
    nome: Optional[str] = None
    sobrenome: Optional[str] = None
    usuario: Optional[str] = None
    email: Optional[str] = None  # Allow any string, validation happens in service layer
    nivel_acesso: Optional[str] = None
    setores: Optional[List[str]] = None
    bi_subcategories: Optional[List[str]] = None
    alterar_senha_primeiro_acesso: Optional[bool] = None
    bloqueado: Optional[bool] = None

    class Config:
        # Allow extra fields and use by default populate_by_name
        extra = "ignore"

class UserOut(BaseModel):
    id: int
    nome: str
    sobrenome: str
    usuario: str
    email: EmailStr
    nivel_acesso: str
    setor: str | None
    setores: Optional[List[str]] | None = None
    bi_subcategories: Optional[List[str]] | None = None
    bloqueado: bool = False
    session_revoked_at: Optional[str] | None = None

    class Config:
        from_attributes = True

class UserCreatedOut(UserOut):
    senha: str  # senha em texto plano (retornada uma única vez)
    auth0_id: Optional[str] = None  # Auth0 user ID if created in Auth0
    auth0_created: bool = False  # Whether user was successfully created in Auth0

class UserAvailability(BaseModel):
    email_exists: Optional[bool] = None
    usuario_exists: Optional[bool] = None
