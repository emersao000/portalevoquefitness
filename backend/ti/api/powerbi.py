from __future__ import annotations
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from core.db import get_db
from ti.models.powerbi_dashboard import PowerBIDashboard
from ti.schemas.powerbi_dashboard import PowerBIDashboardOut, PowerBIDashboardCreate, PowerBIDashboardUpdate
import httpx
import os
import asyncio
import html
import time
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/powerbi", tags=["Power BI"])

# ============================================
# TOKEN CACHE (para evitar rate limiting)
# ============================================
class TokenCache:
    def __init__(self):
        self.token = None
        self.expires_at = 0
        self.lock = asyncio.Lock()

    async def get_token(self, get_token_func):
        """Get cached token or fetch new one"""
        current_time = time.time()

        # Se token ainda é válido (com 30s de margem), retorna o cached
        if self.token and current_time < (self.expires_at - 30):
            print(f"[POWERBI] ✅ Usando token em cache (expira em {int(self.expires_at - current_time)}s)")
            return self.token

        async with self.lock:
            # Double-check dentro do lock
            if self.token and current_time < (self.expires_at - 30):
                return self.token

            print(f"[POWERBI] 🔄 Obtendo novo token...")
            token_data = await get_token_func()

            self.token = token_data.get("access_token")
            expires_in = token_data.get("expires_in", 3600)
            self.expires_at = current_time + expires_in

            print(f"[POWERBI] ✅ Novo token obtido (válido por {expires_in}s)")
            return self.token

    def clear(self):
        """Clear cached token"""
        self.token = None
        self.expires_at = 0

token_cache = TokenCache()

# ============================================
# POWER BI CONFIGURATION
# ============================================

POWERBI_CLIENT_ID = os.getenv("POWERBI_CLIENT_ID", "").strip()
POWERBI_CLIENT_SECRET = os.getenv("POWERBI_CLIENT_SECRET", "").strip()
POWERBI_TENANT_ID = os.getenv("POWERBI_TENANT_ID", "").strip()
POWERBI_WORKSPACE_ID = os.getenv("POWERBI_WORKSPACE_ID", "").strip()
POWERBI_OBJECT_ID = os.getenv("POWERBI_OBJECT_ID", "").strip()
POWERBI_DISPLAY_NAME = os.getenv("POWERBI_DISPLAY_NAME", "Portal de BI 2")

# Validação - PowerBI é opcional
POWERBI_CONFIGURED = all([POWERBI_CLIENT_ID, POWERBI_CLIENT_SECRET, POWERBI_TENANT_ID, POWERBI_WORKSPACE_ID])

if not POWERBI_CONFIGURED:
    print("⚠️  WARNING: PowerBI não está configurado. Endpoints PowerBI retornarão erro 503.")

AUTHORITY_URL = f"https://login.microsoftonline.com/{POWERBI_TENANT_ID}"
TOKEN_ENDPOINT = f"{AUTHORITY_URL}/oauth2/v2.0/token"
POWERBI_API_URL = "https://api.powerbi.com/v1.0/myorg"

print(f"[POWERBI] ===== CONFIGURAÇÃO CARREGADA =====")
print(f"[POWERBI] CLIENT_ID: {POWERBI_CLIENT_ID[:20]}...")
print(f"[POWERBI] CLIENT_SECRET: {'✅ Configurado' if POWERBI_CLIENT_SECRET else '❌ Não configurado'} ({len(POWERBI_CLIENT_SECRET)} chars)")
print(f"[POWERBI] TENANT_ID: {POWERBI_TENANT_ID}")
print(f"[POWERBI] WORKSPACE_ID: {POWERBI_WORKSPACE_ID}")
print(f"[POWERBI] =====================================")


# ============================================
# AUTHENTICATION
# ============================================

async def _fetch_service_principal_token_from_azure() -> dict:
    """Fetch fresh token from Azure (internal use only)"""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                TOKEN_ENDPOINT,
                data={
                    "grant_type": "client_credentials",
                    "client_id": POWERBI_CLIENT_ID,
                    "client_secret": POWERBI_CLIENT_SECRET,
                    "scope": "https://analysis.windows.net/powerbi/api/.default",
                },
            )

            if response.status_code != 200:
                error_text = response.text
                print(f"[POWERBI] ❌ Erro de autenticação Azure: {error_text}")
                raise HTTPException(status_code=400, detail=f"Azure auth error: {error_text}")

            token_data = response.json()
            access_token = token_data.get("access_token")

            if not access_token:
                raise HTTPException(status_code=400, detail="No access token received from Azure")

            return token_data

    except httpx.RequestError as e:
        print(f"[POWERBI] ❌ Erro de rede ao obter token: {e}")
        raise HTTPException(status_code=400, detail=f"Network error: {str(e)}")


async def get_service_principal_token() -> str:
    """Get cached access token using service principal credentials"""
    try:
        token = await token_cache.get_token(_fetch_service_principal_token_from_azure)
        return token
    except HTTPException:
        raise
    except Exception as e:
        print(f"[POWERBI] ❌ Erro ao obter token: {e}")
        raise HTTPException(status_code=500, detail=f"Token retrieval error: {str(e)}")


# ============================================
# MAIN ENDPOINTS
# ============================================

@router.get("/token")
async def get_powerbi_token(db: Session = Depends(get_db)):
    """Get Power BI access token"""
    try:
        token = await get_service_principal_token()
        return {
            "access_token": token,
            "token_type": "Bearer",
            "display_name": POWERBI_DISPLAY_NAME,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/embed-token/{report_id}")
async def get_embed_token(
    report_id: str,
    datasetId: str = Query(None, alias="datasetId"),
    db: Session = Depends(get_db)
):
    """
    Generate an embed token for a specific Power BI report with Service Principal
    """
    print(f"\n[POWERBI] [EMBED-TOKEN] ========================================")
    print(f"[POWERBI] [EMBED-TOKEN] Report ID: {report_id}")
    if datasetId:
        print(f"[POWERBI] [EMBED-TOKEN] Dataset ID: {datasetId}")
    print(f"[POWERBI] [EMBED-TOKEN] Workspace ID: {POWERBI_WORKSPACE_ID}")

    try:
        # 1. Obter token de autenticação
        service_token = await get_service_principal_token()
        headers = {
            "Authorization": f"Bearer {service_token}",
            "Content-Type": "application/json"
        }

        # 2. Payload para embed com Service Principal
        payload = {
            "accessLevel": "View"
        }

        # Adicionar dataset se fornecido
        if datasetId:
            payload["datasets"] = [{"id": datasetId}]

        print(f"[POWERBI] [EMBED-TOKEN] Payload: {payload}")

        # 3. Fazer request para a API CORRETA (com workspace_id)
        token_url = f"{POWERBI_API_URL}/groups/{POWERBI_WORKSPACE_ID}/reports/{report_id}/GenerateToken"
        print(f"[POWERBI] [EMBED-TOKEN] Token URL: {token_url}")

        async with httpx.AsyncClient(timeout=60.0) as client:
            # 3a. Obter o embedUrl correto do relatório (CRÍTICO - é obrigatório)
            embed_url_value = None
            try:
                report_response = await client.get(
                    f"{POWERBI_API_URL}/groups/{POWERBI_WORKSPACE_ID}/reports/{report_id}",
                    headers=headers,
                    timeout=20.0,
                )

                if report_response.status_code == 200:
                    report_data = report_response.json()
                    embed_url_value = report_data.get("embedUrl")

                    if embed_url_value and isinstance(embed_url_value, str):
                        if embed_url_value.startswith("https://app.powerbi.com"):
                            print(f"[POWERBI] [EMBED-TOKEN] ✅ Embed URL válida obtida da API")
                        else:
                            print(f"[POWERBI] [EMBED-TOKEN] ⚠️ embedUrl com hostname inesperado: {embed_url_value[:80]}")
                            embed_url_value = None
                    else:
                        print(f"[POWERBI] [EMBED-TOKEN] ⚠️ embedUrl ausente ou inválida na resposta: {embed_url_value}")
                        embed_url_value = None
                elif report_response.status_code == 401:
                    print(f"[POWERBI] [EMBED-TOKEN] ❌ 401 Unauthorized - Service Principal sem acesso")
                    raise HTTPException(
                        status_code=401,
                        detail="Service Principal não tem permissão para ler relatório"
                    )
                elif report_response.status_code == 403:
                    print(f"[POWERBI] [EMBED-TOKEN] ❌ 403 Forbidden - Sem permissão")
                    raise HTTPException(
                        status_code=403,
                        detail="Service Principal não tem permissão para acessar este relatório"
                    )
                elif report_response.status_code == 404:
                    print(f"[POWERBI] [EMBED-TOKEN] ❌ 404 Not Found - Relatório {report_id} não encontrado")
                    raise HTTPException(
                        status_code=404,
                        detail=f"Relatório {report_id} não encontrado no workspace"
                    )
                else:
                    print(f"[POWERBI] [EMBED-TOKEN] ⚠️ Erro ao obter report: {report_response.status_code}")
                    print(f"[POWERBI] [EMBED-TOKEN] Response: {report_response.text[:200]}")

            except httpx.TimeoutException as e:
                print(f"[POWERBI] [EMBED-TOKEN] ⚠️ Timeout ao obter report details: {e}")
                embed_url_value = None
            except HTTPException:
                raise
            except Exception as e:
                print(f"[POWERBI] [EMBED-TOKEN] ⚠️ Erro ao obter embedUrl: {e}")
                embed_url_value = None

            # Se não conseguiu obter embedUrl, retornar erro
            if not embed_url_value:
                error_msg = f"Não conseguiu obter embedUrl para relatório {report_id}. Verifique se o Service Principal tem permissão de leitura no workspace."
                print(f"[POWERBI] [EMBED-TOKEN] ❌ ERRO CRÍTICO: {error_msg}")
                raise HTTPException(
                    status_code=500,
                    detail=error_msg
                )

            # 3b. Gerar o token (aumentado timeout para 60s porque api.powerbi.com pode ser lenta)
            try:
                response = await client.post(
                    token_url,
                    json=payload,
                    headers=headers,
                )
            except httpx.ReadTimeout:
                print(f"[POWERBI] [EMBED-TOKEN] ⚠️ Timeout na primeira tentativa, aguardando...")
                # Retry uma vez após esperar um pouco
                await asyncio.sleep(2)
                response = await client.post(
                    token_url,
                    json=payload,
                    headers=headers,
                )

            print(f"[POWERBI] [EMBED-TOKEN] Status: {response.status_code}")
            print(f"[POWERBI] [EMBED-TOKEN] Response: {response.text[:500]}")

            if response.status_code != 200:
                error_detail = response.text

                if response.status_code == 403:
                    print(f"\n[POWERBI] [EMBED-TOKEN] ❌ ERRO 403 - DIAGNÓSTICO:")
                    print(f"  1. Service Principal est�� no workspace como Membro/Admin?")
                    print(f"     → Workspace ID: {POWERBI_WORKSPACE_ID}")
                    print(f"  2. Report ID está correto?")
                    print(f"     → Report ID: {report_id}")
                elif response.status_code == 404:
                    print(f"\n[POWERBI] [EMBED-TOKEN] ❌ ERRO 404:")
                    print(f"  - Report {report_id} não encontrado no workspace {POWERBI_WORKSPACE_ID}")

                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"Power BI API error: {error_detail}"
                )

            # Extrair o token da resposta
            token_data = response.json()
            embed_token = token_data.get("token")

            if not embed_token:
                raise HTTPException(status_code=400, detail="No embed token received")

            print(f"[POWERBI] [EMBED-TOKEN] ✅ Token gerado com sucesso!")
            print(f"[POWERBI] [EMBED-TOKEN] ========================================\n")

            return {
                "token": embed_token,
                "tokenId": token_data.get("tokenId"),
                "expiration": token_data.get("expiration"),
                "report_id": report_id,
                "embedUrl": embed_url_value,
            }

    except HTTPException:
        raise
    except (httpx.ReadTimeout, httpx.TimeoutException):
        print(f"[POWERBI] [EMBED-TOKEN] ❌ Timeout ao conectar com Power BI API")
        raise HTTPException(
            status_code=504,
            detail="Timeout ao conectar com Power BI. A API pode estar lenta. Tente novamente."
        )
    except httpx.RequestError as e:
        print(f"[POWERBI] [EMBED-TOKEN] ❌ Erro de rede: {str(e)}")
        raise HTTPException(
            status_code=502,
            detail=f"Erro de conexão com Power BI: {str(e)}"
        )
    except Exception as e:
        print(f"[POWERBI] [EMBED-TOKEN] ��� Erro inesperado: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


@router.get("/dashboards")
async def get_powerbi_dashboards(db: Session = Depends(get_db)):
    """Get list of Power BI dashboards"""
    try:
        token = await get_service_principal_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{POWERBI_API_URL}/dashboards",
                headers=headers,
            )
            
            if response.status_code != 200:
                print(f"[POWERBI] Dashboards error: {response.text}")
                return {"value": []}
            
            return response.json()
    except Exception as e:
        print(f"[POWERBI] Error fetching dashboards: {e}")
        return {"value": []}


@router.get("/reports")
async def get_powerbi_reports(db: Session = Depends(get_db)):
    """Get list of Power BI reports"""
    try:
        token = await get_service_principal_token()
        headers = {"Authorization": f"Bearer {token}"}

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{POWERBI_API_URL}/reports",
                headers=headers,
            )

            if response.status_code != 200:
                print(f"[POWERBI] Reports error: {response.text}")
                return {"value": []}

            return response.json()
    except Exception as e:
        print(f"[POWERBI] Error fetching reports: {e}")
        return {"value": []}


# ============================================
# DATABASE DASHBOARDS ENDPOINTS
# ============================================

@router.get("/db/dashboards", response_model=list[PowerBIDashboardOut])
async def get_db_dashboards(db: Session = Depends(get_db)):
    """Get all dashboards from database (active only)"""
    try:
        dashboards = db.query(PowerBIDashboard)\
            .filter(PowerBIDashboard.ativo == True)\
            .order_by(PowerBIDashboard.category, PowerBIDashboard.order)\
            .all()

        print(f"[POWERBI] [DB] Encontrados {len(dashboards)} dashboards ativos")
        return dashboards
    except Exception as e:
        print(f"[POWERBI] [DB] Erro ao buscar dashboards: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao buscar dashboards: {str(e)}")


@router.get("/db/dashboards/by-id/{dashboard_id}", response_model=PowerBIDashboardOut)
async def get_db_dashboard_by_id(dashboard_id: str, db: Session = Depends(get_db)):
    """Get specific dashboard from database by dashboard_id"""
    try:
        dashboard = db.query(PowerBIDashboard)\
            .filter(PowerBIDashboard.dashboard_id == dashboard_id)\
            .filter(PowerBIDashboard.ativo == True)\
            .first()

        if not dashboard:
            raise HTTPException(
                status_code=404,
                detail=f"Dashboard '{dashboard_id}' not found"
            )

        print(f"[POWERBI] [DB] Dashboard encontrado: {dashboard.title}")
        return dashboard
    except HTTPException:
        raise
    except Exception as e:
        print(f"[POWERBI] [DB] Erro ao buscar dashboard: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao buscar dashboard: {str(e)}")


@router.get("/db/dashboards/category/{category}", response_model=list[PowerBIDashboardOut])
async def get_db_dashboards_by_category(category: str, db: Session = Depends(get_db)):
    """Get dashboards by category from database"""
    try:
        dashboards = db.query(PowerBIDashboard)\
            .filter(PowerBIDashboard.category == category)\
            .filter(PowerBIDashboard.ativo == True)\
            .order_by(PowerBIDashboard.order)\
            .all()

        print(f"[POWERBI] [DB] Encontrados {len(dashboards)} dashboards da categoria '{category}'")
        return dashboards
    except Exception as e:
        print(f"[POWERBI] [DB] Erro ao buscar dashboards por categoria: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao buscar dashboards: {str(e)}")


@router.get("/db/subcategories")
async def get_bi_subcategories(db: Session = Depends(get_db)):
    """Get BI dashboard subcategories for user permissions (with dashboard_id and title)"""
    try:
        dashboards = db.query(PowerBIDashboard)\
            .filter(PowerBIDashboard.ativo == True)\
            .order_by(PowerBIDashboard.order)\
            .all()

        # Return both dashboard_id and title for better UX
        subcategories = [
            {
                "dashboard_id": d.dashboard_id,
                "title": d.title,
                "category": d.category,
                "category_name": d.category_name
            }
            for d in dashboards
        ]

        print(f"[POWERBI] [DB] Retornando {len(subcategories)} subcategorias de BI")
        for sub in subcategories:
            print(f"[POWERBI] [DB]   - {sub['dashboard_id']}: {sub['title']}")
        return {"subcategories": subcategories}
    except Exception as e:
        print(f"[POWERBI] [DB] Erro ao buscar subcategorias: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao buscar subcategorias: {str(e)}")


@router.post("/db/dashboards", response_model=PowerBIDashboardOut)
async def create_db_dashboard(dashboard: PowerBIDashboardCreate, db: Session = Depends(get_db)):
    """Create new dashboard in database"""
    try:
        # Check if dashboard_id already exists
        existing = db.query(PowerBIDashboard)\
            .filter(PowerBIDashboard.dashboard_id == dashboard.dashboard_id)\
            .first()

        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"Dashboard com ID '{dashboard.dashboard_id}' já existe"
            )

        new_dashboard = PowerBIDashboard(**dashboard.model_dump())
        db.add(new_dashboard)
        db.commit()
        db.refresh(new_dashboard)

        print(f"[POWERBI] [DB] Dashboard criado: {new_dashboard.title}")
        return new_dashboard
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"[POWERBI] [DB] Erro ao criar dashboard: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao criar dashboard: {str(e)}")


@router.put("/db/dashboards/{dashboard_id}", response_model=PowerBIDashboardOut)
async def update_db_dashboard(
    dashboard_id: str,
    dashboard_update: PowerBIDashboardUpdate,
    db: Session = Depends(get_db)
):
    """Update dashboard in database"""
    try:
        dashboard = db.query(PowerBIDashboard)\
            .filter(PowerBIDashboard.dashboard_id == dashboard_id)\
            .first()

        if not dashboard:
            raise HTTPException(
                status_code=404,
                detail=f"Dashboard '{dashboard_id}' not found"
            )

        update_data = dashboard_update.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(dashboard, field, value)

        db.commit()
        db.refresh(dashboard)

        print(f"[POWERBI] [DB] Dashboard atualizado: {dashboard.title}")
        return dashboard
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"[POWERBI] [DB] Erro ao atualizar dashboard: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar dashboard: {str(e)}")


@router.delete("/db/dashboards/{dashboard_id}")
async def delete_db_dashboard(dashboard_id: str, db: Session = Depends(get_db)):
    """Delete dashboard from database (soft delete - marks as inactive)"""
    try:
        dashboard = db.query(PowerBIDashboard)\
            .filter(PowerBIDashboard.dashboard_id == dashboard_id)\
            .first()

        if not dashboard:
            raise HTTPException(
                status_code=404,
                detail=f"Dashboard '{dashboard_id}' not found"
            )

        dashboard.ativo = False
        db.commit()

        print(f"[POWERBI] [DB] Dashboard desativado: {dashboard.title}")
        return {"message": f"Dashboard '{dashboard_id}' desativado com sucesso"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"[POWERBI] [DB] Erro ao deletar dashboard: {e}")
        raise HTTPException(status_code=500, detail=f"Erro ao deletar dashboard: {str(e)}")


# ============================================
# DEBUG ENDPOINTS
# ============================================

@router.get("/debug/config")
def debug_powerbi_config():
    """Check current Power BI configuration"""
    return {
        "✅ Configuração": {
            "client_id": POWERBI_CLIENT_ID,
            "client_secret": f"✅ {len(POWERBI_CLIENT_SECRET)} caracteres" if POWERBI_CLIENT_SECRET else "❌ Não configurado",
            "client_secret_preview": POWERBI_CLIENT_SECRET[:15] + "..." if POWERBI_CLIENT_SECRET else "",
            "tenant_id": POWERBI_TENANT_ID,
            "workspace_id": POWERBI_WORKSPACE_ID,
            "object_id": POWERBI_OBJECT_ID,
            "display_name": POWERBI_DISPLAY_NAME,
        },
        "🔗 URLs": {
            "authority": AUTHORITY_URL,
            "token_endpoint": TOKEN_ENDPOINT,
            "api_base": POWERBI_API_URL,
        },
        "📊 Links Úteis": {
            "workspace_settings": f"https://app.powerbi.com/groups/{POWERBI_WORKSPACE_ID}/settings/access",
            "workspace_content": f"https://app.powerbi.com/groups/{POWERBI_WORKSPACE_ID}/list",
            "azure_app": f"https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/Overview/appId/{POWERBI_CLIENT_ID}",
        }
    }


@router.get("/debug/workspaces")
async def debug_workspaces():
    """List all accessible workspaces"""
    try:
        token = await get_service_principal_token()
        headers = {"Authorization": f"Bearer {token}"}

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{POWERBI_API_URL}/groups",
                headers=headers,
            )

            print(f"[POWERBI] [DEBUG] Workspaces - Status: {response.status_code}")

            if response.status_code == 200:
                data = response.json()
                workspaces = data.get("value", [])
                
                return {
                    "status": "✅ Service Principal tem acesso aos workspaces",
                    "total_workspaces": len(workspaces),
                    "configured_workspace_id": POWERBI_WORKSPACE_ID,
                    "workspaces": [
                        {
                            "id": w.get("id"),
                            "name": w.get("name"),
                            "isOnDedicatedCapacity": w.get("isOnDedicatedCapacity", False),
                            "type": w.get("type", "Workspace"),
                            "📊 Link": f"https://app.powerbi.com/groups/{w.get('id')}/list"
                        }
                        for w in workspaces
                    ]
                }
            else:
                return {
                    "status": f"❌ Erro {response.status_code}",
                    "error": response.text,
                    "diagnóstico": [
                        "Service Principal não está habilitado no Power BI Admin?",
                        "Falta permissões de API no Azure AD?",
                        "Tenant settings bloqueando Service Principals?"
                    ]
                }
                
    except Exception as e:
        import traceback
        return {
            "status": "❌ Erro",
            "error": str(e),
            "traceback": traceback.format_exc()
        }


@router.get("/debug/workspace/{workspace_id}")
async def debug_workspace_access(workspace_id: str):
    """Check access to a specific workspace and list its contents"""
    try:
        token = await get_service_principal_token()
        headers = {"Authorization": f"Bearer {token}"}

        results = {}

        async with httpx.AsyncClient(timeout=10.0) as client:
            # 1. Informações do workspace
            workspace_response = await client.get(
                f"{POWERBI_API_URL}/groups/{workspace_id}",
                headers=headers,
            )
            
            if workspace_response.status_code == 200:
                results["workspace_info"] = workspace_response.json()
            else:
                results["workspace_info"] = {
                    "error": f"Status {workspace_response.status_code}",
                    "detail": workspace_response.text
                }

            # 2. Reports no workspace
            reports_response = await client.get(
                f"{POWERBI_API_URL}/groups/{workspace_id}/reports",
                headers=headers,
            )
            
            if reports_response.status_code == 200:
                reports = reports_response.json().get("value", [])
                results["reports"] = {
                    "status": "✅ Acesso OK",
                    "count": len(reports),
                    "reports": [
                        {
                            "id": r.get("id"),
                            "name": r.get("name"),
                            "datasetId": r.get("datasetId"),
                            "webUrl": r.get("webUrl"),
                            "embedUrl": r.get("embedUrl"),
                        }
                        for r in reports
                    ]
                }
            else:
                results["reports"] = {
                    "status": f"❌ Erro {reports_response.status_code}",
                    "error": reports_response.text
                }

            # 3. Datasets no workspace
            datasets_response = await client.get(
                f"{POWERBI_API_URL}/groups/{workspace_id}/datasets",
                headers=headers,
            )
            
            if datasets_response.status_code == 200:
                datasets = datasets_response.json().get("value", [])
                results["datasets"] = {
                    "status": "✅ Acesso OK",
                    "count": len(datasets),
                    "datasets": [
                        {
                            "id": d.get("id"),
                            "name": d.get("name"),
                            "webUrl": d.get("webUrl"),
                        }
                        for d in datasets
                    ]
                }
            else:
                results["datasets"] = {
                    "status": f"❌ Erro {datasets_response.status_code}",
                    "error": datasets_response.text
                }

            return {
                "workspace_id": workspace_id,
                "configured_workspace_id": POWERBI_WORKSPACE_ID,
                "is_correct_workspace": workspace_id == POWERBI_WORKSPACE_ID,
                "results": results,
                "🔗 Links": {
                    "workspace": f"https://app.powerbi.com/groups/{workspace_id}/list",
                    "settings": f"https://app.powerbi.com/groups/{workspace_id}/settings/access",
                }
            }

    except Exception as e:
        import traceback
        return {
            "status": "❌ Erro",
            "error": str(e),
            "traceback": traceback.format_exc()
        }


@router.get("/debug/workspace-access")
async def debug_configured_workspace_access():
    """
    Verifica se o Service Principal tem acesso ao workspace configurado
    Este é o endpoint mais importante para diagnóstico!
    """
    return await debug_workspace_access(POWERBI_WORKSPACE_ID)


@router.get("/debug/datasets")
async def debug_datasets_access():
    """Check if service principal has access to datasets"""
    try:
        token = await get_service_principal_token()
        headers = {"Authorization": f"Bearer {token}"}

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{POWERBI_API_URL}/datasets",
                headers=headers,
            )

            if response.status_code == 200:
                datasets = response.json().get("value", [])
                return {
                    "status": "✅ OK",
                    "count": len(datasets),
                    "datasets": [
                        {
                            "id": d.get("id"),
                            "name": d.get("name"),
                            "webUrl": d.get("webUrl"),
                        }
                        for d in datasets[:20]
                    ]
                }
            else:
                return {
                    "status": f"❌ Erro {response.status_code}",
                    "error": response.text
                }
    except Exception as e:
        return {"status": "❌ Erro", "error": str(e)}


@router.get("/debug/reports")
async def debug_reports_access():
    """Check if service principal has access to reports"""
    try:
        token = await get_service_principal_token()
        headers = {"Authorization": f"Bearer {token}"}

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{POWERBI_API_URL}/reports",
                headers=headers,
            )

            if response.status_code == 200:
                reports = response.json().get("value", [])
                return {
                    "status": "✅ OK",
                    "count": len(reports),
                    "reports": [
                        {
                            "id": r.get("id"),
                            "name": r.get("name"),
                            "datasetId": r.get("datasetId"),
                            "webUrl": r.get("webUrl"),
                        }
                        for r in reports[:20]
                    ]
                }
            else:
                return {
                    "status": f"❌ Erro {response.status_code}",
                    "error": response.text
                }
    except Exception as e:
        return {"status": "❌ Erro", "error": str(e)}


@router.get("/debug/embed-url/{report_id}")
async def debug_embed_url(report_id: str):
    """Debug endpoint: Check embedUrl format for a specific report"""
    try:
        token = await get_service_principal_token()
        headers = {"Authorization": f"Bearer {token}"}

        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{POWERBI_API_URL}/groups/{POWERBI_WORKSPACE_ID}/reports/{report_id}",
                headers=headers,
            )

            if response.status_code == 200:
                report_data = response.json()
                embed_url = report_data.get("embedUrl", "NOT PROVIDED")

                return {
                    "status": "✅ Found",
                    "report_id": report_id,
                    "embed_url": embed_url,
                    "embed_url_valid": isinstance(embed_url, str) and embed_url.startswith("https://"),
                    "has_groupId": "groupId=" in str(embed_url),
                    "has_reportId": f"reportId={report_id}" in str(embed_url),
                    "url_length": len(str(embed_url)),
                    "fallback_url": f"https://app.powerbi.com/reportEmbed?reportId={report_id}&groupId={POWERBI_WORKSPACE_ID}&w=2"
                }
            else:
                return {
                    "status": f"❌ Error {response.status_code}",
                    "error": response.text[:500],
                    "fallback_url": f"https://app.powerbi.com/reportEmbed?reportId={report_id}&groupId={POWERBI_WORKSPACE_ID}&w=2"
                }
    except Exception as e:
        import traceback
        return {
            "status": "❌ Error",
            "error": str(e),
            "traceback": traceback.format_exc()
        }


@router.get("/status")
async def check_powerbi_status():
    """Check Power BI connection status"""
    try:
        token = await get_service_principal_token()
        return {
            "status": "connected",
            "display_name": POWERBI_DISPLAY_NAME,
            "tenant_id": POWERBI_TENANT_ID,
            "workspace_id": POWERBI_WORKSPACE_ID,
        }
    except Exception as e:
        return {
            "status": "disconnected",
            "error": str(e),
        }
