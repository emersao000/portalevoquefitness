import { useEffect, useState } from "react";
import { useLocation, Navigate } from "react-router-dom";
import { useAuthContext } from "@/lib/auth-context";

export default function RequireLogin({
  children,
}: {
  children: React.ReactNode;
}) {
  const location = useLocation();
  const { isAuthenticated, isLoading, user, logout } = useAuthContext();
  const [remoteUser, setRemoteUser] = useState<any | null>(null);
  const [checking, setChecking] = useState(false);

  // Permitir bypass temporário (para navegação após login)
  const bypassGate = location.state?.bypassGate;
  const pathname = location.pathname || "";

  // Only fetch remote user when the user navigates into a sector route or when explicit events occur.
  useEffect(() => {
    let mounted = true;
    let abort = false;

    const shouldCheckNow = () => {
      // Only check when entering sector pages or when there is an explicit event
      return pathname.startsWith("/setor/");
    };

    const fetchRemote = async () => {
      if (!isAuthenticated || !user?.id) return;
      // Administrators don't need remote validation
      if (user?.nivel_acesso === "Administrador") {
        if (mounted) {
          setRemoteUser(null);
          setChecking(false);
        }
        return;
      }

      try {
        if (mounted && !remoteUser) setChecking(true);
        const res = await fetch(`/api/usuarios/${user.id}`);
        if (!res.ok) {
          if (mounted) setRemoteUser(null);
          return;
        }
        const data = await res.json();
        if (mounted && !abort) setRemoteUser(data);
      } catch (e) {
        if (mounted && !abort) setRemoteUser(null);
      } finally {
        if (mounted && !abort) setChecking(false);
      }
    };

    // If we're on a sector route, perform the check once.
    if (shouldCheckNow()) fetchRemote();

    // Listen to global events that should revalidate permissions on demand
    const onUsersChanged = () => {
      console.debug(
        "[REQUIRE_LOGIN] Event triggered, checking if should refresh permissions",
      );
      // Revalidate if on sector route or immediately
      if (shouldCheckNow()) {
        console.debug(
          "[REQUIRE_LOGIN] Fetching remote user to sync permissions",
        );
        fetchRemote();
      }
    };

    // Also listen to socket-level auth:refresh for faster sync
    const onAuthRefresh = () => {
      console.debug(
        "[REQUIRE_LOGIN] auth:refresh received, syncing permissions",
      );
      if (shouldCheckNow()) fetchRemote();
    };

    window.addEventListener("users:changed", onUsersChanged as EventListener);
    window.addEventListener("auth:refresh", onAuthRefresh as EventListener);

    return () => {
      mounted = false;
      abort = true;
      window.removeEventListener(
        "users:changed",
        onUsersChanged as EventListener,
      );
      window.removeEventListener(
        "auth:refresh",
        onAuthRefresh as EventListener,
      );
    };
    // Intentionally include pathname so checks run when navigating to sector pages
  }, [isAuthenticated, user?.id, pathname]);

  // Mostrar loading enquanto verifica autenticação inicial
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 bg-primary rounded-lg mx-auto mb-4 animate-pulse"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // Use remoteUser if available, else fallback to local user
  const effectiveUser = remoteUser || user;

  // If server marked session revoked after the current loginTime, force local logout
  try {
    if (remoteUser && user && remoteUser.session_revoked_at) {
      const revokedTs = Date.parse(remoteUser.session_revoked_at);
      if (!isNaN(revokedTs) && revokedTs > (user.loginTime || 0)) {
        // force logout and redirect to login
        logout();
        const redirect = location.pathname + location.search;
        return (
          <Navigate
            to={`/auth0/login?redirect=${encodeURIComponent(redirect)}`}
            replace
          />
        );
      }
    }
  } catch (e) {}

  // Additional authorization: block access to admin pages for non-admins and sectors
  // Admin routes: only Administrador
  if (
    pathname.startsWith("/setor/ti/admin") &&
    effectiveUser?.nivel_acesso !== "Administrador"
  ) {
    return <Navigate to="/access-denied" replace />;
  }

  // Sector-level access: /setor/:slug
  const sectorMatch = pathname.match(/^\/setor\/(?<slug>[^\/]+)(?:\/.*)?$/);
  if (sectorMatch && sectorMatch.groups) {
    const slug = sectorMatch.groups.slug;
    // Administrators have full access
    if (effectiveUser?.nivel_acesso === "Administrador") return <>{children}</>;

    // Map slug to normalized sector name (same mapping used in backend)
    const mapa: Record<string, string> = {
      ti: "Portal de TI",
      manutencao: "Portal de Manutenção",
      bi: "Portal de BI",
      financeiro: "Portal Financeiro",
      marketing: "Marketing",
      produtos: "Produtos",
      comercial: "Comercial",
      "outros-servicos": "Outros",
      servicos: "Outros",
    };
    const required = mapa[slug || ""];
    const normalize = (s: any) =>
      typeof s === "string"
        ? s
            .normalize("NFKD")
            .replace(/\p{Diacritic}/gu, "")
            .toLowerCase()
        : s;
    const userSectors = Array.isArray(effectiveUser?.setores)
      ? effectiveUser!.setores.map(normalize)
      : [];
    const reqNorm = normalize(required);
    const has = userSectors.some((s) => {
      if (!s || !reqNorm) return false;
      return (
        s === reqNorm ||
        s.includes(reqNorm) ||
        reqNorm.includes(s) ||
        s.split(" ").some((tok) => reqNorm.includes(tok)) ||
        reqNorm.split(" ").some((tok) => s.includes(tok))
      );
    });
    if (required && !has) {
      return <Navigate to="/access-denied" replace />;
    }
  }

  return (
    <>
      {/* Non-blocking checking indicator */}
      {checking && effectiveUser?.nivel_acesso !== "Administrador" && (
        <div className="fixed left-1/2 top-16 -translate-x-1/2 z-50 rounded-md bg-yellow-50 border border-yellow-200 px-4 py-2 text-sm text-yellow-800 shadow-sm">
          Verificando permissões...
        </div>
      )}
      {children}
    </>
  );
}
