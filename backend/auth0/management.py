import requests
import json
import time
from typing import Optional, Dict, Any, List
from .config import (
    AUTH0_DOMAIN,
    AUTH0_M2M_CLIENT_ID,
    AUTH0_M2M_CLIENT_SECRET,
    AUTH0_AUDIENCE,
    AUTH0_TOKEN_URL,
    AUTH0_MANAGEMENT_API_URL,
)


class Auth0ManagementClient:
    """Client for Auth0 Management API"""
    
    def __init__(self):
        self.domain = AUTH0_DOMAIN
        self.client_id = AUTH0_M2M_CLIENT_ID
        self.client_secret = AUTH0_M2M_CLIENT_SECRET
        self.base_url = AUTH0_MANAGEMENT_API_URL
        self.token = None
        self.token_expires_at = 0
    
    def _get_management_token(self) -> str:
        """Get M2M access token for Management API"""
        try:
            print(f"\n[MGMT-TOKEN] Getting M2M token...")
            print(f"[MGMT-TOKEN] Token URL: {AUTH0_TOKEN_URL}")
            print(f"[MGMT-TOKEN] Client ID: {self.client_id[:20] + '...' if self.client_id else 'NOT SET'}")
            print(f"[MGMT-TOKEN] Client Secret: {'SET' if self.client_secret else 'NOT SET'}")
            print(f"[MGMT-TOKEN] Audience: {self.base_url}")

            response = requests.post(
                AUTH0_TOKEN_URL,
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "audience": self.base_url,
                    "grant_type": "client_credentials",
                },
                timeout=10,
            )

            print(f"[MGMT-TOKEN] Response status: {response.status_code}")

            if not response.ok:
                print(f"[MGMT-TOKEN] ✗ Error response: {response.text}")

            response.raise_for_status()

            data = response.json()
            self.token = data.get("access_token")

            if not self.token:
                raise Exception("No access token in response")

            # ✅ Salva expiração com 60s de margem para evitar uso de token vencido
            expires_in = data.get("expires_in", 86400)
            self.token_expires_at = time.time() + expires_in - 60

            print(f"[MGMT-TOKEN] ✅ Auth0 Management API token obtained")
            print(f"[MGMT-TOKEN] Token (first 30 chars): {self.token[:30]}...")
            print(f"[MGMT-TOKEN] Token expires in: {expires_in}s")
            return self.token

        except Exception as e:
            print(f"[MGMT-TOKEN] ❌ Error getting Auth0 Management token: {str(e)}")
            import traceback
            traceback.print_exc()
            raise
    
    def _get_headers(self) -> dict:
        """Get headers with valid access token — renews automatically when expired"""
        if not self.token or time.time() >= self.token_expires_at:
            print(f"[MGMT-TOKEN] Token {'expired' if self.token else 'not set'} — renewing...")
            self._get_management_token()
        
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }
    
    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """
        Get user by email
        
        Args:
            email: User email address
            
        Returns:
            User data dict or None if not found
        """
        try:
            headers = self._get_headers()
            url = f"{self.base_url}users-by-email"
            
            response = requests.get(
                url,
                headers=headers,
                params={"email": email},
                timeout=10,
            )
            
            if response.status_code == 404:
                return None
            
            response.raise_for_status()
            users = response.json()
            
            return users[0] if users else None
            
        except Exception as e:
            print(f"❌ Error getting user by email: {str(e)}")
            raise
    
    def get_user(self, user_id: str) -> Dict[str, Any]:
        """
        Get user by ID
        
        Args:
            user_id: Auth0 user ID
            
        Returns:
            User data dict
        """
        try:
            headers = self._get_headers()
            url = f"{self.base_url}users/{user_id}"
            
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            
            return response.json()
            
        except Exception as e:
            print(f"❌ Error getting user: {str(e)}")
            raise
    
    def create_user(
        self,
        email: str,
        password: str,
        given_name: str,
        family_name: str,
        user_metadata: Optional[Dict] = None,
    ) -> Dict[str, Any]:
        """
        Create a new user

        Args:
            email: User email
            password: User password
            given_name: First name
            family_name: Last name
            user_metadata: Additional user metadata

        Returns:
            Created user data
        """
        try:
            headers = self._get_headers()
            url = f"{self.base_url}users"

            print(f"\n[AUTH0-CREATE-USER] 📝 Creating user in Auth0...")
            print(f"[AUTH0-CREATE-USER] Email: {email}")
            print(f"[AUTH0-CREATE-USER] Given name: {given_name}")
            print(f"[AUTH0-CREATE-USER] Family name: {family_name}")
            print(f"[AUTH0-CREATE-USER] User metadata: {user_metadata}")

            data = {
                "email": email,
                "password": password,
                "given_name": given_name,
                "family_name": family_name,
                "connection": "Username-Password-Authentication",
                "email_verified": False,
            }

            # Only add user_metadata if provided
            if user_metadata:
                data["user_metadata"] = user_metadata

            print(f"[AUTH0-CREATE-USER] Request payload: {data}")
            print(f"[AUTH0-CREATE-USER] URL: {url}")

            response = requests.post(
                url,
                headers=headers,
                json=data,
                timeout=10,
            )

            print(f"[AUTH0-CREATE-USER] Response status: {response.status_code}")

            if not response.ok:
                print(f"[AUTH0-CREATE-USER] ❌ Error response status: {response.status_code}")
                print(f"[AUTH0-CREATE-USER] ❌ Error response body (raw): {response.text}")
                # Try to extract error details from Auth0
                try:
                    error_data = response.json()
                    print(f"[AUTH0-CREATE-USER] ❌ Auth0 error details:")
                    print(f"    - statusCode: {error_data.get('statusCode')}")
                    print(f"    - error: {error_data.get('error')}")
                    print(f"    - error_description: {error_data.get('error_description')}")
                    print(f"    - message: {error_data.get('message')}")
                except Exception as parse_err:
                    print(f"[AUTH0-CREATE-USER] Could not parse error JSON: {parse_err}")

            response.raise_for_status()

            user = response.json()
            print(f"[AUTH0-CREATE-USER] ✅ User created successfully!")
            print(f"[AUTH0-CREATE-USER] Auth0 user_id: {user.get('user_id')}\n")
            return user

        except Exception as e:
            print(f"[AUTH0-CREATE-USER] ❌ Error creating user: {str(e)}")
            import traceback
            traceback.print_exc()
            raise
    
    def update_user(
        self,
        user_id: str,
        data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Update user
        
        Args:
            user_id: Auth0 user ID
            data: Data to update
            
        Returns:
            Updated user data
        """
        try:
            headers = self._get_headers()
            url = f"{self.base_url}users/{user_id}"
            
            response = requests.patch(
                url,
                headers=headers,
                json=data,
                timeout=10,
            )
            response.raise_for_status()
            
            user = response.json()
            print(f"✅ User updated: {user_id}")
            return user
            
        except Exception as e:
            print(f"❌ Error updating user: {str(e)}")
            raise
    
    def assign_role_to_user(
        self,
        user_id: str,
        role_id: str,
    ) -> None:
        """
        Assign role to user
        
        Args:
            user_id: Auth0 user ID
            role_id: Auth0 role ID
        """
        try:
            headers = self._get_headers()
            url = f"{self.base_url}users/{user_id}/roles"
            
            data = {
                "roles": [role_id],
            }
            
            response = requests.post(
                url,
                headers=headers,
                json=data,
                timeout=10,
            )
            response.raise_for_status()
            
            print(f"✅ Role assigned to user: {user_id}")
            
        except Exception as e:
            print(f"❌ Error assigning role: {str(e)}")
            raise
    
    def get_user_roles(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Get user roles
        
        Args:
            user_id: Auth0 user ID
            
        Returns:
            List of role objects
        """
        try:
            headers = self._get_headers()
            url = f"{self.base_url}users/{user_id}/roles"
            
            response = requests.get(
                url,
                headers=headers,
                timeout=10,
            )
            response.raise_for_status()
            
            return response.json()
            
        except Exception as e:
            print(f"❌ Error getting user roles: {str(e)}")
            raise
    
    def delete_user(self, user_id: str) -> None:
        """
        Delete user

        Args:
            user_id: Auth0 user ID
        """
        try:
            headers = self._get_headers()
            url = f"{self.base_url}users/{user_id}"

            response = requests.delete(
                url,
                headers=headers,
                timeout=10,
            )
            response.raise_for_status()

            print(f"✅ User deleted: {user_id}")

        except Exception as e:
            print(f"❌ Error deleting user: {str(e)}")
            raise

    def get_users(
        self,
        page: int = 0,
        per_page: int = 50,
        query: Optional[str] = None,
        sort: str = "created_at:-1",
    ) -> Dict[str, Any]:
        """
        Get list of users from Auth0

        Args:
            page: Page number (zero-indexed)
            per_page: Number of users per page
            query: Search query (e.g., "email:'user@example.com'")
            sort: Sort order (e.g., "created_at:-1" for newest first)

        Returns:
            Dict with users list and total count
        """
        try:
            print(f"\n[MGMT-GET-USERS] ✓ get_users called")
            print(f"[MGMT-GET-USERS] Page: {page}, Per page: {per_page}")
            print(f"[MGMT-GET-USERS] Query: {query}")
            print(f"[MGMT-GET-USERS] Sort: {sort}")

            headers = self._get_headers()
            url = f"{self.base_url}users"
            print(f"[MGMT-GET-USERS] URL: {url}")

            # Parâmetros básicos sem include_totals e sort por enquanto
            params = {
                "page": page,
                "per_page": per_page,
            }

            # Adiciona query se fornecido
            if query:
                params["q"] = query

            # Adiciona sort APENAS se for uma string não vazia
            if sort and isinstance(sort, str) and sort.strip():
                params["sort"] = sort

            print(f"[MGMT-GET-USERS] Params: {params}")
            print(f"[MGMT-GET-USERS] Making request to Auth0...")

            response = requests.get(
                url,
                headers=headers,
                params=params,
                timeout=10,
            )

            print(f"[MGMT-GET-USERS] Response status: {response.status_code}")
            print(f"[MGMT-GET-USERS] Response headers: {dict(response.headers)}")

            if not response.ok:
                print(f"[MGMT-GET-USERS] ✗ Error response: {response.text}")

            response.raise_for_status()

            # O Auth0 retorna diretamente a lista quando não usa include_totals
            users = response.json()
            
            # Se for uma lista, transformamos no formato esperado
            if isinstance(users, list):
                result = {
                    "users": users,
                    "total": len(users),
                    "page": page,
                    "per_page": per_page,
                }
                print(f"[MGMT-GET-USERS] ✓ Got {len(users)} users (without totals)")
            else:
                result = users
                print(f"[MGMT-GET-USERS] ✓ Got JSON response with totals")
            
            print(f"[MGMT-GET-USERS] Response keys: {list(result.keys())}")
            print(f"[MGMT-GET-USERS] Number of users: {len(result.get('users', []))}")

            return result

        except Exception as e:
            print(f"[MGMT-GET-USERS] ❌ Error getting users: {str(e)}")
            print(f"[MGMT-GET-USERS] Error type: {type(e).__name__}")
            import traceback
            traceback.print_exc()
            raise


# Global client instance
_auth0_client = None


def get_auth0_client() -> Auth0ManagementClient:
    """Get or create Auth0 Management client"""
    global _auth0_client
    if _auth0_client is None:
        _auth0_client = Auth0ManagementClient()
    return _auth0_client
