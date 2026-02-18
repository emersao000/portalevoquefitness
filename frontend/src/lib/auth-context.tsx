import {
  createContext,
  useContext,
  ReactNode,
  useEffect,
  useState,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

interface User {
  id?: number;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  nivel_acesso?: string;
  setores?: string[];
  bi_subcategories?: string[] | null;
  loginTime: number;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email?: string, password?: string) => Promise<any>;
  logout: () => void;
  loginWithAuth0: () => Promise<void>;
  getAccessToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper function: generates a cryptographically secure random string for state parameter
function generateSecureState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

// Helper function: generates PKCE code verifier and challenge
function generatePKCE(): { verifier: string; challenge: string } {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const verifier = Array.from(array, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  // Create challenge from verifier using SHA256
  const buffer = new TextEncoder().encode(verifier);
  return crypto.subtle.digest("SHA-256", buffer).then((hashBuffer) => {
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const challenge = btoa(String.fromCharCode.apply(null, hashArray))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
    return { verifier, challenge };
  }) as any;
}

// Helper function: determina para onde redirecionar baseado no nível de acesso
function getAutoRedirectUrl(user: User): string | null {
  if (!user.nivel_acesso) return null;

  const accessLevel = user.nivel_acesso.toLowerCase();

  // Administradores vão para o painel administrativo
  if (accessLevel === "administrador") {
    return "/setor/ti/admin";
  }

  // Agentes vão para a página de chamados
  if (accessLevel.includes("agente")) {
    return "/setor/ti";
  }

  // Usuários comuns vão para a página inicial dos setores
  if (user.setores && user.setores.length > 0) {
    const firstSector = user.setores[0].toLowerCase();
    return `/setor/${firstSector}`;
  }

  // Fallback: página principal
  return "/";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Check if there's an existing Auth0 session cookie (for SSO between portals)
  const attemptSilentAuth = async (): Promise<boolean> => {
    try {
      console.debug(
        "[AUTH] Checking for existing Auth0 session (SSO between portals)...",
      );

      // Build Auth0 authorization URL with prompt=none to check session without showing login UI
      // This only works if there's already a session in Auth0 from login on another portal
      const authorizationUrl = new URL(
        `https://${import.meta.env.VITE_AUTH0_DOMAIN}/authorize`,
      );

      const state = generateSecureState();
      sessionStorage.setItem("auth_state_sso", state);

      const params = {
        response_type: "code",
        client_id: import.meta.env.VITE_AUTH0_CLIENT_ID,
        redirect_uri: import.meta.env.VITE_AUTH0_REDIRECT_URI,
        scope: "openid profile email offline_access",
        // audience: import.meta.env.VITE_AUTH0_AUDIENCE,  // ← REMOVIDO - API não configurada no tenant
        state: state,
        prompt: "none", // Don't show login UI if already authenticated
      };

      Object.entries(params).forEach(([key, value]) => {
        authorizationUrl.searchParams.append(key, value);
      });

      // Navigate directly to Auth0 authorize endpoint
      // This will redirect back to callback URL if session exists
      window.location.href = authorizationUrl.toString();
      return true;
    } catch (error) {
      console.debug("[AUTH] Silent auth check failed:", error);
      return false;
    }
  };

  // Initialize Auth0 on mount
  useEffect(() => {
    const initAuth0 = async () => {
      try {
        // Check if returning from Auth0 callback
        const code = searchParams.get("code");
        const state = searchParams.get("state");
        const error = searchParams.get("error");
        const errorDescription = searchParams.get("error_description");

        console.debug(
          "[AUTH] Init - searchParams keys:",
          Array.from(searchParams.keys()),
        );
        console.debug("[AUTH] Init - code:", code ? "present" : "missing");
        console.debug("[AUTH] Init - state:", state ? "present" : "missing");
        console.debug("[AUTH] Init - error:", error || "none");
        console.debug("[AUTH] Current pathname:", window.location.pathname);

        if (error) {
          console.error(
            "[AUTH] Auth0 returned error:",
            error,
            errorDescription,
          );
          // Clear any SSO state on error
          sessionStorage.removeItem("auth_state_sso");

          // If error is login_required, it means no session exists for SSO
          if (error === "login_required") {
            console.debug(
              "[AUTH] No Auth0 session found (expected for first login)",
            );
            setIsLoading(false);
            return;
          }

          // For other errors, redirect to login
          setIsLoading(false);
          navigate("/auth0/login", { replace: true });
          return;
        }

        if (code && state) {
          console.debug(
            "[AUTH] ✓ Code and state found, initiating Auth0 callback",
          );

          // Validate state parameter for security
          const storedState = sessionStorage.getItem("auth_state");
          const storedSSOState = sessionStorage.getItem("auth_state_sso");
          const isValidState =
            (storedState && state === storedState) ||
            (storedSSOState && state === storedSSOState);

          if (!isValidState) {
            console.error(
              "[AUTH] ✗ State parameter mismatch - possible CSRF attack",
            );
            console.error(
              "[AUTH] Expected state:",
              storedState || storedSSOState,
            );
            console.error("[AUTH] Received state:", state);
            throw new Error("Invalid state parameter - CSRF validation failed");
          }

          console.debug("[AUTH] ✓ State parameter validated");

          // Clean up state from storage
          sessionStorage.removeItem("auth_state");
          sessionStorage.removeItem("auth_state_sso");

          // Handle Auth0 redirect - exchange code for token
          await handleAuth0Callback(code, state);
        } else {
          console.debug("[AUTH] No code/state, checking existing session");
          // Check for existing session in sessionStorage
          const hasSession = await checkExistingSession();

          if (!hasSession) {
            console.debug("[AUTH] No existing session found");
            // Don't attempt silent auth here - only on explicit login
          }
        }
      } catch (error) {
        console.error("[AUTH] ✗ Error initializing auth:", error);
        setUser(null);
        // If callback failed, redirect to login page
        if (window.location.pathname === "/auth/callback") {
          console.debug("[AUTH] Redirecting to login due to callback error");
          navigate("/auth0/login", { replace: true });
        }
      } finally {
        setIsLoading(false);
      }
    };

    // Set timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (window.location.pathname === "/auth/callback") {
        console.error("[AUTH] Callback timeout - redirecting to login");
        setIsLoading(false);
        navigate("/auth0/login", { replace: true });
      }
    }, 10000); // 10 second timeout

    initAuth0();

    return () => clearTimeout(timeoutId);
  }, [searchParams, navigate]);

  const handleAuth0Callback = async (code: string, state: string) => {
    try {
      console.debug("[AUTH] Starting Auth0 code exchange...");
      console.debug("[AUTH] Code:", code.substring(0, 20) + "...");
      console.debug(
        "[AUTH] Redirect URI:",
        import.meta.env.VITE_AUTH0_REDIRECT_URI,
      );

      // Exchange code for token with backend (more secure than client-side exchange)
      const response = await fetch("/api/auth/auth0-exchange", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: code,
          redirect_uri: import.meta.env.VITE_AUTH0_REDIRECT_URI,
        }),
      });

      console.debug("[AUTH] Exchange response status:", response.status);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error("[AUTH] ✗ Exchange failed:", error);
        throw new Error(error.detail || "Failed to exchange code for token");
      }

      const data = await response.json();
      console.debug("[AUTH] ✓ Exchange successful, got user data");
      console.debug("[AUTH] User email:", data.email);
      console.debug("[AUTH] User level:", data.nivel_acesso);
      console.debug(
        "[AUTH] BI Subcategories from backend:",
        data.bi_subcategories,
      );

      if (!data.email) {
        throw new Error("Email not found in response");
      }

      const accessToken = data.access_token;

      // Create user object from response
      const now = Date.now();
      const firstName = data.nome || "";
      const lastName = data.sobrenome || "";
      const fullName = `${firstName} ${lastName}`.trim();

      // Keep bi_subcategories as is: null means no restriction (show all), array means restricted
      const normalizedBiSubcategories = Array.isArray(data.bi_subcategories)
        ? data.bi_subcategories
        : null;

      const userData: User = {
        id: data.id,
        email: data.email,
        name: fullName || data.email,
        firstName: firstName || data.email.split("@")[0],
        lastName: lastName,
        nivel_acesso: data.nivel_acesso,
        setores: Array.isArray(data.setores) ? data.setores : [],
        bi_subcategories: normalizedBiSubcategories,
        loginTime: now,
      };

      // Create session in database via backend
      console.debug("[AUTH] Creating session in database...");
      const sessionResponse = await fetch("/api/auth/session/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: data.id,
          access_token: accessToken,
          expires_in: 86400, // 24 hours
        }),
      });

      if (!sessionResponse.ok) {
        const error = await sessionResponse.json().catch(() => ({}));
        console.error("[AUTH] ✗ Session creation failed:", error);
        throw new Error(error.detail || "Failed to create session");
      }

      const sessionData = await sessionResponse.json();
      console.debug("[AUTH] ✓ Session created in database");
      console.debug(
        "[AUTH] Session token:",
        sessionData.session_token.substring(0, 20) + "...",
      );

      // Store session token in sessionStorage (NOT localStorage)
      sessionStorage.setItem("auth_session_token", sessionData.session_token);
      sessionStorage.setItem("auth_expires_at", sessionData.expires_at);

      // Set user in state
      setUser(userData);
      console.debug("[AUTH] ✓ User state updated");
      console.debug("[AUTH] User data being saved:", {
        id: userData.id,
        email: userData.email,
        bi_subcategories: userData.bi_subcategories,
      });

      // Store user data in sessionStorage
      const authJson = JSON.stringify(userData);
      sessionStorage.setItem("evoque-fitness-auth", authJson);
      console.debug(
        "[AUTH] ✓ Saved to sessionStorage, length:",
        authJson.length,
      );
      console.debug(
        "[AUTH] Verify sessionStorage:",
        sessionStorage.getItem("evoque-fitness-auth") ? "OK" : "FAIL",
      );

      // Refresh permissions immediately after Auth0 login
      // This ensures we have the latest bi_subcategories from the server
      await refreshUserPermissions(userData.id!);

      // Attempt to identify on Socket.IO immediately after Auth0 login
      try {
        const socket = (window as any).__APP_SOCK__;
        if (socket && socket.connected && userData.id) {
          console.debug(
            "[AUTH] Identifying socket immediately after Auth0 login for user",
            userData.id,
          );
          socket.emit("identify", { user_id: userData.id });
        }
      } catch (e) {
        console.debug(
          "[AUTH] Socket immediate identify failed (may connect later):",
          e,
        );
      }

      // Get redirect URL - usar a que foi armazenada ou gerar automática
      let redirectUrl = sessionStorage.getItem("auth0_redirect_after_login");
      if (!redirectUrl) {
        // Se não houver redirecionamento armazenado, usar o automático baseado no nível de acesso
        redirectUrl = getAutoRedirectUrl(userData) || "/";
      }
      redirectUrl = redirectUrl || "/";

      sessionStorage.removeItem("auth0_redirect_after_login");

      console.debug("[AUTH] ✓ Redirecting to:", redirectUrl);
      console.log("[AUTH] ✓ Auth success, navigating to:", redirectUrl);

      // Use setTimeout to ensure state update completes before navigation
      setTimeout(() => {
        console.debug("[AUTH] Navigating to:", redirectUrl);
        navigate(redirectUrl, { replace: true });

        // AFTER navigation starts, trigger auth:refresh event
        // This ensures useAuth hooks are mounted and listening before event fires
        setTimeout(() => {
          console.debug(
            "[AUTH] Dispatching auth:refresh event to sync permissions from backend",
          );
          window.dispatchEvent(new CustomEvent("auth:refresh"));
        }, 100); // Small delay to ensure page is mounted and listeners registered
      }, 0);
    } catch (error) {
      console.error("[AUTH] ✗ Error handling Auth0 callback:", error);
      console.error("[AUTH] Error details:", (error as any)?.message || error);
      setUser(null);
      throw error;
    }
  };

  // Function to refresh user permissions from backend
  const refreshUserPermissions = async (userId: number): Promise<void> => {
    try {
      console.debug(
        "[AUTH] 🔄 Refreshing user permissions from backend for user",
        userId,
      );
      const response = await fetch(`/api/usuarios/${userId}`);
      if (!response.ok) {
        console.error(
          "[AUTH] Failed to refresh permissions, status:",
          response.status,
        );
        return;
      }

      const remoteUser = await response.json();
      console.debug("[AUTH] ✓ Fresh user data from backend:", {
        id: remoteUser.id,
        bi_subcategories: remoteUser.bi_subcategories,
        setores: remoteUser.setores,
      });

      // Update user state with fresh data from backend
      setUser((currentUser) => {
        if (!currentUser) return null;

        const updated: User = {
          ...currentUser,
          nivel_acesso: remoteUser.nivel_acesso,
          setores: Array.isArray(remoteUser.setores) ? remoteUser.setores : [],
          bi_subcategories: Array.isArray(remoteUser.bi_subcategories)
            ? remoteUser.bi_subcategories
            : remoteUser.bi_subcategories === null
              ? null
              : [],
        };

        console.debug("[AUTH] ✓ Updated user permissions in state:", {
          bi_subcategories: updated.bi_subcategories,
          setores: updated.setores,
        });

        // Update sessionStorage with fresh data
        const authJson = JSON.stringify(updated);
        sessionStorage.setItem("evoque-fitness-auth", authJson);

        return updated;
      });
    } catch (error) {
      console.error("[AUTH] Error refreshing permissions:", error);
    }
  };

  const checkExistingSession = async (): Promise<boolean> => {
    try {
      const sessionToken = sessionStorage.getItem("auth_session_token");
      const expiresAt = sessionStorage.getItem("auth_expires_at");

      if (!sessionToken || !expiresAt) {
        console.debug("[AUTH] No session found in sessionStorage");
        setUser(null);
        return false;
      }

      // Check if session is expired
      const now = new Date();
      const expiration = new Date(expiresAt);
      if (now >= expiration) {
        console.debug("[AUTH] Session expired");
        sessionStorage.removeItem("auth_session_token");
        sessionStorage.removeItem("auth_expires_at");
        sessionStorage.removeItem("evoque-fitness-auth");
        setUser(null);
        return false;
      }

      // Validate session with backend
      const response = await fetch("/api/auth/session/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_token: sessionToken,
        }),
      });

      if (!response.ok) {
        console.error("[AUTH] Session validation failed");
        sessionStorage.removeItem("auth_session_token");
        sessionStorage.removeItem("auth_expires_at");
        sessionStorage.removeItem("evoque-fitness-auth");
        setUser(null);
        return false;
      }

      const validationData = await response.json();

      if (!validationData.is_valid) {
        console.debug("[AUTH] Session is invalid");
        sessionStorage.removeItem("auth_session_token");
        sessionStorage.removeItem("auth_expires_at");
        sessionStorage.removeItem("evoque-fitness-auth");
        setUser(null);
        return false;
      }

      // Restore user from sessionStorage
      const userDataRaw = sessionStorage.getItem("evoque-fitness-auth");
      if (userDataRaw) {
        try {
          const userData = JSON.parse(userDataRaw) as User;
          // Keep bi_subcategories as is: null means no restriction, array means restricted
          // Do NOT convert null to [] - they have different meanings!
          if (userData.bi_subcategories === undefined) {
            userData.bi_subcategories = null; // undefined -> null for consistency
          }
          setUser(userData);
          console.debug("[AUTH] ✓ Session restored from sessionStorage", {
            bi_subcategories: userData.bi_subcategories,
          });
          return true;
        } catch (e) {
          console.error(
            "[AUTH] Failed to parse user data from sessionStorage:",
            e,
          );
          sessionStorage.removeItem("evoque-fitness-auth");
          setUser(null);
          return false;
        }
      }
      return false;
    } catch (error) {
      console.error("[AUTH] Error checking session:", error);
      setUser(null);
      return false;
    }
  };

  // Traditional email/password login (if needed)
  const login = async (email?: string, password?: string) => {
    try {
      if (!email || !password) {
        throw new Error("Email and password are required");
      }

      const response = await fetch("/api/usuarios/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, senha: password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Authentication failed");
      }

      const data = await response.json();
      const now = Date.now();
      const firstName = data.nome || "";
      const lastName = data.sobrenome || "";
      const fullName = `${firstName} ${lastName}`.trim();

      // Keep bi_subcategories as is: null means no restriction (show all), array means restricted
      const normalizedBiSubcategories = Array.isArray(data.bi_subcategories)
        ? data.bi_subcategories
        : null;

      const userData: User = {
        id: data.id,
        email: data.email,
        name: fullName || data.email,
        firstName: firstName || data.email.split("@")[0],
        lastName: lastName,
        nivel_acesso: data.nivel_acesso,
        setores: Array.isArray(data.setores) ? data.setores : [],
        bi_subcategories: normalizedBiSubcategories,
        loginTime: now,
      };

      console.debug(
        "[AUTH] Password login - BI Subcategories from backend:",
        data.bi_subcategories,
      );
      console.debug(
        "[AUTH] Password login - Normalized BI Subcategories:",
        normalizedBiSubcategories,
      );

      setUser(userData);
      const authJson = JSON.stringify(userData);
      sessionStorage.setItem("evoque-fitness-auth", authJson);
      console.debug(
        "[AUTH] ✓ Password login - Saved to sessionStorage, length:",
        authJson.length,
      );

      // Refresh permissions immediately after password login
      // This ensures we have the latest bi_subcategories from the server
      await refreshUserPermissions(userData.id!);

      return {
        ...data,
        alterar_senha_primeiro_acesso:
          data.alterar_senha_primeiro_acesso || false,
      };
    } catch (error: any) {
      throw new Error(error?.message || "Authentication failed");
    }
  };

  // Login with Auth0
  const loginWithAuth0 = async () => {
    try {
      // Get redirect URL from current location
      const redirect =
        new URLSearchParams(window.location.search).get("redirect") || "/";
      sessionStorage.setItem("auth0_redirect_after_login", redirect);

      // Generate secure state parameter for CSRF protection
      const state = generateSecureState();
      sessionStorage.setItem("auth_state", state);

      // Build Auth0 login URL
      const authorizationUrl = new URL(
        `https://${import.meta.env.VITE_AUTH0_DOMAIN}/authorize`,
      );

      const params = {
        response_type: "code",
        client_id: import.meta.env.VITE_AUTH0_CLIENT_ID,
        redirect_uri: import.meta.env.VITE_AUTH0_REDIRECT_URI,
        scope: "openid profile email offline_access",
        // audience: import.meta.env.VITE_AUTH0_AUDIENCE,  // ← REMOVIDO - API não configurada no tenant
        state: state,
      };

      Object.entries(params).forEach(([key, value]) => {
        authorizationUrl.searchParams.append(key, value);
      });

      console.debug("[AUTH] Redirecting to Auth0 for login");
      console.debug("[AUTH] Auth URL:", authorizationUrl.toString());
      console.debug("[AUTH] State stored:", state);

      // Redirect to Auth0
      window.location.href = authorizationUrl.toString();
    } catch (error) {
      console.error("Error logging in with Auth0:", error);
      throw error;
    }
  };

  // Logout
  const logout = async () => {
    try {
      // Get session token before clearing
      const sessionToken = sessionStorage.getItem("auth_session_token");

      // Revoke session in database if it exists
      if (sessionToken) {
        try {
          await fetch("/api/auth/session/revoke", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              session_token: sessionToken,
            }),
          }).catch((e) => console.error("[AUTH] Failed to revoke session:", e));
        } catch (e) {
          console.error("[AUTH] Failed to revoke session:", e);
        }
      }

      // Clear sessionStorage
      sessionStorage.removeItem("auth_session_token");
      sessionStorage.removeItem("auth_expires_at");
      sessionStorage.removeItem("evoque-fitness-auth");
      sessionStorage.removeItem("auth0_redirect_after_login");

      setUser(null);

      // Redirect to Auth0 logout
      const logoutUrl = new URL(
        `https://${import.meta.env.VITE_AUTH0_DOMAIN}/v2/logout`,
      );
      logoutUrl.searchParams.append(
        "returnTo",
        import.meta.env.VITE_AUTH0_LOGOUT_URI || window.location.origin,
      );
      logoutUrl.searchParams.append(
        "client_id",
        import.meta.env.VITE_AUTH0_CLIENT_ID,
      );

      window.location.href = logoutUrl.toString();
    } catch (error) {
      console.error("Error logging out:", error);
      setUser(null);
      window.location.href = "/";
    }
  };

  const getAccessToken = () => {
    return sessionStorage.getItem("auth_session_token");
  };

  const contextValue: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    loginWithAuth0,
    getAccessToken,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within AuthProvider");
  }
  return context;
}
