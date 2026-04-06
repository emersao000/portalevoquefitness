import requests
from functools import lru_cache
from jose import jwt, JWTError, jwk
from cryptography import x509
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization
import base64
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .config import (
    AUTH0_DOMAIN,
    AUTH0_AUDIENCE,
    AUTH0_ISSUER,
    AUTH0_JWKS_URL,
    AUTH0_CLIENT_ID,
)

security = HTTPBearer()


@lru_cache(maxsize=1)
def get_jwks():
    """Fetch and cache JSON Web Key Set from Auth0"""
    try:
        response = requests.get(AUTH0_JWKS_URL, timeout=5)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"❌ Error fetching JWKS from Auth0: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch Auth0 public keys"
        )


def get_signing_key(kid: str) -> dict:
    """Get the signing key from JWKS by key ID"""
    jwks = get_jwks()
    
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            return key
    
    raise HTTPException(
        status_code=401,
        detail="Unable to find a signing key that matches"
    )


def verify_auth0_token(token: str) -> dict:
    """
    Verify and decode Auth0 JWT token

    Args:
        token: The JWT token from Authorization header

    Returns:
        dict: Decoded token payload

    Raises:
        HTTPException: If token is invalid
    """
    try:
        print(f"\n[JWT-VALIDATOR] Starting JWT verification...")
        print(f"[JWT-VALIDATOR] Token length: {len(token)}")
        print(f"[JWT-VALIDATOR] Token (first 50 chars): {token[:50]}...")

        # Get the unverified header to extract the key ID
        print(f"[JWT-VALIDATOR] Extracting unverified header...")
        unverified_header = jwt.get_unverified_header(token)
        print(f"[JWT-VALIDATOR] Unverified header: {unverified_header}")

        if "kid" not in unverified_header:
            print(f"[JWT-VALIDATOR] ❌ 'kid' not found in header")
            raise HTTPException(
                status_code=401,
                detail="Invalid token header"
            )

        # Get the signing key
        print(f"[JWT-VALIDATOR] Fetching signing key with kid: {unverified_header['kid']}")
        signing_key_dict = get_signing_key(unverified_header["kid"])
        print(f"[JWT-VALIDATOR] ✓ Signing key obtained")
        print(f"[JWT-VALIDATOR] Signing key data: {signing_key_dict.get('kty')}, kid={signing_key_dict.get('kid')}")

        # Build the key for verification using X.509 certificate
        print(f"[JWT-VALIDATOR] Converting JWK to RSA key...")
        try:
            # Try to extract public key from X.509 certificate (x5c[0])
            if "x5c" in signing_key_dict and signing_key_dict["x5c"]:
                cert_data = base64.b64decode(signing_key_dict["x5c"][0])
                cert = x509.load_der_x509_certificate(cert_data, default_backend())
                public_key = cert.public_key()
                # Convert to PEM format for python-jose
                key = public_key.public_bytes(
                    encoding=serialization.Encoding.PEM,
                    format=serialization.PublicFormat.SubjectPublicKeyInfo
                )
                print(f"[JWT-VALIDATOR] ✓ RSA key extracted from X.509 certificate")
            else:
                # Fallback: try to construct from JWK
                key = jwk.construct(signing_key_dict, 'RSA')
                print(f"[JWT-VALIDATOR] ✓ RSA key created successfully from JWK")
        except Exception as e:
            print(f"[JWT-VALIDATOR] ❌ Failed to construct RSA key: {str(e)}")
            raise HTTPException(
                status_code=401,
                detail="Failed to construct RSA key from JWK"
            )

        # ✅ CORREÇÃO: Tentar validar com Client ID primeiro (id_token), depois com API audience (access_token)
        print(f"[JWT-VALIDATOR] Attempting token verification...")
        print(f"[JWT-VALIDATOR]   - algorithms: RS256")
        print(f"[JWT-VALIDATOR]   - issuer: {AUTH0_ISSUER}")
        
        payload = None
        validation_error = None

        # Primeiro, tenta validar como id_token (audience = Client ID)
        try:
            print(f"[JWT-VALIDATOR] Trying validation as id_token (audience = Client ID)...")
            print(f"[JWT-VALIDATOR]   - audience: {AUTH0_CLIENT_ID}")
            
            payload = jwt.decode(
                token,
                key,
                algorithms=["RS256"],
                audience=AUTH0_CLIENT_ID,
                issuer=AUTH0_ISSUER,
                options={
                    "verify_signature": True,
                    "verify_aud": True,
                    "verify_iss": True,
                }
            )
            print(f"[JWT-VALIDATOR] ✓ Token validated as id_token (Client ID audience)")
        
        except JWTError as e:
            # Se falhar, guardar erro e tentar com API audience
            validation_error = e
            print(f"[JWT-VALIDATOR] ⚠️  id_token validation failed: {str(e)}")
            print(f"[JWT-VALIDATOR] Trying validation as access_token (audience = API audience)...")
            print(f"[JWT-VALIDATOR]   - audience: {AUTH0_AUDIENCE}")
            
            try:
                payload = jwt.decode(
                    token,
                    key,
                    algorithms=["RS256"],
                    audience=AUTH0_AUDIENCE,
                    issuer=AUTH0_ISSUER,
                    options={
                        "verify_signature": True,
                        "verify_aud": True,
                        "verify_iss": True,
                    }
                )
                print(f"[JWT-VALIDATOR] ✓ Token validated as access_token (API audience)")
            
            except JWTError as e2:
                # Se ambos falharem, lançar erro
                print(f"[JWT-VALIDATOR] ❌ access_token validation also failed: {str(e2)}")
                print(f"[JWT-VALIDATOR] ❌ Token validation failed with both audiences")
                raise validation_error  # Lançar o erro original

        if not payload:
            print(f"[JWT-VALIDATOR] ❌ No payload extracted from token")
            raise HTTPException(
                status_code=401,
                detail="Token verification failed"
            )

        print(f"[JWT-VALIDATOR] ✓ Token verified successfully!")
        print(f"[JWT-VALIDATOR] Payload keys: {list(payload.keys())}")
        print(f"[JWT-VALIDATOR] Email: {payload.get('email', 'NOT FOUND')}")
        print(f"[JWT-VALIDATOR] Email verified: {payload.get('email_verified', 'NOT FOUND')}")
        print(f"[JWT-VALIDATOR] Subject (sub): {payload.get('sub', 'NOT FOUND')}")
        print(f"[JWT-VALIDATOR] Audience (aud): {payload.get('aud', 'NOT FOUND')}")

        return payload

    except JWTError as e:
        # Catch all JWT errors including claims validation
        error_msg = str(e).lower()
        print(f"\n[JWT-VALIDATOR] ❌ JWTError occurred")
        print(f"[JWT-VALIDATOR] Error type: {type(e).__name__}")
        print(f"[JWT-VALIDATOR] Error message: {str(e)}")

        if "claims" in error_msg or "aud" in error_msg or "iss" in error_msg:
            print(f"[JWT-VALIDATOR] ❌ Token claims validation failed")
            raise HTTPException(
                status_code=401,
                detail="Invalid token claims"
            )
        else:
            print(f"[JWT-VALIDATOR] ❌ JWT validation failed")
            raise HTTPException(
                status_code=401,
                detail="Invalid token"
            )
    except Exception as e:
        print(f"\n[JWT-VALIDATOR] ❌ Unexpected error during token verification")
        print(f"[JWT-VALIDATOR] Error type: {type(e).__name__}")
        print(f"[JWT-VALIDATOR] Error message: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=401,
            detail="Token verification failed"
        )


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """
    Dependency to verify Auth0 token in protected routes
    
    Usage:
        @app.get("/protected")
        async def protected_route(user: dict = Depends(get_current_user)):
            return {"user": user}
    """
    token = credentials.credentials
    return verify_auth0_token(token)
