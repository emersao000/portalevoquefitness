import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Auth0 Configuration
# ✅ CORRIGIDO: Usar o tenant de PRODUÇÃO por padrão
AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN", "evoqueacademia-prd.us.auth0.com")  # ← CORRIGIDO
AUTH0_AUDIENCE = os.getenv("AUTH0_AUDIENCE", "https://erp-api.evoquefitness.com.br")
AUTH0_CLIENT_ID = os.getenv("AUTH0_CLIENT_ID", "")
AUTH0_CLIENT_SECRET = os.getenv("AUTH0_CLIENT_SECRET", "")
AUTH0_REQUIRE_EMAIL_VERIFIED = os.getenv("AUTH0_REQUIRE_EMAIL_VERIFIED", "False").lower() in ("true", "1", "yes")

# Generate dynamic AUTH0_CALLBACK_URL based on frontend URL
_frontend_url = os.getenv("FRONTEND_URL", "").strip()
_production_domain = os.getenv("PRODUCTION_DOMAIN", "").strip()

if _frontend_url:
    AUTH0_CALLBACK_URL = f"{_frontend_url}/auth/callback"
elif _production_domain:
    AUTH0_CALLBACK_URL = f"https://{_production_domain}/auth/callback"
else:
    # ✅ CORRIGIDO: Usar a porta 3005 (padrão do Vite) como fallback
    AUTH0_CALLBACK_URL = os.getenv("AUTH0_CALLBACK_URL", "http://localhost:3005/auth/callback")

# Machine-to-Machine (M2M) Credentials for Management API
AUTH0_M2M_CLIENT_ID = os.getenv("AUTH0_M2M_CLIENT_ID", "")
AUTH0_M2M_CLIENT_SECRET = os.getenv("AUTH0_M2M_CLIENT_SECRET", "")

# Auth0 URLs
AUTH0_ISSUER = f"https://{AUTH0_DOMAIN}/"
AUTH0_JWKS_URL = f"https://{AUTH0_DOMAIN}/.well-known/jwks.json"
AUTH0_TOKEN_URL = f"https://{AUTH0_DOMAIN}/oauth/token"
AUTH0_MANAGEMENT_API_URL = f"https://{AUTH0_DOMAIN}/api/v2/"

# Validate configuration
print(f"\n[AUTH0-CONFIG] 🔧 Auth0 Configuration Loaded:")
print(f"[AUTH0-CONFIG] Domain: {AUTH0_DOMAIN}")
print(f"[AUTH0-CONFIG] Audience: {AUTH0_AUDIENCE}")
print(f"[AUTH0-CONFIG] Callback URL: {AUTH0_CALLBACK_URL}")
print(f"[AUTH0-CONFIG] Client ID: {AUTH0_CLIENT_ID[:20] + '...' if AUTH0_CLIENT_ID else '❌ NOT SET'}")
print(f"[AUTH0-CONFIG] Client Secret: {'✓ SET' if AUTH0_CLIENT_SECRET else '❌ NOT SET'}")
print(f"[AUTH0-CONFIG] M2M Client ID: {'✓ SET' if AUTH0_M2M_CLIENT_ID else '❌ NOT SET'}")
print(f"[AUTH0-CONFIG] M2M Secret: {'✓ SET' if AUTH0_M2M_CLIENT_SECRET else '❌ NOT SET'}")
print(f"[AUTH0-CONFIG] Require Email Verified: {AUTH0_REQUIRE_EMAIL_VERIFIED}")
print(f"[AUTH0-CONFIG] Token URL: {AUTH0_TOKEN_URL}")
print(f"[AUTH0-CONFIG] JWKS URL: {AUTH0_JWKS_URL}\n")

# ✅ VALIDAÇÃO ADICIONAL: Verificar se as configurações essenciais estão presentes
if not AUTH0_CLIENT_ID or not AUTH0_CLIENT_SECRET:
    print("❌ ERROR: AUTH0_CLIENT_ID and AUTH0_CLIENT_SECRET are required!")
    print("❌ Please set them in your .env file")

if not AUTH0_M2M_CLIENT_ID or not AUTH0_M2M_CLIENT_SECRET:
    print("❌ ERROR: Auth0 M2M credentials NOT configured!")
    print("❌ These are REQUIRED for user creation to work!")
    print("❌ Please add to your .env file:")
    print("   AUTH0_M2M_CLIENT_ID=<your_m2m_client_id>")
    print("   AUTH0_M2M_CLIENT_SECRET=<your_m2m_client_secret>")
    print("❌ Get them from: Auth0 Dashboard → Applications → Machine to Machine Applications")
else:
    print("✅ Auth0 M2M credentials are configured")

# ✅ VALIDAÇÃO: Verificar se está usando o tenant correto
if AUTH0_DOMAIN == "evoqueacademia.us.auth0.com":
    print("⚠️  WARNING: Using OLD tenant 'evoqueacademia.us.auth0.com'")
    print("⚠️  For SSO to work, you should use 'evoqueacademia-prd.us.auth0.com'")
    print("⚠️  Set AUTH0_DOMAIN=evoqueacademia-prd.us.auth0.com in your .env file\n")
elif AUTH0_DOMAIN == "evoqueacademia-prd.us.auth0.com":
    print("✅ Using PRODUCTION tenant - SSO will work correctly\n")
