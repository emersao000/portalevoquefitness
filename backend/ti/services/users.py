from __future__ import annotations
import json
import os
import secrets
import string
import unicodedata
from sqlalchemy.orm import Session
from werkzeug.security import generate_password_hash
from ti.models import User
from core.db import engine
from core.utils import now_brazil_naive
from ti.schemas.user import UserCreate, UserCreatedOut, UserAvailability
from auth0.management import get_auth0_client


def _generate_password(length: int = 12) -> str:
    """
    Gera senha forte que atende aos requisitos do Auth0:
    - Mínimo 8 caracteres
    - Maiúsculas, minúsculas, números e caracteres especiais
    """
    # Garantir tamanho mínimo de 8 para Auth0
    if length < 8:
        length = 8

    # Caracteres especiais que Auth0 aceita
    special_chars = "!@#$%^&*"

    # Garantir pelo menos um de cada tipo necessário
    parts = [
        secrets.choice(string.ascii_lowercase),      # minúscula
        secrets.choice(string.ascii_uppercase),      # maiúscula
        secrets.choice(string.digits),               # número
        secrets.choice(special_chars),               # caractere especial
    ]

    # Preencher o resto com uma mistura
    remaining = length - 4
    pool = string.ascii_letters + string.digits + special_chars
    parts += [secrets.choice(pool) for _ in range(remaining)]

    # Embaralhar para não deixar padrão previsível
    for i in range(len(parts) - 1, 0, -1):
        j = ord(secrets.token_bytes(1)) % (i + 1)
        parts[i], parts[j] = parts[j], parts[i]

    return "".join(parts)


def check_user_availability(db: Session, email: str | None = None, username: str | None = None) -> UserAvailability:
    try:
        User.__table__.create(bind=engine, checkfirst=True)
    except Exception:
        pass
    from sqlalchemy import func
    availability = UserAvailability()
    if email is not None:
        # Email check is case-insensitive
        availability.email_exists = db.query(User).filter(func.lower(User.email) == email.lower()).first() is not None
    if username is not None:
        availability.usuario_exists = db.query(User).filter(User.usuario == username).first() is not None
    return availability


def generate_password(length: int = 6) -> str:
    return _generate_password(length)


def criar_usuario(db: Session, payload: UserCreate) -> UserCreatedOut:
    try:
        User.__table__.create(bind=engine, checkfirst=True)
    except Exception:
        pass
    # Uniqueness checks (email is case-insensitive)
    from sqlalchemy import func
    if payload.email and db.query(User).filter(func.lower(User.email) == str(payload.email).lower()).first():
        raise ValueError("E-mail já cadastrado")
    if payload.usuario and db.query(User).filter(User.usuario == payload.usuario).first():
        raise ValueError("Nome de usuário já cadastrado")

    # Password generation in backend if not provided (12 chars minimum for Auth0)
    generated_password = payload.senha or _generate_password(12)

    setores_json = None
    setor = None
    if payload.setores and len(payload.setores) > 0:
        normalized = [_normalize_str(str(s)) for s in payload.setores]
        setores_json = json.dumps(normalized)
        setor = normalized[0]

    bi_subcategories_json = None
    if payload.bi_subcategories is not None:
        # Array can be empty (no dashboards) or have items
        bi_subcategories_json = json.dumps(payload.bi_subcategories)

    auth0_user = None
    auth0_id = None
    auth0_error = None
    try:
        # Create user in Auth0
        print(f"\n[criar_usuario] 🔄 Starting Auth0 user creation...")
        print(f"[criar_usuario] Email: {payload.email}")
        print(f"[criar_usuario] Nome: {payload.nome}")
        print(f"[criar_usuario] Sobrenome: {payload.sobrenome}")
        print(f"[criar_usuario] Generated password length: {len(generated_password)}")

        auth0_client = get_auth0_client()
        print(f"[criar_usuario] ✓ Auth0 client obtained")

        auth0_user = auth0_client.create_user(
            email=str(payload.email),
            password=generated_password,
            given_name=payload.nome or "",
            family_name=payload.sobrenome or "",
            user_metadata={
                "nivel_acesso": payload.nivel_acesso,
                "usuario": payload.usuario,
            }
        )
        auth0_id = auth0_user.get("user_id")
        print(f"[criar_usuario] ✅ Auth0 user created successfully!")
        print(f"[criar_usuario] Auth0 ID: {auth0_id}")
        print(f"[criar_usuario] Response: {auth0_user}\n")
    except Exception as e:
        auth0_error = str(e)
        print(f"\n[criar_usuario] ❌ FAILED to create Auth0 user")
        print(f"[criar_usuario] Error type: {type(e).__name__}")
        print(f"[criar_usuario] Error message: {auth0_error}")

        # Try to extract more details from HTTPError response
        if hasattr(e, 'response'):
            try:
                error_detail = e.response.json()
                print(f"[criar_usuario] ❌ Auth0 Error Details:")
                print(f"    - statusCode: {error_detail.get('statusCode')}")
                print(f"    - error: {error_detail.get('error')}")
                print(f"    - error_description: {error_detail.get('error_description')}")
                print(f"    - message: {error_detail.get('message')}")
                auth0_error = error_detail.get('error_description') or error_detail.get('message') or auth0_error
            except Exception as parse_err:
                print(f"[criar_usuario] Could not parse error JSON: {parse_err}")

        import traceback
        print(f"[criar_usuario] Full traceback:")
        traceback.print_exc()
        print(f"[criar_usuario] ⚠️ Continuing with local user creation (graceful degradation)\n")
        # Continue with local user creation even if Auth0 fails
        # This allows graceful degradation

    novo = User(
        nome=payload.nome,
        sobrenome=payload.sobrenome,
        usuario=payload.usuario,
        email=str(payload.email),
        senha_hash=generate_password_hash(generated_password),
        alterar_senha_primeiro_acesso=payload.alterar_senha_primeiro_acesso,
        nivel_acesso=payload.nivel_acesso,
        setor=setor,
        _setores=setores_json,
        _bi_subcategories=bi_subcategories_json,
        bloqueado=payload.bloqueado,
        email_verified=False,
        auth0_id=auth0_id,
    )
    db.add(novo)
    db.commit()
    db.refresh(novo)

    # Ensure nome and sobrenome are non-empty strings
    user_nome = (novo.nome or "").strip()
    user_sobrenome = (novo.sobrenome or "").strip()
    if not user_nome:
        user_nome = novo.email.split("@")[0] if novo.email else novo.usuario

    # Parse setores from JSON string to list
    setores_list = None
    if novo._setores:
        try:
            raw = json.loads(novo._setores)
            setores_list = [_denormalize_sector(str(x)) if x is not None else "" for x in raw]
        except Exception:
            setores_list = None

    # Parse bi_subcategories from JSON string to list
    bi_subcategories_list = None
    if novo._bi_subcategories:
        try:
            bi_subcategories_list = json.loads(novo._bi_subcategories)
        except Exception:
            bi_subcategories_list = None

    return UserCreatedOut(
        id=novo.id,
        nome=user_nome,
        sobrenome=user_sobrenome,
        usuario=novo.usuario,
        email=novo.email,
        nivel_acesso=novo.nivel_acesso,
        setor=novo.setor,
        setores=setores_list,
        bi_subcategories=bi_subcategories_list,
        bloqueado=novo.bloqueado,
        senha=generated_password,
        auth0_id=auth0_id,
        auth0_created=auth0_id is not None,
    )


import unicodedata

# Canonical sector titles that must match the frontend's sectors.ts
# Supports both legacy ("TI") and current ("Portal de TI") naming conventions
SECTOR_CANONICAL_MAP = {
    # TI Sector - Legacy and current formats
    "ti": "Portal de TI",
    "portal de ti": "Portal de TI",
    "setor de ti": "Portal de TI",
    # Financial Sector
    "financeiro": "Portal Financeiro",
    "portal financeiro": "Portal Financeiro",
    "portal de financeiro": "Portal Financeiro",
    "setor financeiro": "Portal Financeiro",
    # Maintenance Sector
    "manutencao": "Portal de Manutenção",
    "manutençao": "Portal de Manutenção",
    "portal de manutencao": "Portal de Manutenção",
    "portal de manutençao": "Portal de Manutenção",
    "setor de manutencao": "Portal de Manutenção",
    # BI Sector
    "bi": "Portal de BI",
    "portal de bi": "Portal de BI",
    "portal bi": "Portal de BI",
    "setor de bi": "Portal de BI",
}

def _normalize_str(s: str) -> str:
    if not s:
        return s
    # Remove accents, normalize whitespace, and convert to lowercase
    nfkd = unicodedata.normalize('NFKD', s)
    only_ascii = ''.join([c for c in nfkd if not unicodedata.combining(c)])
    return only_ascii.replace('\u00a0', ' ').strip().lower()

def _denormalize_sector(normalized: str) -> str:
    """Convert normalized sector name back to canonical title.

    Example: 'portal de ti' -> 'Portal de TI'
    If not found in map, return the normalized version as-is.
    """
    if not normalized:
        return normalized
    canonical = SECTOR_CANONICAL_MAP.get(normalized.lower())
    return canonical if canonical else normalized


def _set_setores(user: User, setores):
    print(f"[_set_setores] Recebido: {setores} (tipo: {type(setores)})")
    if setores and isinstance(setores, list) and len(setores) > 0:
        print(f"[_set_setores] É uma lista não-vazia com {len(setores)} items")
        normalized = [_normalize_str(str(s)) for s in setores]
        print(f"[_set_setores] Normalizado: {normalized}")
        user._setores = json.dumps(normalized)
        user.setor = normalized[0] if normalized else None
        print(f"[_set_setores] Salvando: _setores={user._setores}, setor={user.setor}")
    elif setores and isinstance(setores, str):
        print(f"[_set_setores] É uma string única")
        normalized = _normalize_str(str(setores))
        user._setores = json.dumps([normalized])
        user.setor = normalized
        print(f"[_set_setores] Salvando: _setores={user._setores}, setor={user.setor}")
    else:
        print(f"[_set_setores] Setores vazio ou None - limpando")
        user._setores = None
        user.setor = None


def _set_bi_subcategories(user: User, bi_subcategories):
    print(f"[_set_bi_subcategories] Called with: {bi_subcategories}")
    print(f"[_set_bi_subcategories] Type: {type(bi_subcategories)}")
    print(f"[_set_bi_subcategories] Is array?: {isinstance(bi_subcategories, list)}")
    if isinstance(bi_subcategories, list):
        print(f"[_set_bi_subcategories] Array length: {len(bi_subcategories)}")
        if len(bi_subcategories) > 0:
            print(f"[_set_bi_subcategories] Array contents: {bi_subcategories}")

    if bi_subcategories and isinstance(bi_subcategories, list) and len(bi_subcategories) > 0:
        json_str = json.dumps(bi_subcategories)
        print(f"[_set_bi_subcategories] ✅ Setting _bi_subcategories to: {json_str}")
        user._bi_subcategories = json_str
    elif bi_subcategories is not None and isinstance(bi_subcategories, list) and len(bi_subcategories) == 0:
        # Explicit empty list means user has BI sector but no dashboards selected
        print(f"[_set_bi_subcategories] ⚠️  User has BI sector but empty dashboard list - storing empty array")
        user._bi_subcategories = json.dumps([])
    else:
        print(f"[_set_bi_subcategories] ⛔ Setting _bi_subcategories to None")
        user._bi_subcategories = None

    print(f"[_set_bi_subcategories] Final value in DB: {user._bi_subcategories}")




def update_user(db: Session, user_id: int, data: dict) -> User:
    try:
        User.__table__.create(bind=engine, checkfirst=True)
    except Exception:
        pass
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError("Usuário não encontrado")

    if "email" in data and data["email"] and data["email"].lower() != user.email.lower():
        from sqlalchemy import func
        if db.query(User).filter(func.lower(User.email) == str(data["email"]).lower()).first():
            raise ValueError("E-mail já cadastrado")
        user.email = str(data["email"])  # type: ignore
    if "usuario" in data and data["usuario"] and data["usuario"] != user.usuario:
        if db.query(User).filter(User.usuario == data["usuario"]).first():
            raise ValueError("Nome de usuário já cadastrado")
        user.usuario = data["usuario"]  # type: ignore

    if "nome" in data and data["nome"] is not None:
        user.nome = data["nome"]  # type: ignore
    if "sobrenome" in data and data["sobrenome"] is not None:
        user.sobrenome = data["sobrenome"]  # type: ignore
    if "nivel_acesso" in data and data["nivel_acesso"] is not None:
        user.nivel_acesso = data["nivel_acesso"]  # type: ignore
    if "alterar_senha_primeiro_acesso" in data and data["alterar_senha_primeiro_acesso"] is not None:
        user.alterar_senha_primeiro_acesso = bool(data["alterar_senha_primeiro_acesso"])  # type: ignore
    if "bloqueado" in data and data["bloqueado"] is not None:
        user.bloqueado = bool(data["bloqueado"])  # type: ignore
    if "setores" in data:
        _set_setores(user, data["setores"])  # type: ignore
    if "bi_subcategories" in data:
        _set_bi_subcategories(user, data["bi_subcategories"])  # type: ignore

    db.commit()
    db.refresh(user)
    return user


def regenerate_password(db: Session, user_id: int, length: int = 12) -> str:
    # Mínimo 12 caracteres para atender requisitos Auth0
    if length < 12:
        length = 12
    if length > 64:
        length = 64
    try:
        User.__table__.create(bind=engine, checkfirst=True)
    except Exception:
        pass
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError("Usuário não encontrado")
    new_pwd = _generate_password(length)
    user.senha_hash = generate_password_hash(new_pwd)
    user.alterar_senha_primeiro_acesso = True
    db.commit()
    return new_pwd


def set_block_status(db: Session, user_id: int, blocked: bool) -> User:
    try:
        User.__table__.create(bind=engine, checkfirst=True)
    except Exception:
        pass
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError("Usuário não encontrado")
    user.bloqueado = bool(blocked)
    if not blocked:
        user.tentativas_login = 0
        user.bloqueado_ate = None
    db.commit()
    db.refresh(user)
    return user


def delete_user(db: Session, user_id: int) -> None:
    try:
        User.__table__.create(bind=engine, checkfirst=True)
    except Exception:
        pass
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return
    db.delete(user)
    db.commit()


def list_blocked_users(db: Session) -> list[User]:
    try:
        User.__table__.create(bind=engine, checkfirst=True)
    except Exception:
        pass
    return db.query(User).filter(User.bloqueado == True).order_by(User.id.desc()).all()


def authenticate_user(db: Session, identifier: str, senha: str) -> dict:
    """Authenticate by email or usuario. Returns dict with user info on success."""
    try:
        User.__table__.create(bind=engine, checkfirst=True)
    except Exception:
        pass
    # Support both email and username; email lookup is case-insensitive
    from sqlalchemy import func
    user = None
    if "@" in identifier:  # Email address
        user = db.query(User).filter(func.lower(User.email) == identifier.lower()).first()
    if not user:  # Fallback to username search (case-sensitive for usernames)
        user = db.query(User).filter(User.usuario == identifier).first()
    from werkzeug.security import check_password_hash
    if not user:
        raise ValueError("Usuário não encontrado")
    if user.bloqueado:
        raise PermissionError("Usuário bloqueado")

    if not check_password_hash(user.senha_hash, senha):
        # increment attempts
        try:
            user.tentativas_login = (user.tentativas_login or 0) + 1
            max_attempts = int(os.getenv("MAX_LOGIN_ATTEMPTS", "5"))
            if user.tentativas_login >= max_attempts:
                user.bloqueado = True
            db.commit()
        except Exception:
            db.rollback()
        raise ValueError("Senha inválida")

    # Successful login: reset attempts and update ultimo_acesso
    try:
        user.tentativas_login = 0
        user.bloqueado = False
        user.ultimo_acesso = now_brazil_naive()
        db.commit()
    except Exception:
        db.rollback()

    # prepare setores list and denormalize to canonical titles
    setores_list: list[str] = []
    try:
        if user._setores:
            raw = json.loads(user._setores)
            setores_list = [ _denormalize_sector(str(s)) for s in raw if s is not None ]
        elif user.setor:
            setores_list = [ _denormalize_sector(str(user.setor)) ]
    except Exception:
        setores_list = [ _denormalize_sector(str(user.setor))] if user.setor else []

    # Debug log to help trace login+alterar_senha flow
    try:
        print(f"[AUTH] user={user.usuario} id={user.id} alterar_senha={bool(user.alterar_senha_primeiro_acesso)} setores={setores_list}")
    except Exception:
        pass

    # Prepare bi_subcategories list
    bi_subcategories_list = None
    try:
        if user._bi_subcategories:
            raw = json.loads(user._bi_subcategories)
            bi_subcategories_list = [str(x) if x is not None else "" for x in raw]
            print(f"[AUTH] bi_subcategories loaded: raw='{user._bi_subcategories}' parsed={bi_subcategories_list}")
        else:
            print(f"[AUTH] user._bi_subcategories is empty/null: {repr(user._bi_subcategories)}")
    except Exception as e:
        print(f"[AUTH] Error parsing bi_subcategories: {e}")
        bi_subcategories_list = None

    # Ensure nome and sobrenome are never empty strings
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
        "alterar_senha_primeiro_acesso": bool(user.alterar_senha_primeiro_acesso),
        "session_revoked_at": user.session_revoked_at.isoformat() if getattr(user, 'session_revoked_at', None) else None,
    }

# Migration script to normalize setores in DB
def normalize_user_setores(db: Session) -> int:
    """Normalize setor and _setores for all users. Returns number of updated users."""
    updated = 0
    try:
        users = db.query(User).all()
        for u in users:
            changed = False
            # normalize single setor
            if u.setor:
                norm = _normalize_str(u.setor)
                if norm != (u.setor or ""):
                    u.setor = norm
                    changed = True
            # normalize _setores JSON
            if u._setores:
                try:
                    arr = json.loads(u._setores)
                    norm_arr = [ _normalize_str(str(s)) for s in arr ]
                    if json.dumps(norm_arr, ensure_ascii=False) != u._setores:
                        u._setores = json.dumps(norm_arr, ensure_ascii=False)
                        changed = True
                except Exception:
                    # try to coerce single string
                    try:
                        norm = _normalize_str(str(u._setores))
                        u._setores = json.dumps([norm], ensure_ascii=False)
                        changed = True
                    except Exception:
                        pass
            if changed:
                db.add(u)
                updated += 1
        if updated:
            db.commit()
    except Exception as e:
        try:
            db.rollback()
        except:
            pass
        raise
    return updated


def change_user_password(db: Session, user_id: int, new_password: str, require_change: bool = False) -> None:
    try:
        User.__table__.create(bind=engine, checkfirst=True)
    except Exception:
        pass
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError("Usuário não encontrado")
    user.senha_hash = generate_password_hash(new_password)
    user.alterar_senha_primeiro_acesso = bool(require_change)
    db.commit()
