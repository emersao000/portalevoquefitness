import React, { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";

interface AuthenticationHandlerProps {
  onAuthenticated: () => void;
  children: React.ReactNode;
}

export default function AuthenticationHandler({
  onAuthenticated,
  children,
}: AuthenticationHandlerProps) {
  const [status, setStatus] = useState<"loading" | "error" | "authenticated">(
    "loading",
  );
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    const authenticate = async () => {
      try {
        const response = await apiFetch("/powerbi/token");

        if (response.ok) {
          const data = await response.json();
          if (data.access_token) {
            console.log("✅ Token obtido com sucesso");
            if (isMounted) {
              setStatus("authenticated");
              onAuthenticated();
            }
            return;
          }
        }

        if (response.status >= 400 && response.status < 500) {
          console.warn("⚠️ Erro de autenticação, prosseguindo com autoAuth");
          if (isMounted) {
            setStatus("authenticated");
            onAuthenticated();
          }
          return;
        }

        throw new Error(`Erro: ${response.status}`);
      } catch (error) {
        if (isMounted) {
          const message =
            error instanceof Error ? error.message : "Falha ao autenticar";

          if (message.includes("fetch") || message.includes("ECONNREFUSED")) {
            console.warn("⚠️ Erro de rede, prosseguindo");
            setStatus("authenticated");
            onAuthenticated();
            return;
          }

          console.error("❌ Erro na autenticação:", message);
          setErrorMessage(message);
          setStatus("error");
        }
      }
    };

    authenticate();

    return () => {
      isMounted = false;
    };
  }, [onAuthenticated]);

  if (status === "authenticated") {
    return <>{children}</>;
  }

  return (
    <div className="bi-auth-container">
      <div className="bi-auth-content">
        {status === "loading" && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-base text-muted-foreground animate-pulse">
              Logando...
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-4">
            <div className="text-4xl">⚠️</div>
            <p className="text-base text-destructive font-medium">
              Erro ao autenticar
            </p>
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}
