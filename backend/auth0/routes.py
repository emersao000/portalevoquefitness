print("\n\n" + "="*80)
print("[AUTH0-ROUTES] ⭐ STARTING IMPORT OF auth0/routes.py")
print("="*80 + "\n")

try:
    from fastapi import APIRouter, Depends, HTTPException, Request
    print("[AUTH0-ROUTES] ✅ FastAPI imports OK")

    from sqlalchemy.orm import Session
    from sqlalchemy import func
    print("[AUTH0-ROUTES] ✅ SQLAlchemy imports OK")

    from pydantic import BaseModel
    print("[AUTH0-ROUTES] ✅ Pydantic import OK")

    from core.db import get_db
    print("[AUTH0-ROUTES] ✅ core.db import OK")

    from auth0.validator import verify_auth0_token
    print("[AUTH0-ROUTES] ✅ auth0.validator import OK")

    from auth0.management import get_auth0_client
    print("[AUTH0-ROUTES] ✅ auth0.management import OK")

    from auth0.config import (
        AUTH0_DOMAIN,
        AUTH0_CLIENT_ID,
        AUTH0_CLIENT_SECRET,
        AUTH0_TOKEN_URL,
        AUTH0_AUDIENCE,
        AUTH0_REQUIRE_EMAIL_VERIFIED,
        AUTH0_M2M_CLIENT_ID,
        AUTH0_M2M_CLIENT_SECRET,
    )
    print("[AUTH0-ROUTES] ✅ auth0.config imports OK")

    from ti.models import User
    print("[AUTH0-ROUTES] ✅ ti.models import OK")

    from ti.services.session import SessionService
    print("[AUTH0-ROUTES] ✅ ti.services.session import OK")

    import json
    import traceback
    import requests
    print("[AUTH0-ROUTES] ✅ Standard library imports OK")

    router = APIRouter(prefix="/api/auth", tags=["auth"])
    print("[AUTH0-ROUTES] ✅ Router created successfully")
    print(f"[AUTH0-ROUTES] Router object: {router}")
    print(f"[AUTH0-ROUTES] Router prefix: /api/auth")
    print("\n[AUTH0-ROUTES] 🔧 Initializing Auth0 routes...")
    print(f"[AUTH0-ROUTES] Router prefix: /api/auth")

except Exception as e:
    print(f"\n\n[AUTH0-ROUTES] ❌ ERROR DURING IMPORT:")
    print(f"[AUTH0-ROUTES] Error type: {type(e).__name__}")
    print(f"[AUTH0-ROUTES] Error message: {str(e)}")
    print(f"[AUTH0-ROUTES] Full traceback:")
    import traceback as tb
    tb.print_exc()
    raise


# ✅ ROUTE 1: /users - MOVED TO BEGINNING WITH LOCAL IMPORTS
@router.get("/users")
def get_auth0_users(page: int = 0, per_page: int = 50, search: str = ""):
    """Get list of users from Auth0"""
    # Import locally to avoid circular import issues
    from auth0.management import get_auth0_client
    from auth0.config import AUTH0_M2M_CLIENT_ID, AUTH0_M2M_CLIENT_SECRET

    print(f"\n[AUTH0-USERS] ✓ Endpoint called")

    try:
        # Check if M2M credentials are configured
        if not AUTH0_M2M_CLIENT_ID or not AUTH0_M2M_CLIENT_SECRET:
            print(f"[AUTH0-USERS] ✗ M2M credentials not configured")
            raise HTTPException(
                status_code=503,
                detail="Auth0 M2M credentials not configured"
            )

        auth0_client = get_auth0_client()

        # Build query if search term provided
        query = None
        if search:
            query = f'email:"{search}*" OR name:"{search}*" OR given_name:"{search}*" OR family_name:"{search}*"'

        # Get users from Auth0
        result = auth0_client.get_users(
            page=page,
            per_page=per_page,
            query=query,
            sort="created_at:-1"
        )


        # Format response
        users = []
        for u in result.get("users", []):
            users.append({
                "user_id": u.get("user_id"),
                "email": u.get("email"),
                "name": u.get("name", ""),
                "given_name": u.get("given_name", ""),
                "family_name": u.get("family_name", ""),
                "email_verified": u.get("email_verified", False),
                "created_at": u.get("created_at"),
                "last_login": u.get("last_login"),
            })

        return {
            "users": users,
            "total": result.get("total", 0),
            "page": page,
            "per_page": per_page,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[AUTH0-USERS] ✗ Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.options("/auth0-exchange")
def auth0_exchange_options():
    """CORS preflight for auth0-exchange"""
    return {}


@router.post("/debug-test")
def debug_test_endpoint():
    """Simple test endpoint to verify routing works"""
    print(f"\n[DEBUG-TEST] Endpoint called successfully")
    return {
        "status": "ok",
        "message": "Auth0 routes are registered and responding",
        "timestamp": "test_successful"
    }


@router.options("/debug-test")
def debug_test_options():
    """CORS preflight for debug-test"""
    return {}


class Auth0ExchangeRequest(BaseModel):
    """Request model for Auth0 code exchange"""
    code: str
    redirect_uri: str


class Auth0LoginRequest(BaseModel):
    """Request model for Auth0 login"""
    token: str


class Auth0UserRequest(BaseModel):
    """Request model for getting Auth0 user"""
    token: str


@router.get("/debug/config")
def debug_config():
    """
    Debug endpoint to check Auth0 configuration (remove in production!)
    """
    return {
        "auth0_domain": AUTH0_DOMAIN,
        "auth0_audience": AUTH0_AUDIENCE,
        "auth0_client_id": AUTH0_CLIENT_ID[:10] + "..." if AUTH0_CLIENT_ID else "NOT SET",
        "auth0_client_secret_set": bool(AUTH0_CLIENT_SECRET),
        "auth0_token_url": AUTH0_TOKEN_URL,
    }


@router.post("/auth0-exchange")
def auth0_exchange(request: Auth0ExchangeRequest, db: Session = Depends(get_db)):
    """
    Exchange Auth0 authorization code for access token (backend does this for security)

    This endpoint:
    1. Exchanges the auth code from Auth0 for an access token
    2. Validates the token
    3. Checks if user exists in the database
    4. Returns user data and permissions

    Args:
        request: Auth0ExchangeRequest with code and redirect_uri
        db: Database session
    """

    try:
        print(f"\n[AUTH0-EXCHANGE] ✓ Endpoint called successfully")

        # Exchange code for token with Auth0 (done on backend for security)

        # ✅ CORREÇÃO: Construir payload com audience se configurado
        token_payload = {
            "client_id": AUTH0_CLIENT_ID,
            "client_secret": AUTH0_CLIENT_SECRET,
            "code": request.code,
            "grant_type": "authorization_code",
            "redirect_uri": request.redirect_uri,
        }

        # Adicionar audience apenas se estiver configurado
        if AUTH0_AUDIENCE:
            token_payload["audience"] = AUTH0_AUDIENCE

        token_response = requests.post(
            AUTH0_TOKEN_URL,
            json=token_payload,  # ✅ Usar payload com audience
            timeout=10,
        )


        if not token_response.ok:
            error_data = token_response.json()
            print(f"[AUTH0-EXCHANGE] ✗ Token exchange failed: {error_data}")
            raise HTTPException(
                status_code=400,
                detail=f"Auth0 token exchange failed: {error_data.get('error_description', 'Unknown error')}"
            )

        token_data = token_response.json()

        # ✅ CORREÇÃO PRINCIPAL: Usar id_token em vez de access_token
        access_token = token_data.get("access_token")
        id_token = token_data.get("id_token")  # ✅ ADICIONAR

        if not id_token:  # ✅ MUDAR PARA id_token
            print(f"[AUTH0-EXCHANGE] ✗ No id_token in response")
            raise HTTPException(
                status_code=400,
                detail="No id_token in response"
            )

        # Verificar id_token
        payload = verify_auth0_token(id_token)  # ✅ USAR id_token

        # Extract email from Auth0 namespaced claim or standard claim
        email = payload.get("email") or payload.get("https://yourapp.com/email")
        email_verified = payload.get("email_verified", False)
        auth0_user_id = payload.get("sub")


        if not email:
            print(f"[AUTH0-EXCHANGE] ✗ Email not found in token")
            raise HTTPException(
                status_code=400,
                detail="Email not found in token"
            )

        if AUTH0_REQUIRE_EMAIL_VERIFIED and not email_verified:
            print(f"[AUTH0-EXCHANGE] ✗ Email not verified in Auth0")
            raise HTTPException(
                status_code=403,
                detail="Email not verified. Please verify your email in Auth0 before accessing the system."
            )

        # Find user in database (case-insensitive search for email)
        email_lower = email.lower() if email else None
        user = db.query(User).filter(func.lower(User.email) == email_lower).first()

        if not user:
            print(f"[AUTH0-EXCHANGE] ✗ User not found in database")
            raise HTTPException(
                status_code=403,
                detail=f"User with email '{email}' not found in system. Contact administrator."
            )


        if getattr(user, "bloqueado", False):
            print(f"[AUTH0-EXCHANGE] ✗ User is blocked")
            raise HTTPException(
                status_code=403,
                detail="User is blocked. Contact administrator."
            )

        # Parse user sectors
        setores_list = []
        if getattr(user, "_setores", None):
            try:
                setores_list = json.loads(getattr(user, "_setores", "[]"))
            except Exception:
                setores_list = []

        # Parse BI subcategories
        bi_subcategories_list = None
        if getattr(user, "_bi_subcategories", None):
            try:
                bi_subcategories_list = json.loads(
                    getattr(user, "_bi_subcategories", "null")
                )
            except Exception:
                bi_subcategories_list = None


        # Ensure nome and sobrenome are never empty strings
        user_nome = (user.nome or "").strip()
        user_sobrenome = (user.sobrenome or "").strip()
        if not user_nome:
            user_nome = user.email.split("@")[0]

        # ✅ IMPORTANTE: Retornar access_token (para criar sessão) mas validar com id_token
        response = {
            "id": user.id,
            "nome": user_nome,
            "sobrenome": user_sobrenome,
            "email": user.email,
            "nivel_acesso": user.nivel_acesso,
            "setores": setores_list,
            "bi_subcategories": bi_subcategories_list,
            "access_token": access_token if access_token else id_token,  # ✅ Usar access_token se disponível
        }

        print(f"{'='*70}\n")

        return response

    except HTTPException as http_ex:
        print(f"\n[AUTH0-EXCHANGE] ❌ HTTPException raised")
        print(f"{'='*70}\n")
        raise
    except Exception as e:
        print(f"\n[AUTH0-EXCHANGE] ❌ UNEXPECTED ERROR")
        traceback.print_exc()
        print(f"{'='*70}\n")

        # Return 500 with detailed error
        raise HTTPException(
            status_code=500,
            detail=f"Backend error: {str(e)}"
        )


@router.post("/auth0-login")
def auth0_login(request: Auth0LoginRequest, db: Session = Depends(get_db)):
    """
    Validate Auth0 JWT token and authenticate user

    This endpoint:
    1. Validates the Auth0 JWT token
    2. Verifies email is confirmed in Auth0
    3. Checks if user exists in the database
    4. Returns user data and permissions

    Args:
        request: Auth0LoginRequest with token
        db: Database session
    """
    try:

        # Verify token
        payload = verify_auth0_token(request.token)

        # Get email from token (try both standard and namespaced claims)
        email = payload.get("email") or payload.get("https://yourapp.com/email")
        email_verified = payload.get("email_verified", False)
        auth0_user_id = payload.get("sub")


        if not email:
            print(f"[AUTH0-LOGIN] ✗ Email not found in token")
            raise HTTPException(
                status_code=400,
                detail="Email not found in token"
            )

        if AUTH0_REQUIRE_EMAIL_VERIFIED and not email_verified:
            print(f"[AUTH0-LOGIN] ✗ Email not verified in Auth0")
            raise HTTPException(
                status_code=403,
                detail="Email not verified. Please verify your email in Auth0 before accessing the system."
            )

        # Find user in database (case-insensitive search for email)
        email_lower = email.lower() if email else None
        user = db.query(User).filter(func.lower(User.email) == email_lower).first()

        if not user:
            print(f"[AUTH0-LOGIN] ✗ User not found in database")
            raise HTTPException(
                status_code=403,
                detail=f"User with email '{email}' not found in system. Contact administrator."
            )


        if getattr(user, "bloqueado", False):
            print(f"[AUTH0-LOGIN] ✗ User is blocked")
            raise HTTPException(
                status_code=403,
                detail="User is blocked. Contact administrator."
            )
        
        # Parse user sectors
        setores_list = []
        if getattr(user, "_setores", None):
            try:
                setores_list = json.loads(getattr(user, "_setores", "[]"))
            except Exception:
                setores_list = []

        # Parse BI subcategories
        bi_subcategories_list = None
        if getattr(user, "_bi_subcategories", None):
            try:
                bi_subcategories_list = json.loads(
                    getattr(user, "_bi_subcategories", "null")
                )
            except Exception:
                bi_subcategories_list = None

        # Ensure nome and sobrenome are never empty strings
        user_nome = (user.nome or "").strip()
        user_sobrenome = (user.sobrenome or "").strip()
        if not user_nome:
            user_nome = user.email.split("@")[0]

        response = {
            "id": user.id,
            "nome": user_nome,
            "sobrenome": user_sobrenome,
            "email": user.email,
            "nivel_acesso": user.nivel_acesso,
            "setores": setores_list,
            "bi_subcategories": bi_subcategories_list,
        }

        print(f"{'='*60}\n")

        return response

    except HTTPException:
        raise
    except Exception as e:
        print(f"\n[AUTH0-LOGIN] ✗ Unexpected error: {str(e)}")
        traceback.print_exc()
        print(f"{'='*60}\n")
        raise HTTPException(
            status_code=500,
            detail=f"Authentication error: {str(e)}"
        )


@router.post("/auth0-user")
def get_auth0_user(request: Auth0UserRequest, db: Session = Depends(get_db)):
    """
    Get current authenticated user information

    Args:
        request: Auth0UserRequest with token
        db: Database session
    """
    try:

        # Verify token
        payload = verify_auth0_token(request.token)

        email = payload.get("email") or payload.get("https://yourapp.com/email")
        email_verified = payload.get("email_verified", False)
        auth0_user_id = payload.get("sub")


        if not email:
            print(f"[AUTH0-USER] ✗ Email not found in token")
            raise HTTPException(
                status_code=400,
                detail="Email not found in token"
            )

        if AUTH0_REQUIRE_EMAIL_VERIFIED and not email_verified:
            print(f"[AUTH0-USER] ✗ Email not verified in Auth0")
            raise HTTPException(
                status_code=403,
                detail="Email not verified. Please verify your email in Auth0 before accessing the system."
            )

        # Find user (case-insensitive search for email)
        email_lower = email.lower() if email else None
        user = db.query(User).filter(func.lower(User.email) == email_lower).first()

        if not user:
            print(f"[AUTH0-USER] ✗ User not found in database")
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )

        # Ensure nome and sobrenome are never empty strings
        user_nome = (user.nome or "").strip()
        user_sobrenome = (user.sobrenome or "").strip()
        if not user_nome:
            user_nome = user.email.split("@")[0]


        # Parse sectors
        setores_list = []
        if getattr(user, "_setores", None):
            try:
                setores_list = json.loads(getattr(user, "_setores", "[]"))
            except Exception:
                setores_list = []

        response = {
            "id": user.id,
            "nome": user_nome,
            "sobrenome": user_sobrenome,
            "email": user.email,
            "nivel_acesso": user.nivel_acesso,
            "setores": setores_list,
        }

        print(f"{'='*60}\n")

        return response

    except HTTPException:
        raise
    except Exception as e:
        print(f"\n[AUTH0-USER] ✗ Unexpected error: {str(e)}")
        traceback.print_exc()
        print(f"{'='*60}\n")
        raise HTTPException(
            status_code=500,
            detail="Error retrieving user"
        )


class CreateSessionRequest(BaseModel):
    """Request model for creating a session"""
    user_id: int
    access_token: str
    expires_in: int = 86400  # 24 hours


class SessionValidationRequest(BaseModel):
    """Request model for validating a session"""
    session_token: str


class RevokeSessionRequest(BaseModel):
    """Request model for revoking a session"""
    session_token: str


@router.post("/session/create")
def create_session(
    request: CreateSessionRequest,
    http_request: Request,
    db: Session = Depends(get_db),
):
    """
    Create a new session in the database

    This endpoint:
    1. Creates a new session record in the database
    2. Stores the JWT token reference
    3. Returns the session token for the client

    Args:
        request: CreateSessionRequest with user_id and access_token
        http_request: HTTP request to extract IP and User-Agent
        db: Database session
    """
    try:

        # Extract client IP
        ip_address = http_request.client.host if http_request.client else None
        user_agent = http_request.headers.get("user-agent", None)


        # Create session in database
        session = SessionService.create_session(
            db=db,
            user_id=request.user_id,
            access_token=request.access_token,
            expires_in=request.expires_in,
            ip_address=ip_address,
            user_agent=user_agent,
        )


        response = {
            "session_id": session.id,
            "session_token": session.session_token,
            "expires_at": session.access_token_expires_at.isoformat(),
        }

        print(f"{'='*60}\n")

        return response

    except Exception as e:
        print(f"\n[SESSION-CREATE] ✗ Unexpected error: {str(e)}")
        traceback.print_exc()
        print(f"{'='*60}\n")
        raise HTTPException(
            status_code=500,
            detail=f"Error creating session: {str(e)}"
        )


@router.post("/session/validate")
def validate_session(
    request: SessionValidationRequest,
    db: Session = Depends(get_db),
):
    """
    Validate if a session is active and not expired

    Args:
        request: SessionValidationRequest with session_token
        db: Database session
    """
    try:

        is_valid = SessionService.validate_session(db, request.session_token)

        print(f"{'='*60}\n")

        return {
            "is_valid": is_valid,
            "message": "Session is active" if is_valid else "Session is invalid or expired",
        }

    except Exception as e:
        print(f"\n[SESSION-VALIDATE] ✗ Unexpected error: {str(e)}")
        traceback.print_exc()
        print(f"{'='*60}\n")
        raise HTTPException(
            status_code=500,
            detail=f"Error validating session: {str(e)}"
        )


class RenewSessionRequest(BaseModel):
    """Request model for renewing a session"""
    session_token: str


@router.post("/session/renew")
def renew_session(
    request: RenewSessionRequest,
    db: Session = Depends(get_db),
):
    """
    Renew (extend) an existing active session for 3 more days.
    Called automatically by the frontend to keep the user logged in.
    """
    try:
        session = SessionService.renew_session(db, request.session_token)

        if not session:
            return {"success": False, "message": "Session not found or expired"}

        return {
            "success": True,
            "expires_at": session.access_token_expires_at.isoformat(),
        }

    except Exception as e:
        print(f"\n[SESSION-RENEW] ✗ Unexpected error: {str(e)}")
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Error renewing session: {str(e)}"
        )


@router.post("/session/revoke")
def revoke_session(
    request: RevokeSessionRequest,
    db: Session = Depends(get_db),
):
    """
    Revoke a session

    Args:
        request: RevokeSessionRequest with session_token
        db: Database session
    """
    try:

        success = SessionService.revoke_session(db, request.session_token)

        print(f"{'='*60}\n")

        return {
            "success": success,
            "message": "Session revoked" if success else "Session not found",
        }

    except Exception as e:
        print(f"\n[SESSION-REVOKE] ✗ Unexpected error: {str(e)}")
        traceback.print_exc()
        print(f"{'='*60}\n")
        raise HTTPException(
            status_code=500,
            detail=f"Error revoking session: {str(e)}"
        )


@router.post("/session/revoke-all")
def revoke_all_sessions(
    request: BaseModel,
    db: Session = Depends(get_db),
):
    """
    Revoke all sessions for a user

    Request body should contain:
    {
        "user_id": <int>
    }
    """
    try:
        print(f"[SESSION-REVOKE-ALL] ✓ Endpoint called")

        user_id = getattr(request, "user_id", None)
        if not user_id:
            raise ValueError("user_id is required")

        print(f"[SESSION-REVOKE-ALL] User ID: {user_id}")

        count = SessionService.revoke_all_user_sessions(db, user_id)

        print(f"[SESSION-REVOKE-ALL] Revoked {count} sessions")
        print(f"{'='*60}\n")

        return {
            "success": True,
            "revoked_count": count,
            "message": f"Revoked {count} session(s)",
        }

    except Exception as e:
        print(f"\n[SESSION-REVOKE-ALL] ✗ Unexpected error: {str(e)}")
        print(f"[SESSION-REVOKE-ALL] Error type: {type(e).__name__}")
        traceback.print_exc()
        print(f"{'='*60}\n")
        raise HTTPException(
            status_code=500,
            detail=f"Error revoking sessions: {str(e)}"
        )


# ✅ CONFIRM ALL ROUTES WERE REGISTERED
print("\n" + "="*80)
print("[AUTH0-ROUTES] ✅ ALL ROUTES SUCCESSFULLY REGISTERED!")
print(f"[AUTH0-ROUTES] Total routes in router: {len(router.routes)}")
for i, route in enumerate(router.routes, 1):
    if hasattr(route, 'path') and hasattr(route, 'methods'):
        print(f"[AUTH0-ROUTES] Route {i}: {' '.join(route.methods or ['GET'])} {route.path}")
print("="*80 + "\n")
