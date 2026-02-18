"""
API endpoints para gerenciar permissões de dashboards Power BI.

Endpoints:
- GET /api/dashboard-permissions/{dashboard_id} - Obter permissões
- PUT /api/dashboard-permissions/{dashboard_id} - Atualizar permissões
- POST /api/dashboard-permissions/{dashboard_id}/roles - Adicionar role
- DELETE /api/dashboard-permissions/{dashboard_id}/roles/{role} - Remover role
- POST /api/dashboard-permissions/{dashboard_id}/users - Adicionar usuário
- DELETE /api/dashboard-permissions/{dashboard_id}/users/{user_id} - Remover usuário
- PUT /api/dashboard-permissions/{dashboard_id}/public - Definir acesso público
- GET /api/dashboards/accessible - Dashboards acessíveis para o usuário
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from core.db import get_db
from ..services.dashboard_permissions import (
    get_dashboard_permissions,
    set_dashboard_permissions,
    add_role_permission,
    remove_role_permission,
    add_user_permission,
    remove_user_permission,
    set_public_access,
    can_user_access,
    get_all_dashboards_for_user,
)
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter(prefix="/api", tags=["dashboard-permissions"])


class PermissionsUpdate(BaseModel):
    roles: Optional[List[str]] = None
    users: Optional[List[int]] = None
    public: Optional[bool] = None


class RoleRequest(BaseModel):
    role: str


class UserRequest(BaseModel):
    user_id: int


class PublicAccessRequest(BaseModel):
    public: bool


@router.get("/dashboard-permissions/{dashboard_id}")
def get_permissions(dashboard_id: str, db: Session = Depends(get_db)):
    """Obter permissões de um dashboard."""
    try:
        return get_dashboard_permissions(db, dashboard_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao buscar permissões: {str(e)}")


@router.put("/dashboard-permissions/{dashboard_id}")
def update_permissions(
    dashboard_id: str,
    data: PermissionsUpdate,
    db: Session = Depends(get_db),
):
    """Atualizar permissões de um dashboard."""
    try:
        # Obter permissões atuais
        current = get_dashboard_permissions(db, dashboard_id)
        perms = current["permissoes"]
        
        # Atualizar campos fornecidos
        if data.roles is not None:
            perms["roles"] = data.roles
        if data.users is not None:
            perms["users"] = data.users
        if data.public is not None:
            perms["public"] = data.public
        
        return set_dashboard_permissions(db, dashboard_id, perms)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar: {str(e)}")


@router.post("/dashboard-permissions/{dashboard_id}/roles")
def add_role(
    dashboard_id: str,
    data: RoleRequest,
    db: Session = Depends(get_db),
):
    """Adicionar uma role às permissões."""
    try:
        return add_role_permission(db, dashboard_id, data.role)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao adicionar role: {str(e)}")


@router.delete("/dashboard-permissions/{dashboard_id}/roles/{role}")
def remove_role(
    dashboard_id: str,
    role: str,
    db: Session = Depends(get_db),
):
    """Remover uma role das permissões."""
    try:
        return remove_role_permission(db, dashboard_id, role)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao remover role: {str(e)}")


@router.post("/dashboard-permissions/{dashboard_id}/users")
def add_user(
    dashboard_id: str,
    data: UserRequest,
    db: Session = Depends(get_db),
):
    """Adicionar um usuário às permissões."""
    try:
        return add_user_permission(db, dashboard_id, data.user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao adicionar usuário: {str(e)}")


@router.delete("/dashboard-permissions/{dashboard_id}/users/{user_id}")
def remove_user(
    dashboard_id: str,
    user_id: int,
    db: Session = Depends(get_db),
):
    """Remover um usuário das permissões."""
    try:
        return remove_user_permission(db, dashboard_id, user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao remover usuário: {str(e)}")


@router.put("/dashboard-permissions/{dashboard_id}/public")
def set_public(
    dashboard_id: str,
    data: PublicAccessRequest,
    db: Session = Depends(get_db),
):
    """Definir acesso público de um dashboard."""
    try:
        return set_public_access(db, dashboard_id, data.public)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar: {str(e)}")


@router.get("/dashboards/accessible")
def get_accessible_dashboards(
    db: Session = Depends(get_db),
    user_id: int = Query(...),
    roles: str = Query(default=""),
):
    """
    Obter dashboards acessíveis para um usuário.
    
    Parâmetros:
    - user_id: ID do usuário
    - roles: Roles do usuário (separadas por vírgula, ex: "Administrador,Gestor")
    """
    try:
        roles_list = [r.strip() for r in roles.split(",") if r.strip()] if roles else []
        dashboards = get_all_dashboards_for_user(db, user_id, roles_list)
        return {"dashboards": dashboards, "total": len(dashboards)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao listar dashboards: {str(e)}")


@router.get("/dashboards/{dashboard_id}/check-access")
def check_user_access(
    dashboard_id: str,
    user_id: int = Query(...),
    roles: str = Query(default=""),
    db: Session = Depends(get_db),
):
    """
    Verificar se um usuário tem acesso a um dashboard específico.
    
    Parâmetros:
    - user_id: ID do usuário
    - roles: Roles do usuário (separadas por vírgula)
    """
    try:
        roles_list = [r.strip() for r in roles.split(",") if r.strip()] if roles else []
        has_access = can_user_access(db, dashboard_id, user_id, roles_list)
        return {
            "dashboard_id": dashboard_id,
            "user_id": user_id,
            "has_access": has_access,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao verificar acesso: {str(e)}")
