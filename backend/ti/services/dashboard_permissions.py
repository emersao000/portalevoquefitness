"""
Serviço para gerenciar permissões de dashboards Power BI.

Suporta controle granular por:
- Roles (Administrador, Gestor, Funcionário, etc.)
- Usuários específicos
- Acesso público
"""

import json
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text
from ..models.powerbi_dashboard import PowerBIDashboard


def _normalize_permissions(permissoes: dict | None) -> dict:
    """
    Normaliza estrutura de permissões.
    Formato padrão: {"roles": [...], "users": [...], "public": false}
    """
    if not permissoes:
        return {"roles": [], "users": [], "public": False}
    
    return {
        "roles": permissoes.get("roles", []) or [],
        "users": [int(u) for u in (permissoes.get("users", []) or [])],
        "public": bool(permissoes.get("public", False)),
    }


def get_dashboard_permissions(db: Session, dashboard_id: str) -> dict:
    """Retorna as permissões de um dashboard."""
    try:
        dashboard = db.query(PowerBIDashboard).filter(
            PowerBIDashboard.dashboard_id == dashboard_id
        ).first()
        
        if not dashboard:
            raise ValueError(f"Dashboard {dashboard_id} não encontrado")
        
        perms = _normalize_permissions(dashboard.permissoes)
        return {
            "dashboard_id": dashboard.dashboard_id,
            "title": dashboard.title,
            "permissoes": perms,
            "permissoes_atualizadas_em": dashboard.permissoes_atualizadas_em,
        }
    except Exception as e:
        raise ValueError(f"Erro ao buscar permissões: {str(e)}")


def set_dashboard_permissions(db: Session, dashboard_id: str, permissoes: dict) -> dict:
    """Atualiza as permissões de um dashboard."""
    try:
        dashboard = db.query(PowerBIDashboard).filter(
            PowerBIDashboard.dashboard_id == dashboard_id
        ).first()
        
        if not dashboard:
            raise ValueError(f"Dashboard {dashboard_id} não encontrado")
        
        # Normalizar e salvar permissões
        normalized = _normalize_permissions(permissoes)
        dashboard.permissoes = json.dumps(normalized)
        dashboard.permissoes_atualizadas_em = datetime.utcnow()
        
        db.commit()
        db.refresh(dashboard)
        
        return {
            "dashboard_id": dashboard.dashboard_id,
            "permissoes": normalized,
            "permissoes_atualizadas_em": dashboard.permissoes_atualizadas_em,
        }
    except Exception as e:
        db.rollback()
        raise ValueError(f"Erro ao atualizar permissões: {str(e)}")


def add_role_permission(db: Session, dashboard_id: str, role: str) -> dict:
    """Adiciona uma role às permissões de um dashboard."""
    try:
        dashboard = db.query(PowerBIDashboard).filter(
            PowerBIDashboard.dashboard_id == dashboard_id
        ).first()
        
        if not dashboard:
            raise ValueError(f"Dashboard {dashboard_id} não encontrado")
        
        perms = _normalize_permissions(dashboard.permissoes)
        
        if role not in perms["roles"]:
            perms["roles"].append(role)
            dashboard.permissoes = json.dumps(perms)
            dashboard.permissoes_atualizadas_em = datetime.utcnow()
            db.commit()
            db.refresh(dashboard)
        
        return {"message": f"Role '{role}' adicionada", "permissoes": perms}
    except Exception as e:
        db.rollback()
        raise ValueError(f"Erro ao adicionar role: {str(e)}")


def remove_role_permission(db: Session, dashboard_id: str, role: str) -> dict:
    """Remove uma role das permissões de um dashboard."""
    try:
        dashboard = db.query(PowerBIDashboard).filter(
            PowerBIDashboard.dashboard_id == dashboard_id
        ).first()
        
        if not dashboard:
            raise ValueError(f"Dashboard {dashboard_id} não encontrado")
        
        perms = _normalize_permissions(dashboard.permissoes)
        
        if role in perms["roles"]:
            perms["roles"].remove(role)
            dashboard.permissoes = json.dumps(perms)
            dashboard.permissoes_atualizadas_em = datetime.utcnow()
            db.commit()
            db.refresh(dashboard)
        
        return {"message": f"Role '{role}' removida", "permissoes": perms}
    except Exception as e:
        db.rollback()
        raise ValueError(f"Erro ao remover role: {str(e)}")


def add_user_permission(db: Session, dashboard_id: str, user_id: int) -> dict:
    """Adiciona um usuário às permissões de um dashboard."""
    try:
        dashboard = db.query(PowerBIDashboard).filter(
            PowerBIDashboard.dashboard_id == dashboard_id
        ).first()
        
        if not dashboard:
            raise ValueError(f"Dashboard {dashboard_id} não encontrado")
        
        perms = _normalize_permissions(dashboard.permissoes)
        
        if user_id not in perms["users"]:
            perms["users"].append(user_id)
            dashboard.permissoes = json.dumps(perms)
            dashboard.permissoes_atualizadas_em = datetime.utcnow()
            db.commit()
            db.refresh(dashboard)
        
        return {"message": f"Usuário {user_id} adicionado", "permissoes": perms}
    except Exception as e:
        db.rollback()
        raise ValueError(f"Erro ao adicionar usuário: {str(e)}")


def remove_user_permission(db: Session, dashboard_id: str, user_id: int) -> dict:
    """Remove um usuário das permissões de um dashboard."""
    try:
        dashboard = db.query(PowerBIDashboard).filter(
            PowerBIDashboard.dashboard_id == dashboard_id
        ).first()
        
        if not dashboard:
            raise ValueError(f"Dashboard {dashboard_id} não encontrado")
        
        perms = _normalize_permissions(dashboard.permissoes)
        
        if user_id in perms["users"]:
            perms["users"].remove(user_id)
            dashboard.permissoes = json.dumps(perms)
            dashboard.permissoes_atualizadas_em = datetime.utcnow()
            db.commit()
            db.refresh(dashboard)
        
        return {"message": f"Usuário {user_id} removido", "permissoes": perms}
    except Exception as e:
        db.rollback()
        raise ValueError(f"Erro ao remover usuário: {str(e)}")


def set_public_access(db: Session, dashboard_id: str, is_public: bool) -> dict:
    """Define se um dashboard é acessível publicamente."""
    try:
        dashboard = db.query(PowerBIDashboard).filter(
            PowerBIDashboard.dashboard_id == dashboard_id
        ).first()
        
        if not dashboard:
            raise ValueError(f"Dashboard {dashboard_id} não encontrado")
        
        perms = _normalize_permissions(dashboard.permissoes)
        perms["public"] = bool(is_public)
        dashboard.permissoes = json.dumps(perms)
        dashboard.permissoes_atualizadas_em = datetime.utcnow()
        
        db.commit()
        db.refresh(dashboard)
        
        status = "público" if is_public else "privado"
        return {"message": f"Dashboard marcado como {status}", "permissoes": perms}
    except Exception as e:
        db.rollback()
        raise ValueError(f"Erro ao atualizar acesso público: {str(e)}")


def can_user_access(db: Session, dashboard_id: str, user_id: int, user_roles: list[str]) -> bool:
    """
    Verifica se um usuário tem permissão para acessar um dashboard.
    
    Um usuário pode acessar se:
    1. O dashboard é público
    2. O user_id está na lista de usuários permitidos
    3. Alguma das user_roles está na lista de roles permitidas
    """
    try:
        dashboard = db.query(PowerBIDashboard).filter(
            PowerBIDashboard.dashboard_id == dashboard_id
        ).first()
        
        if not dashboard:
            return False
        
        if not dashboard.ativo:
            return False
        
        perms = _normalize_permissions(dashboard.permissoes)
        
        # Acesso público
        if perms.get("public"):
            return True
        
        # Usuário específico
        if user_id in perms.get("users", []):
            return True
        
        # Role do usuário
        if user_roles:
            user_roles_normalized = [str(r).strip().lower() for r in user_roles]
            perms_roles = [str(r).strip().lower() for r in perms.get("roles", [])]
            if any(role in perms_roles for role in user_roles_normalized):
                return True
        
        return False
    except Exception as e:
        print(f"Erro ao verificar permissão: {str(e)}")
        return False


def get_all_dashboards_for_user(db: Session, user_id: int, user_roles: list[str]) -> list[dict]:
    """Retorna todos os dashboards que um usuário pode acessar."""
    try:
        dashboards = db.query(PowerBIDashboard).filter(
            PowerBIDashboard.ativo == True
        ).all()
        
        accessible = []
        for dashboard in dashboards:
            if can_user_access(db, dashboard.dashboard_id, user_id, user_roles):
                perms = _normalize_permissions(dashboard.permissoes)
                accessible.append({
                    "id": dashboard.id,
                    "dashboard_id": dashboard.dashboard_id,
                    "title": dashboard.title,
                    "category": dashboard.category,
                    "category_name": dashboard.category_name,
                })
        
        return accessible
    except Exception as e:
        print(f"Erro ao listar dashboards: {str(e)}")
        return []
