import { useState, useEffect } from "react";
import { permissionDebugger } from "@/lib/permission-debugger";

interface AuthUser {
  id?: number;
  email: string;
  name: string;
  nivel_acesso?: string;
  setores?: string[];
  bi_subcategories?: string[] | null;
  alterar_senha_primeiro_acesso?: boolean;
  loginTime: number;
}

interface AuthRecord extends AuthUser {
  expiresAt: number;
}

const AUTH_KEY = "evoque-fitness-auth";
const SESSION_EXPIRY = 24 * 60 * 60 * 1000; // 24 horas

function readFromStorage(): AuthUser | null {
  const now = Date.now();

  // Helper to validate required fields
  const isValidUser = (data: any): boolean => {
    return (
      data &&
      typeof data.email === "string" &&
      data.email.length > 0 &&
      typeof data.name === "string" &&
      data.name.length > 0 &&
      typeof data.loginTime === "number" &&
      data.loginTime > 0
    );
  };

  // Read only from sessionStorage (NO localStorage)
  const sessionRaw = sessionStorage.getItem(AUTH_KEY);
  console.debug("[AUTH-STORE] Reading from sessionStorage key:", AUTH_KEY);
  if (sessionRaw) {
    console.debug("[AUTH-STORE] Raw data length:", sessionRaw.length);
    try {
      const parsed = JSON.parse(sessionRaw);
      console.debug(
        "[AUTH-STORE] Parsed data bi_subcategories:",
        parsed.bi_subcategories,
      );
    } catch (e) {
      console.debug("[AUTH-STORE] Failed to parse for logging:", e);
    }
  } else {
    console.debug("[AUTH-STORE] No data found in sessionStorage");
  }
  if (sessionRaw) {
    try {
      const data = JSON.parse(sessionRaw) as Partial<AuthRecord & AuthUser>;

      // Check new format with expiresAt
      if (typeof (data as AuthRecord).expiresAt === "number") {
        if (now < (data as AuthRecord).expiresAt && isValidUser(data)) {
          const {
            email,
            name,
            loginTime,
            nivel_acesso,
            setores,
            bi_subcategories,
            alterar_senha_primeiro_acesso,
            id,
          } = data as AuthRecord & Partial<AuthUser>;
          // Keep bi_subcategories as is: null means no BI restriction, array means restricted access
          const normalizedBiSubcategories = Array.isArray(bi_subcategories)
            ? bi_subcategories
            : null;
          return {
            id,
            email,
            name,
            loginTime,
            nivel_acesso,
            setores,
            bi_subcategories: normalizedBiSubcategories,
            alterar_senha_primeiro_acesso,
          } as AuthUser;
        }
      }
      // Check legacy format
      else if (typeof data.loginTime === "number" && isValidUser(data)) {
        if (now - data.loginTime < SESSION_EXPIRY) {
          const {
            email,
            name,
            loginTime,
            nivel_acesso,
            setores,
            bi_subcategories,
            alterar_senha_primeiro_acesso,
            id,
          } = data as AuthUser & Partial<AuthRecord>;
          // Keep bi_subcategories as is: null means no BI restriction, array means restricted access
          const normalizedBiSubcategories = Array.isArray(bi_subcategories)
            ? bi_subcategories
            : null;
          return {
            id,
            email,
            name,
            loginTime,
            nivel_acesso,
            setores,
            bi_subcategories: normalizedBiSubcategories,
            alterar_senha_primeiro_acesso,
          } as AuthUser;
        }
      }

      // Data is expired or invalid, remove it
      sessionStorage.removeItem(AUTH_KEY);
    } catch (e) {
      console.debug("[AUTH] Failed to parse sessionStorage:", e);
      sessionStorage.removeItem(AUTH_KEY);
    }
  }

  return null;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const existing = readFromStorage();
    if (existing) setUser(existing);
    setIsLoading(false);

    // Check if we need to refresh permissions after login
    const needsRefresh = sessionStorage.getItem("__auth_needs_refresh__");
    if (needsRefresh === "true") {
      console.debug(
        "[AUTH] Found __auth_needs_refresh__ flag - will trigger refresh after mount",
      );
    }

    // Socket.IO connection (shared on window so multiple imports don't recreate)
    let socket: any = (window as any).__APP_SOCK__;
    let mounted = true;
    let socketIdentifyAttempts = 0;
    const maxIdentifyAttempts = 5;

    const setupSocket = async () => {
      if (socket) {
        console.debug("[SIO] Socket already exists, reusing");
        // Re-identify if we have a user (in case of Auth0 login after socket was created)
        const curr = readFromStorage();
        if (curr && curr.id && socket.connected) {
          console.debug(
            "[SIO] Re-identifying on socket reuse for Auth0 user",
            curr.id,
          );
          socket.emit("identify", { user_id: curr.id });
        }
        return socket;
      }
      try {
        console.debug("[SIO] Setting up socket connection");
        const { io } = await import("socket.io-client");
        // Connect socket to same origin (server mounts socket.io at root /socket.io)
        const origin = window.location.origin;
        const path = "/socket.io";
        console.debug("[SIO] Connecting to", origin, "path", path);
        socket = io(origin, {
          path,
          transports: ["websocket", "polling"],
          autoConnect: true,
        });
        (window as any).__APP_SOCK__ = socket;
        console.debug("[SIO] Socket created and stored globally");

        socket.on("connect", () => {
          console.debug("[SIO] ✓ Socket connected with ID", socket.id);
          // identify if we have a current user
          const curr = readFromStorage();
          if (curr && curr.id) {
            socketIdentifyAttempts = 0; // Reset attempts on successful connection
            socket.emit("identify", { user_id: curr.id });
            console.debug("[SIO] ✓ Identify emitted for user", curr.id);
          } else {
            console.debug("[SIO] No user found in storage, skipping identify");
          }
        });
        socket.on("disconnect", (reason: any) => {
          console.debug("[SIO] Socket disconnected:", reason);
        });
        socket.on("connect_error", (err: any) => {
          console.error("[SIO] ✗ Connection error:", err);
        });
        socket.on("auth:logout", (data: any) => {
          console.debug("[SIO] Received auth:logout event", data);
          try {
            const uid = data?.user_id;
            const curr = readFromStorage();
            if (curr && curr.id && uid === curr.id) {
              // force local logout
              setUser(null);
              sessionStorage.removeItem(AUTH_KEY);
              window.dispatchEvent(new CustomEvent("auth:revoked"));

              // As a fallback, redirect immediately to the login page preserving current path
              try {
                const redirect =
                  window.location.pathname + window.location.search;
                window.location.href = `/login?redirect=${encodeURIComponent(redirect)}`;
              } catch (e) {
                window.location.href = "/login";
              }
            }
          } catch (e) {
            console.error("[SIO] auth:logout handler error", e);
            try {
              window.location.href = "/login";
            } catch {}
          }
        });

        // Server-side permission/profile update for this user
        socket.on("auth:refresh", (data: any) => {
          console.log("[SIO] 🔔 Received auth:refresh event from server", data);
          try {
            const uid = data?.user_id;
            const curr = readFromStorage();
            console.log(
              "[SIO] Checking if event is for current user. Event uid:",
              uid,
              "Current user id:",
              curr?.id,
            );
            if (curr && curr.id && uid === curr.id) {
              console.log(
                "[SIO] ✓ Event IS for current user",
                uid,
                "- TRIGGERING refresh permissions",
              );
              // Dispatch the refresh event to trigger permission updates
              window.dispatchEvent(new CustomEvent("auth:refresh"));
            } else {
              console.log(
                "[SIO] ⚠️  Event is NOT for current user. Event uid:",
                uid,
                "curr.id:",
                curr?.id,
              );
            }
          } catch (e) {
            console.error("[SIO] auth:refresh handler error", e);
          }
        });
      } catch (e) {
        console.error("[SIO] ✗ Socket setup error:", e);
      }
      return socket;
    };

    // Await socket setup to ensure it's ready before listening for refresh
    setupSocket().catch((err) => {
      console.error("[SIO] Failed to setup socket:", err);
    });

    // Periodic socket re-identification attempt for Auth0 users
    const socketReidentifyInterval = setInterval(() => {
      if (!mounted) return;
      try {
        const s = (window as any).__APP_SOCK__;
        const curr = readFromStorage();
        if (
          s &&
          curr &&
          curr.id &&
          s.connected &&
          socketIdentifyAttempts < maxIdentifyAttempts
        ) {
          socketIdentifyAttempts++;
          console.debug(
            `[SIO] Re-identifying socket for Auth0 user ${curr.id} (attempt ${socketIdentifyAttempts}/${maxIdentifyAttempts})`,
          );
          s.emit("identify", { user_id: curr.id });
        }
      } catch (e) {
        console.debug("[SIO] Socket re-identify check error:", e);
      }
    }, 2000); // Try every 2 seconds (max 10 seconds total)

    const refresh = async () => {
      try {
        if (!mounted) return;
        const current = readFromStorage();
        if (!current || !current.id) return;
        console.debug("[AUTH] ⟳ Refreshing user data for id", current.id);
        console.debug(
          "[AUTH] Current bi_subcategories before refresh:",
          current.bi_subcategories,
        );
        permissionDebugger.log(
          "api",
          `Fetching updated user data from /api/usuarios/${current.id}`,
        );

        const res = await fetch(`/api/usuarios/${current.id}`);
        if (!res.ok) {
          console.debug("[AUTH] ✗ Refresh failed with status", res.status);
          permissionDebugger.log("api", "❌ API call failed", {
            status: res.status,
          });
          return;
        }
        const data = await res.json();
        console.debug(
          "[AUTH] ✓ Refresh response bi_subcategories:",
          data.bi_subcategories,
        );
        const now = Date.now();
        const oldSetores = (current.setores || []).slice().sort();
        const newSetores = (Array.isArray(data.setores) ? data.setores : [])
          .slice()
          .sort();

        // Deep comparison of setores
        const setoresChanged =
          JSON.stringify(oldSetores) !== JSON.stringify(newSetores);

        // Also check nivel_acesso
        const nivelChanged = current.nivel_acesso !== data.nivel_acesso;

        if (setoresChanged) {
          console.log(
            "[AUTH] ✓ SETORES CHANGED:",
            oldSetores.join(", "),
            "→",
            newSetores.join(", "),
          );
          permissionDebugger.log(
            "state",
            `✓ Setores CHANGED: ${oldSetores.join(", ")} → ${newSetores.join(", ")}`,
          );
        }

        if (nivelChanged) {
          console.log(
            "[AUTH] ✓ NIVEL_ACESSO CHANGED:",
            current.nivel_acesso,
            "→",
            data.nivel_acesso,
          );
          permissionDebugger.log(
            "state",
            `✓ Nivel acesso CHANGED: ${current.nivel_acesso} → ${data.nivel_acesso}`,
          );
        }

        // Check for bi_subcategories changes
        const oldBiSubcategories = current.bi_subcategories || null;
        const newBiSubcategories = Array.isArray(data.bi_subcategories)
          ? data.bi_subcategories
          : null;
        const biSubcategoriesChanged =
          JSON.stringify(
            oldBiSubcategories ? oldBiSubcategories.slice().sort() : null,
          ) !==
          JSON.stringify(
            newBiSubcategories ? newBiSubcategories.slice().sort() : null,
          );

        console.debug("[AUTH] BI Subcategories comparison:", {
          old: oldBiSubcategories,
          new: newBiSubcategories,
          changed: biSubcategoriesChanged,
        });

        if (biSubcategoriesChanged) {
          console.log(
            "[AUTH] ✓ BI_SUBCATEGORIES CHANGED:",
            oldBiSubcategories.join(", "),
            "→",
            newBiSubcategories.join(", "),
          );
          permissionDebugger.log(
            "state",
            `✓ BI Subcategories CHANGED: ${oldBiSubcategories.join(", ")} → ${newBiSubcategories.join(", ")}`,
          );
        }

        if (!setoresChanged && !nivelChanged && !biSubcategoriesChanged) {
          console.debug("[AUTH] ℹ No permission changes detected");
          permissionDebugger.log("api", "ℹ No changes in permissions");
          return; // Early exit - no need to update state or storage
        }

        const base: AuthUser = {
          id: data.id,
          email: data.email,
          name: `${data.nome} ${data.sobrenome}`,
          nivel_acesso: data.nivel_acesso,
          setores: newSetores,
          bi_subcategories: newBiSubcategories,
          loginTime: now,
          alterar_senha_primeiro_acesso: !!data.alterar_senha_primeiro_acesso,
        };
        const record: AuthRecord = {
          ...base,
          expiresAt: now + SESSION_EXPIRY,
        };
        console.debug(
          "[AUTH] ✓ Updating user state with new data (permissions changed)",
          { bi_subcategories: newBiSubcategories },
        );
        setUser(base);

        try {
          console.debug("[AUTH] Updating sessionStorage with new data");
          const recordJson = JSON.stringify(record);
          sessionStorage.setItem(AUTH_KEY, recordJson);
          console.debug("[AUTH] ✓ sessionStorage updated, verifying...");
          const verify = sessionStorage.getItem(AUTH_KEY);
          if (verify) {
            const verified = JSON.parse(verify);
            console.debug("[AUTH] ✓ Verified in sessionStorage:", {
              bi_subcategories: verified.bi_subcategories,
            });
          }
        } catch (e) {
          console.error("[AUTH] Failed to update sessionStorage:", e);
        }

        // re-identify socket on refresh
        try {
          const s = (window as any).__APP_SOCK__;
          if (s && s.connected && base.id) {
            console.debug("[AUTH] Re-identifying socket after refresh");
            s.emit("identify", { user_id: base.id });
          }
        } catch (e) {
          console.debug("[AUTH] Socket re-identify failed:", e);
        }

        // Force a secondary dispatch to ensure all listeners get notified
        if (setoresChanged || nivelChanged) {
          console.debug(
            "[AUTH] Dispatching 'user:data-updated' event for UI re-render",
          );
          window.dispatchEvent(
            new CustomEvent("user:data-updated", {
              detail: {
                changed: {
                  setores: setoresChanged,
                  nivel_acesso: nivelChanged,
                },
              },
            }),
          );
        }
      } catch (err) {
        console.error("[AUTH] ✗ Refresh error:", err);
        permissionDebugger.log("api", `❌ Refresh failed: ${err}`, err);
      }
    };

    const handleAuthRefresh = (e: Event) => {
      console.debug(
        "[AUTH] ⚡ auth:refresh event received - IMMEDIATE refresh (no delay)",
      );
      // Refresh IMMEDIATELY without any delay - this is the main refresh trigger
      console.debug("[AUTH] Calling refresh() synchronously...");
      refresh().catch((err) => {
        console.error("[AUTH] auth:refresh handler error:", err);
      });
    };

    const handleUsersChanged = (e: Event) => {
      console.debug("[AUTH] 👥 users:changed event received");
      // Trigger immediate refresh
      refresh().catch((err) => {
        console.error("[AUTH] users:changed handler error:", err);
      });
    };

    const handleUserUpdated = (e: Event) => {
      console.debug(
        "[AUTH] 👤 user:updated event received - IMMEDIATE refresh",
      );
      // Trigger immediate refresh
      refresh().catch((err) => {
        console.error("[AUTH] user:updated handler error:", err);
      });
    };

    window.addEventListener("auth:refresh", handleAuthRefresh as EventListener);
    window.addEventListener(
      "users:changed",
      handleUsersChanged as EventListener,
    );
    window.addEventListener("user:updated", handleUserUpdated as EventListener);

    // If __auth_needs_refresh__ flag is set (from login), call refresh immediately
    if (needsRefresh === "true") {
      console.debug(
        "[AUTH] 🔄 __auth_needs_refresh__ flag detected - calling refresh() immediately",
      );
      sessionStorage.removeItem("__auth_needs_refresh__"); // Clear the flag
      // Call refresh asynchronously to avoid blocking
      setTimeout(() => {
        if (mounted) {
          refresh().catch((err) => {
            console.error("[AUTH] Initial refresh failed:", err);
          });
        }
      }, 50); // Small delay to ensure socket setup is complete
    }

    // Polling fallback: periodically check for permission updates (every 30 seconds)
    // This is a safety net only - real updates come from Socket.IO events
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    const setupPolling = () => {
      if (pollInterval) clearInterval(pollInterval);
      console.debug(
        "[AUTH] Setting up polling fallback (30s interval, event-driven preferred)",
      );
      pollInterval = setInterval(() => {
        if (mounted) {
          // Silent poll - don't spam console
          refresh().catch(() => {});
        }
      }, 30000);
    };

    setupPolling();

    return () => {
      mounted = false;
      if (pollInterval) clearInterval(pollInterval);
      clearInterval(socketReidentifyInterval);
      window.removeEventListener(
        "auth:refresh",
        handleAuthRefresh as EventListener,
      );
      window.removeEventListener(
        "users:changed",
        handleUsersChanged as EventListener,
      );
      window.removeEventListener(
        "user:updated",
        handleUserUpdated as EventListener,
      );
      // do not disconnect socket here - keep global alive
    };
  }, []);

  const login = async (identifier: string, password: string) => {
    try {
      const res = await fetch("/api/usuarios/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, senha: password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}) as any);
        throw new Error(
          (err && (err.detail || err.message)) || "Falha ao autenticar",
        );
      }
      const data = await res.json();
      const now = Date.now();
      const base: AuthUser = {
        id: data.id,
        email: data.email,
        name: `${data.nome} ${data.sobrenome}`,
        nivel_acesso: data.nivel_acesso,
        setores: Array.isArray(data.setores) ? data.setores : [],
        bi_subcategories: Array.isArray(data.bi_subcategories)
          ? data.bi_subcategories
          : null,
        loginTime: now,
        // include flag
        alterar_senha_primeiro_acesso: !!data.alterar_senha_primeiro_acesso,
      };
      const record: AuthRecord = {
        ...base,
        expiresAt: now + SESSION_EXPIRY,
      };
      setUser(base);
      try {
        const payload = JSON.stringify(record);
        sessionStorage.setItem(AUTH_KEY, payload);
      } catch {}
      // identify socket if present
      try {
        const s = (window as any).__APP_SOCK__;
        if (s && s.connected && base.id)
          s.emit("identify", { user_id: base.id });
      } catch (e) {}
      // return full server data for immediate decisions
      return data;
    } catch (err) {
      throw err;
    }
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem(AUTH_KEY);
  };

  const isAuthenticated = !!user;

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
  };
}
