import { useEffect, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { shouldShowAlertOnPage } from "@/config/alert-pages";
import { useAuthContext } from "@/lib/auth-context";

const severityConfig = {
  low: {
    gradient: "from-blue-500/20 via-blue-600/10 to-transparent",
    accentColor: "bg-blue-500",
    buttonHover: "hover:bg-blue-600",
  },
  medium: {
    gradient: "from-yellow-500/20 via-yellow-600/10 to-transparent",
    accentColor: "bg-yellow-500",
    buttonHover: "hover:bg-yellow-600",
  },
  high: {
    gradient: "from-orange-500/20 via-orange-600/10 to-transparent",
    accentColor: "bg-orange-500",
    buttonHover: "hover:bg-orange-600",
  },
  critical: {
    gradient: "from-red-500/20 via-red-600/10 to-transparent",
    accentColor: "bg-red-500",
    buttonHover: "hover:bg-red-600",
  },
};

function EvoqueLogo() {
  return (
    <div className="relative">
      <div className="absolute inset-0 bg-orange-500/30 blur-3xl rounded-full animate-pulse scale-150" />

      <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 p-1 shadow-2xl">
        <div className="w-full h-full rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
          <svg
            className="w-14 h-14 text-white"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M20.57 14.86L22 13.43L20.57 12L17 15.57L8.43 7L12 3.43L10.57 2L9.14 3.43L7.71 2L5.57 4.14L4.14 2.71L2.71 4.14L4.14 5.57L2 7.71L3.43 9.14L2 10.57L3.43 12L7 8.43L15.57 17L12 20.57L13.43 22L14.86 20.57L16.29 22L18.43 19.86L19.86 21.29L21.29 19.86L19.86 18.43L22 16.29L20.57 14.86Z"
              fill="currentColor"
            />
          </svg>
        </div>
      </div>

      <div className="absolute inset-0 rounded-full animate-ping">
        <div className="w-full h-full rounded-full border-2 border-orange-400/50" />
      </div>
    </div>
  );
}

export default function AlertDisplay() {
  const location = useLocation();
  const { user } = useAuthContext();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const markedAsViewedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    loadAlerts();
    const dismissed = sessionStorage.getItem("dismissedAlerts");
    if (dismissed) {
      try {
        setDismissedAlerts(JSON.parse(dismissed));
      } catch (e) {
        console.error("Erro ao parsear alertas dismissados:", e);
      }
    }
  }, []);

  const loadAlerts = async () => {
    try {
      const res = await apiFetch("/alerts");
      if (res.ok) {
        const data = await res.json();
        setAlerts(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Erro ao carregar alertas:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAlertAsViewed = async (alertId: number) => {
    if (markedAsViewedRef.current.has(alertId)) return;

    try {
      // Extract name parts from user data
      const usuarioId = user?.email || "anonymous";
      const usuarioEmail = user?.email || "anonymous";

      // Use firstName if available, otherwise try to extract from name, fallback to email username
      let usuarioNome = user?.firstName || "";
      if (!usuarioNome && user?.name) {
        // Try to extract first name from full name
        const nameParts = user.name.trim().split(/\s+/);
        usuarioNome = nameParts[0] || "";
      }
      if (!usuarioNome) {
        usuarioNome = usuarioEmail.split("@")[0];
      }

      // Use lastName if available, otherwise try to extract from name
      let usuarioSobrenome = user?.lastName || "";
      if (!usuarioSobrenome && user?.name) {
        // Try to extract last name from full name
        const nameParts = user.name.trim().split(/\s+/);
        if (nameParts.length > 1) {
          usuarioSobrenome = nameParts[nameParts.length - 1];
        }
      }

      await apiFetch(`/alerts/${alertId}/visualizar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario_id: usuarioId,
          usuario_email: usuarioEmail,
          usuario_nome: usuarioNome,
          usuario_sobrenome: usuarioSobrenome,
        }),
      });
      markedAsViewedRef.current.add(alertId);
    } catch (error) {
      console.error("Erro ao marcar alerta como visualizado:", error);
    }
  };

  const dismissAlert = (alertId: number) => {
    const newDismissed = [...dismissedAlerts, alertId];
    setDismissedAlerts(newDismissed);
    sessionStorage.setItem("dismissedAlerts", JSON.stringify(newDismissed));
    markAlertAsViewed(alertId);
  };

  const handleEntendido = (alertId: number) => {
    dismissAlert(alertId);
  };

  const visibleAlerts = alerts.filter((alert) => {
    if (dismissedAlerts.includes(alert.id)) return false;

    let alertPages: string[] | null = null;
    if (alert.pages) {
      try {
        alertPages = Array.isArray(alert.pages)
          ? alert.pages
          : JSON.parse(alert.pages);
      } catch (e) {
        alertPages = null;
      }
    }

    return shouldShowAlertOnPage(alertPages, location.pathname);
  });

  const currentAlert = visibleAlerts[0];

  useEffect(() => {
    if (currentAlert?.id && user) {
      markAlertAsViewed(currentAlert.id);
    }
  }, [currentAlert?.id, user]);

  if (loading || !currentAlert) return null;

  const severity =
    (currentAlert.severity as keyof typeof severityConfig) || "low";
  const config = severityConfig[severity];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-[400px] aspect-[9/16] animate-in zoom-in-95 fade-in duration-300">
        <div className="relative w-full h-full rounded-3xl overflow-hidden shadow-2xl">
          {currentAlert.imagem_blob ? (
            <div className="absolute inset-0">
              <img
                src={`data:${currentAlert.imagem_mime_type || "image/jpeg"};base64,${currentAlert.imagem_blob}`}
                alt="Alerta"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-black/90" />
            </div>
          ) : (
            <>
              <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-black" />
              <div
                className={`absolute inset-0 bg-gradient-to-t ${config.gradient}`}
              />
            </>
          )}

          <div className="relative h-full flex flex-col p-6">
            <div className="space-y-3">
              <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full w-full bg-white/80 rounded-full" />
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center">
              <EvoqueLogo />

              <div className="mt-8 space-y-4 text-center">
                <h2 className="text-2xl font-bold text-white leading-tight">
                  {currentAlert.title}
                </h2>

                {currentAlert.message && (
                  <p className="text-sm text-white/90 leading-relaxed px-4">
                    {currentAlert.message}
                  </p>
                )}

                {currentAlert.description && (
                  <p className="text-xs text-white/70 leading-relaxed px-4">
                    {currentAlert.description}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => handleEntendido(currentAlert.id)}
                className={`
                  w-full py-3 rounded-full
                  ${config.accentColor} ${config.buttonHover}
                  text-white font-semibold
                  transition-all duration-200 transform hover:scale-105
                  shadow-lg
                `}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
