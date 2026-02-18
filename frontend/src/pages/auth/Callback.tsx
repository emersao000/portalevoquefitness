import { useEffect, useState } from "react";
import { useAuthContext } from "@/lib/auth-context";

export default function Callback() {
  const { isLoading, isAuthenticated } = useAuthContext();
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    console.log("[CALLBACK] isLoading:", isLoading);
    console.log("[CALLBACK] isAuthenticated:", isAuthenticated);
    console.log("[CALLBACK] Mounted at:", new Date().toISOString());
  }, [isLoading, isAuthenticated]);

  useEffect(() => {
    // Track elapsed time
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);

    // Show error after 15 seconds of loading
    if (isLoading && elapsed > 15) {
      setError(
        "Login está demorando muito. Verifique sua conexão e tente novamente.",
      );
    }

    return () => clearInterval(interval);
  }, [isLoading, elapsed]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center max-w-md">
          <div className="text-red-500 mb-4 text-2xl">⚠️</div>
          <p className="text-muted-foreground font-medium mb-2">{error}</p>
          <a
            href="/auth0/login"
            className="text-primary hover:underline text-sm"
          >
            Voltar para login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground font-medium">
          {isLoading ? "Autenticando..." : "Redirecionando..."}
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Aguarde enquanto processamos seu login
        </p>
        {elapsed > 5 && (
          <p className="text-xs text-muted-foreground mt-4">
            (Processando há {elapsed}s)
          </p>
        )}
      </div>
    </div>
  );
}
