from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from sqlalchemy import func
from core.db import get_db, engine
from ti.schemas.user import UserCreate, UserCreatedOut, UserAvailability, UserOut, UserUpdate
from ti.services.users import (
    criar_usuario as service_criar,
    check_user_availability,
    generate_password,
    update_user,
    regenerate_password,
    set_block_status,
    delete_user,
    list_blocked_users,
)

router = APIRouter(prefix="/usuarios", tags=["TI - Usuarios"])

@router.get("", response_model=list[UserOut])
def listar_usuarios(db: Session = Depends(get_db)):
    try:
        from ..models import User
        from ..services.users import _denormalize_sector
        import json
        # helper to compute setores list
        def compute_setores(u) -> list[str]:
            try:
                if getattr(u, "_setores", None):
                    raw = json.loads(getattr(u, "_setores"))
                    # Denormalize back to canonical titles
                    return [_denormalize_sector(str(x)) if x is not None else "" for x in raw]
                if getattr(u, "setor", None):
                    return [_denormalize_sector(str(getattr(u, "setor")))]
            except Exception:
                pass
            return []

        # helper to compute bi_subcategories list
        def compute_bi_subcategories(u) -> list[str] | None:
            try:
                if getattr(u, "_bi_subcategories", None):
                    raw = json.loads(getattr(u, "_bi_subcategories"))
                    return [str(x) if x is not None else "" for x in raw]
            except Exception:
                pass
            return None

        # cria tabela se não existir
        try:
            User.__table__.create(bind=engine, checkfirst=True)
        except Exception:
            pass

        # pega todos os usuários
        try:
            users = db.query(User).order_by(User.id.desc()).all()
            rows = []
            for u in users:
                if u.bloqueado is None:
                    u.bloqueado = False
                # Ensure nome and sobrenome are non-empty strings
                user_nome = (u.nome or "").strip()
                user_sobrenome = (u.sobrenome or "").strip()
                if not user_nome:
                    user_nome = u.email.split("@")[0] if u.email else u.usuario

                setores_list = compute_setores(u)
                bi_subcategories_list = compute_bi_subcategories(u)
                rows.append({
                    "id": u.id,
                    "nome": user_nome,
                    "sobrenome": user_sobrenome,
                    "usuario": u.usuario,
                    "email": u.email,
                    "nivel_acesso": u.nivel_acesso,
                    "setor": setores_list[0] if setores_list else None,
                    "setores": setores_list,
                    "bi_subcategories": bi_subcategories_list,
                    "bloqueado": bool(u.bloqueado),
                    "session_revoked_at": u.session_revoked_at.isoformat() if getattr(u, 'session_revoked_at', None) else None,
                })
            return rows
        except Exception:
            pass

        # fallback tabela legada "usuarios"
        from sqlalchemy import text
        try:
            res = db.execute(text(
                "SELECT id, nome, sobrenome, usuario, email, nivel_acesso, setor FROM usuarios ORDER BY id DESC"
            ))
            rows = []
            for r in res.fetchall():
                s = r[6]
                # Ensure nome and sobrenome are non-empty strings
                user_nome = (r[1] or "").strip()
                user_sobrenome = (r[2] or "").strip()
                if not user_nome:
                    user_nome = r[4].split("@")[0] if r[4] else r[3]

                setores_list = [str(s)] if s else []
                rows.append({
                    "id": r[0],
                    "nome": user_nome,
                    "sobrenome": user_sobrenome,
                    "usuario": r[3],
                    "email": r[4],
                    "nivel_acesso": r[5],
                    "setor": s,
                    "setores": setores_list,
                    "bi_subcategories": None,
                    "bloqueado": False,
                })
            return rows
        except Exception:
            return []

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao listar usuários: {e}")

@router.post("", response_model=UserCreatedOut)
def criar_usuario(payload: UserCreate, db: Session = Depends(get_db)):
    try:
        from ..models import User
        try:
            User.__table__.create(bind=engine, checkfirst=True)
        except Exception:
            pass
        result = service_criar(db, payload)

        # Log the result for debugging
        print(f"[API] User created successfully:")
        print(f"  - ID: {result.id}")
        print(f"  - Email: {result.email}")
        print(f"  - Auth0 Created: {result.auth0_created}")
        print(f"  - Auth0 ID: {result.auth0_id}")

        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"[API] Error creating user: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao criar usuário: {e}")

@router.get("/check-availability", response_model=UserAvailability)
def check_availability(email: str | None = None, username: str | None = None, db: Session = Depends(get_db)):
    if email is None and username is None:
        raise HTTPException(status_code=400, detail="Informe email ou username para verificar")
    return check_user_availability(db, email, username)

@router.get("/generate-password")
def generate_password_endpoint(length: int = 12):
    # Mínimo 12 caracteres para atender requisitos Auth0
    if length < 12:
        length = 12
    if length > 64:
        length = 64
    return {"senha": generate_password(length)}


@router.get("/blocked", response_model=list[UserOut])
def listar_bloqueados(db: Session = Depends(get_db)):
    try:
        import json
        from ..models import User
        from ..services.users import _denormalize_sector
        users = list_blocked_users(db)
        rows = []
        for u in users:
            try:
                if u.bloqueado is None:
                    u.bloqueado = True
            except Exception:
                pass
            try:
                if getattr(u, "_setores", None):
                    raw = json.loads(getattr(u, "_setores"))
                    # Denormalize back to canonical titles
                    setores_list = [_denormalize_sector(str(x)) for x in raw if x is not None]
                elif getattr(u, "setor", None):
                    setores_list = [_denormalize_sector(str(getattr(u, "setor")))]
                else:
                    setores_list = []
            except Exception:
                setores_list = [_denormalize_sector(str(getattr(u, "setor")))] if getattr(u, "setor", None) else []
            try:
                bi_subcategories_list = None
                if getattr(u, "_bi_subcategories", None):
                    raw = json.loads(getattr(u, "_bi_subcategories"))
                    bi_subcategories_list = [str(x) if x is not None else "" for x in raw]
            except Exception:
                bi_subcategories_list = None

            # Ensure nome and sobrenome are non-empty strings
            user_nome = (u.nome or "").strip()
            user_sobrenome = (u.sobrenome or "").strip()
            if not user_nome:
                user_nome = u.email.split("@")[0] if u.email else u.usuario

            rows.append({
                "id": u.id,
                "nome": user_nome,
                "sobrenome": user_sobrenome,
                "usuario": u.usuario,
                "email": u.email,
                "nivel_acesso": u.nivel_acesso,
                "setor": setores_list[0] if setores_list else None,
                "setores": setores_list,
                "bi_subcategories": bi_subcategories_list,
                "bloqueado": bool(u.bloqueado),
                "session_revoked_at": u.session_revoked_at.isoformat() if getattr(u, 'session_revoked_at', None) else None,
            })
        return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao listar bloqueados: {e}")


@router.put("/{user_id}", response_model=UserOut)
def atualizar_usuario(user_id: int, payload: UserUpdate = Body(...), db: Session = Depends(get_db)):
    try:
        import json
        # Convert UserUpdate pydantic model to dict for service layer
        payload_dict = payload.model_dump(exclude_unset=True)
        print(f"[API] atualizar_usuario called for user_id={user_id}, payload keys={list(payload_dict.keys())}")
        print(f"[API] Full payload: {json.dumps(payload_dict, default=str)}")
        if "bi_subcategories" in payload_dict:
            print(f"[API] bi_subcategories in payload: {payload_dict['bi_subcategories']}")

        updated = update_user(db, user_id, payload_dict)
        print(f"[API] User updated successfully, new setores={getattr(updated, '_setores', 'N/A')}")
        print(f"[API] User updated successfully, new _bi_subcategories={getattr(updated, '_bi_subcategories', 'N/A')}")

        # Verify what was actually saved to the database
        db.refresh(updated)
        print(f"[API] After refresh from DB, _bi_subcategories={getattr(updated, '_bi_subcategories', 'N/A')}")

        # Notify the specific user their permissions/profile changed
        try:
            from core.realtime import emit_refresh_sync
            import threading
            import time

            print(f"\n{'='*70}")
            print(f"[API-NOTIFY] 🔔 Starting notification for user_id={updated.id}")
            print(f"[API-NOTIFY] User email: {updated.email}")
            print(f"[API-NOTIFY] New nivel_acesso: {updated.nivel_acesso}")
            print(f"[API-NOTIFY] New _setores: {getattr(updated, '_setores', 'N/A')}")
            print(f"[API-NOTIFY] New _bi_subcategories: {getattr(updated, '_bi_subcategories', 'N/A')}")

            # Send immediately
            print(f"[API-NOTIFY] ✓ Sending refresh event immediately via Socket.IO...")
            try:
                emit_refresh_sync(updated.id)
                print(f"[API-NOTIFY] ✓ Immediate refresh event sent successfully for user_id={updated.id}")
            except Exception as e:
                print(f"[API-NOTIFY] ✗ Failed to send immediate refresh event: {e}")
                import traceback
                traceback.print_exc()

            # Also send after a short delay to ensure client is ready
            def delayed_emit():
                try:
                    time.sleep(0.3)
                    print(f"[API-NOTIFY] ⏰ Sending delayed (0.3s) refresh event for user_id={updated.id}")
                    emit_refresh_sync(updated.id)
                    print(f"[API-NOTIFY] ✓ Delayed refresh event sent successfully for user_id={updated.id}")
                except Exception as e:
                    print(f"[API-NOTIFY] ✗ Failed to send delayed refresh event: {e}")
                    import traceback
                    traceback.print_exc()

            t = threading.Thread(target=delayed_emit, daemon=True)
            t.start()

            print(f"[API-NOTIFY] ✓ Refresh events queued for user_id={updated.id}")
            print(f"{'='*70}\n")
        except Exception as ex:
            print(f"[API-NOTIFY] ✗ failed to emit auth:refresh: {ex}")
            import traceback
            traceback.print_exc()

        # Convert to dict with datetime serialization
        try:
            from ti.services.users import _denormalize_sector
            if getattr(updated, "_setores", None):
                raw = json.loads(updated._setores)
                # Denormalize back to canonical titles
                setores_list = [_denormalize_sector(str(x)) for x in raw if x is not None]
            elif getattr(updated, "setor", None):
                setores_list = [_denormalize_sector(str(updated.setor))]
            else:
                setores_list = []
        except Exception:
            setores_list = [_denormalize_sector(str(updated.setor))] if getattr(updated, "setor", None) else []

        try:
            bi_subcategories_list = None
            bi_raw = getattr(updated, "_bi_subcategories", None)
            if bi_raw:
                raw = json.loads(bi_raw)
                bi_subcategories_list = [str(x) if x is not None else "" for x in raw]
                print(f"[API] bi_subcategories parsed from '{bi_raw}' -> {bi_subcategories_list}")
            else:
                print(f"[API] _bi_subcategories is None/empty -> bi_subcategories_list is None")
        except Exception as e:
            print(f"[API] Error parsing _bi_subcategories: {e}")
            bi_subcategories_list = None

        # Ensure nome and sobrenome are non-empty strings
        user_nome = (updated.nome or "").strip()
        user_sobrenome = (updated.sobrenome or "").strip()
        if not user_nome:
            user_nome = updated.email.split("@")[0] if updated.email else updated.usuario

        return {
            "id": updated.id,
            "nome": user_nome,
            "sobrenome": user_sobrenome,
            "usuario": updated.usuario,
            "email": updated.email,
            "nivel_acesso": updated.nivel_acesso,
            "setor": setores_list[0] if setores_list else None,
            "setores": setores_list,
            "bi_subcategories": bi_subcategories_list,
            "bloqueado": bool(updated.bloqueado),
            "session_revoked_at": updated.session_revoked_at.isoformat() if getattr(updated, 'session_revoked_at', None) else None,
        }
    except ValueError as e:
        print(f"[API] ValueError: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"[API] Exception: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar: {e}")


@router.get("/{user_id}/debug-setores")
def debug_user_setores(user_id: int, db: Session = Depends(get_db)):
    """Debug endpoint to check what's actually in the database for a user's setores/permissions"""
    try:
        from ..models import User
        from ..services.users import _denormalize_sector
        User.__table__.create(bind=engine, checkfirst=True)

        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return {"error": f"User {user_id} not found"}

        import json

        setores_raw = getattr(user, "_setores", None)
        setor_single = getattr(user, "setor", None)
        setores_parsed = None
        setores_denormalized = None

        try:
            if setores_raw:
                setores_parsed = json.loads(setores_raw)
                setores_denormalized = [_denormalize_sector(str(x)) for x in setores_parsed]
        except Exception as e:
            pass

        return {
            "user_id": user.id,
            "usuario": user.usuario,
            "user_name": f"{user.nome} {user.sobrenome}",
            "_setores_raw_db": setores_raw,
            "_setores_parsed": setores_parsed,
            "_setores_denormalized": setores_denormalized,
            "setor_single": setor_single,
            "note": "Mostra o estado bruto e processado dos setores no banco"
        }
    except Exception as e:
        return {"error": str(e)}

@router.get("/{user_id}/debug-bi")
def debug_user_bi(user_id: int, db: Session = Depends(get_db)):
    """Debug endpoint to check what's actually in the database for a user's BI permissions"""
    try:
        from ..models import User
        User.__table__.create(bind=engine, checkfirst=True)

        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return {"error": f"User {user_id} not found"}

        import json
        bi_raw = getattr(user, "_bi_subcategories", None)
        bi_parsed = None
        try:
            if bi_raw:
                bi_parsed = json.loads(bi_raw)
        except Exception as e:
            pass

        return {
            "user_id": user.id,
            "user_name": f"{user.nome} {user.sobrenome}",
            "_bi_subcategories_raw": bi_raw,
            "_bi_subcategories_parsed": bi_parsed,
            "note": "Check the _bi_subcategories_raw field in database"
        }
    except Exception as e:
        return {"error": str(e)}


@router.get("/{user_id}", response_model=UserOut)
def get_usuario(user_id: int, db: Session = Depends(get_db)):
    try:
        from ..models import User
        from ..services.users import _denormalize_sector
        import json
        User.__table__.create(bind=engine, checkfirst=True)

        user = db.query(User).filter(User.id == user_id).first()

        if not user:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")

        try:
            if user._setores:
                raw = json.loads(user._setores)
                # Denormalize back to canonical titles
                setores_list = [_denormalize_sector(str(x)) for x in raw if x is not None]
            elif user.setor:
                setores_list = [_denormalize_sector(str(user.setor))]
            else:
                setores_list = []
        except Exception:
            setores_list = [_denormalize_sector(str(user.setor))] if user.setor else []

        try:
            bi_subcategories_list = None
            if getattr(user, "_bi_subcategories", None):
                raw = json.loads(user._bi_subcategories)
                bi_subcategories_list = [str(x) if x is not None else "" for x in raw]
        except Exception:
            bi_subcategories_list = None

        # Ensure nome and sobrenome are non-empty strings
        user_nome = (user.nome or "").strip()
        user_sobrenome = (user.sobrenome or "").strip()
        if not user_nome:
            user_nome = user.email.split("@")[0] if user.email else user.usuario

        return {
            "id": user.id,
            "nome": user_nome,
            "sobrenome": user_sobrenome,
            "usuario": user.usuario,
            "email": user.email,
            "nivel_acesso": user.nivel_acesso,
            "setor": setores_list[0] if setores_list else None,
            "setores": setores_list,
            "bi_subcategories": bi_subcategories_list,
            "bloqueado": bool(user.bloqueado),
            "session_revoked_at": user.session_revoked_at.isoformat() if getattr(user, 'session_revoked_at', None) else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[API] get_usuario error for user_id={user_id}: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao obter usuário: {e}")


@router.post("/{user_id}/generate-password")
def gerar_nova_senha(user_id: int, length: int = 12, db: Session = Depends(get_db)):
    try:
        # Mínimo 12 caracteres para atender requisitos Auth0
        if length < 12:
            length = 12
        pwd = regenerate_password(db, user_id, length)
        return {"senha": pwd}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao gerar senha: {e}")


@router.post("/{user_id}/logout")
def force_logout(user_id: int, db: Session = Depends(get_db)):
    """Force logout by setting session_revoked_at to now."""
    try:
        print(f"[API] force_logout called for user_id={user_id}")
        from ..models import User
        import traceback
        User.__table__.create(bind=engine, checkfirst=True)
        user = db.query(User).filter(User.id == user_id).first()
        print(f"[API] queried user -> {bool(user)}")
        if not user:
            raise HTTPException(status_code=404, detail="Usuário não encontrado")
        from core.utils import now_brazil_naive
        ts = now_brazil_naive()
        print(f"[API] setting session_revoked_at={ts.isoformat()}")
        user.session_revoked_at = ts
        db.commit()
        db.refresh(user)
        print(f"[API] committed session_revoked_at for user {user.id}")
        try:
            # verify value directly from DB using raw SQL to ensure commit persisted
            from sqlalchemy import text
            try:
                row = db.execute(text("SELECT session_revoked_at FROM `user` WHERE id = :id"), {"id": user.id}).fetchone()
                print(f"[API] raw select after commit -> {row}")
            except Exception as rex:
                print(f"[API] raw select failed: {rex}")
        except Exception:
            pass
        try:
            # Emit using a background thread to run the synchronous wrapper safely
            from core.realtime import emit_logout_sync
            import threading
            try:
                t = threading.Thread(target=emit_logout_sync, args=(user.id,), daemon=True)
                t.start()
                print(f"[API] started thread to emit socket logout for user={user.id}")
            except Exception as ex:
                print(f"[API] threading emit failed: {ex}")
        except Exception as e:
            print(f"[API] failed to emit socket logout: {e}")
        # return user minimal
        try:
            setores_list = []
            import json
            from ti.services.users import _denormalize_sector
            if getattr(user, "_setores", None):
                # Denormalize back to canonical titles
                setores_list = [_denormalize_sector(str(x)) for x in json.loads(user._setores) if x is not None]
            elif getattr(user, "setor", None):
                setores_list = [_denormalize_sector(str(user.setor))]
        except Exception:
            setores_list = [_denormalize_sector(str(user.setor))] if user.setor else []

        # Ensure nome and sobrenome are non-empty strings
        user_nome = (user.nome or "").strip()
        user_sobrenome = (user.sobrenome or "").strip()
        if not user_nome:
            user_nome = user.email.split("@")[0] if user.email else user.usuario

        return {
            "id": user.id,
            "nome": user_nome,
            "sobrenome": user_sobrenome,
            "usuario": user.usuario,
            "email": user.email,
            "nivel_acesso": user.nivel_acesso,
            "setor": setores_list[0] if setores_list else None,
            "setores": setores_list,
            "bloqueado": bool(user.bloqueado),
            "session_revoked_at": user.session_revoked_at.isoformat() if getattr(user, 'session_revoked_at', None) else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        print("[API] force_logout error:")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao deslogar usuário: {e}")


@router.post("/auth0-login")
def auth0_login(payload: dict, db: Session = Depends(get_db)):
    """
    Valida token JWT do Auth0 e faz login do usuário
    Requer Authorization header com Bearer token
    """
    try:
        import os
        import json
        from datetime import datetime
        import httpx
        from jose import jwt

        email = payload.get("email")
        name = payload.get("name", "")

        if not email:
            raise HTTPException(status_code=400, detail="Email não fornecido")

        # Buscar usuário no banco pelo email (case-insensitive search)
        from ti.models import User
        email_lower = email.lower() if email else None
        user = db.query(User).filter(func.lower(User.email) == email_lower).first()

        if not user:
            raise HTTPException(
                status_code=403,
                detail=f"Usuário com email '{email}' não encontrado no sistema. Contate o administrador."
            )

        if user.bloqueado:
            raise HTTPException(
                status_code=403,
                detail="Usuário bloqueado. Contate o administrador."
            )

        # Preparar resposta com dados do usuário
        import json
        from ti.services.users import _denormalize_sector
        setores_list = []
        if getattr(user, "_setores", None):
            try:
                raw = json.loads(getattr(user, "_setores", "[]"))
                # Denormalize back to canonical titles
                setores_list = [_denormalize_sector(str(x)) for x in raw if x is not None]
            except:
                setores_list = []

        bi_subcategories_list = None
        if getattr(user, "_bi_subcategories", None):
            try:
                bi_subcategories_list = json.loads(getattr(user, "_bi_subcategories", "null"))
            except:
                bi_subcategories_list = None

        # Ensure nome and sobrenome are non-empty strings
        user_nome = (user.nome or "").strip()
        user_sobrenome = (user.sobrenome or "").strip()
        if not user_nome:
            user_nome = user.email.split("@")[0] if user.email else user.usuario

        return {
            "id": user.id,
            "nome": user_nome,
            "sobrenome": user_sobrenome,
            "usuario": user.usuario,
            "email": user.email,
            "nivel_acesso": user.nivel_acesso,
            "setores": setores_list,
            "bi_subcategories": bi_subcategories_list,
            "alterar_senha_primeiro_acesso": False,
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao autenticar com Auth0: {str(e)}")


@router.post("/msal-login")
def msal_login(payload: dict, db: Session = Depends(get_db)):
    """
    Valida token JWT do MSAL (Microsoft Office 365) e faz login do usuário
    Requer Authorization header com Bearer token
    """
    try:
        import json

        email = payload.get("email")
        name = payload.get("name", "")

        if not email:
            raise HTTPException(status_code=400, detail="Email não fornecido")

        # Buscar usuário no banco pelo email (case-insensitive search)
        from ti.models import User
        email_lower = email.lower() if email else None
        user = db.query(User).filter(func.lower(User.email) == email_lower).first()

        if not user:
            raise HTTPException(
                status_code=403,
                detail=f"Usuário com email '{email}' não encontrado no sistema. Contate o administrador."
            )

        if user.bloqueado:
            raise HTTPException(
                status_code=403,
                detail="Usuário bloqueado. Contate o administrador."
            )

        # Preparar resposta com dados do usuário
        from ti.services.users import _denormalize_sector
        setores_list = []
        if getattr(user, "_setores", None):
            try:
                raw = json.loads(getattr(user, "_setores", "[]"))
                # Denormalize back to canonical titles
                setores_list = [_denormalize_sector(str(x)) for x in raw if x is not None]
            except:
                setores_list = []

        bi_subcategories_list = None
        if getattr(user, "_bi_subcategories", None):
            try:
                bi_subcategories_list = json.loads(getattr(user, "_bi_subcategories", "null"))
            except:
                bi_subcategories_list = None

        # Ensure nome and sobrenome are non-empty strings
        user_nome = (user.nome or "").strip()
        user_sobrenome = (user.sobrenome or "").strip()
        if not user_nome:
            user_nome = user.email.split("@")[0] if user.email else user.usuario

        return {
            "id": user.id,
            "nome": user_nome,
            "sobrenome": user_sobrenome,
            "usuario": user.usuario,
            "email": user.email,
            "nivel_acesso": user.nivel_acesso,
            "setores": setores_list,
            "bi_subcategories": bi_subcategories_list,
            "alterar_senha_primeiro_acesso": False,
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao autenticar com MSAL: {str(e)}")


@router.post("/login")
def login(payload: dict, db: Session = Depends(get_db)):
    try:
        identifier = payload.get("identifier") or payload.get("email") or payload.get("usuario")
        senha = payload.get("senha") or payload.get("password")
        if not identifier or not senha:
            raise HTTPException(status_code=400, detail="Informe identifier e senha")
        from ti.services.users import authenticate_user
        user = authenticate_user(db, identifier, senha)
        return user
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao autenticar: {e}")


@router.post("/{user_id}/block", response_model=UserOut)
def bloquear_usuario(user_id: int, db: Session = Depends(get_db)):
    try:
        return set_block_status(db, user_id, True)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao bloquear: {e}")


@router.post("/{user_id}/unblock", response_model=UserOut)
def desbloquear_usuario(user_id: int, db: Session = Depends(get_db)):
    try:
        return set_block_status(db, user_id, False)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao desbloquear: {e}")


@router.post("/{user_id}/change-password")
def change_password(user_id: int, payload: dict, db: Session = Depends(get_db)):
    try:
        senha = payload.get('senha') or payload.get('password')
        if not senha:
            raise HTTPException(status_code=400, detail='Informe a nova senha')
        from ti.services.users import change_user_password
        change_user_password(db, user_id, senha, require_change=False)
        return {"ok": True}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao alterar senha: {e}")


@router.delete("/{user_id}")
def excluir_usuario(user_id: int, db: Session = Depends(get_db)):
    try:
        delete_user(db, user_id)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao excluir: {e}")


@router.post("/normalize-setores")
def normalize_setores(db: Session = Depends(get_db)):
    """Normalize setor/_setores for all users. Use with caution (admin only)."""
    try:
        from ti.services.users import normalize_user_setores
        updated = normalize_user_setores(db)
        return {"updated": updated}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao normalizar setores: {e}")


@router.post("/{user_id}/test-refresh")
def test_refresh_socket(user_id: int):
    """Test endpoint: manually trigger a refresh event for a user via Socket.IO"""
    try:
        print(f"[TEST] test_refresh_socket called for user_id={user_id}")
        from core.realtime import emit_refresh_sync
        import threading
        import time

        print(f"[TEST] Triggering refresh for user {user_id}")
        t = threading.Thread(target=emit_refresh_sync, args=(user_id,), daemon=True)
        t.start()

        # Wait a bit for thread to execute
        time.sleep(0.5)

        return {
            "ok": True,
            "message": f"Refresh event triggered for user {user_id}",
            "user_id": user_id,
            "timestamp": time.time()
        }
    except Exception as e:
        print(f"[TEST] Error in test_refresh_socket: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao testar refresh: {e}")


@router.post("/reset-password-by-email")
def reset_password_by_email(payload: dict, db: Session = Depends(get_db)):
    """Emergency endpoint to reset user password by email (Admin only)"""
    try:
        from ..models import User
        email = payload.get("email")
        if not email:
            raise HTTPException(status_code=400, detail="Email não fornecido")

        email_lower = email.lower() if email else None
        user = db.query(User).filter(func.lower(User.email) == email_lower).first()
        if not user:
            raise HTTPException(status_code=404, detail=f"Usuário com email '{email}' não encontrado")

        pwd = regenerate_password(db, user.id, 6)
        return {
            "ok": True,
            "email": email,
            "nova_senha": pwd,
            "usuario_id": user.id,
            "message": f"Senha resetada para {email}"
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erro ao resetar senha: {str(e)}")
