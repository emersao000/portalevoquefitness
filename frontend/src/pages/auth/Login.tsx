import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useAuthContext } from "@/lib/auth-context";
import LoginMediaPanel from "./components/LoginMediaPanel";
import { Shield, Zap, Clock, LogIn, AlertCircle } from "lucide-react";

export default function Login() {
  const { loginWithAuth0 } = useAuthContext();
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleAuth0Login = async () => {
    setIsLoading(true);
    try {
      await loginWithAuth0();
    } catch (error) {
      console.error("Erro ao fazer login com Auth0:", error);
      alert("Erro ao conectar com Auth0. Tente novamente.");
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-[100svh] w-full flex items-center justify-center overflow-hidden bg-background">
      {/* Fundo com mídia */}
      <LoginMediaPanel />

      {/* Conteúdo principal */}
      <div className="relative z-10 w-full h-screen flex items-center justify-center p-6 md:p-10">
        <div
          className={`w-full max-w-[480px] transition-all duration-1000 ${
            mounted ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
        >
          {/* Card de Login */}
          <div className="card-surface rounded-xl p-6 sm:p-8 shadow-2xl border">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-lg animate-pulse" />
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-lg animate-pulse" />
                    <img
                      src="https://cdn.builder.io/api/v1/image/assets%2Fc058bc7e5321459bb9ba0a18864af86b%2F588314690bed41a1941b42dd66b3efca?format=webp&width=800"
                      alt="Central de suporte"
                      className="w-12 h-12 object-contain"
                    />
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">
                    Bem vindo (a)
                  </h1>
                  <p className="text-sm text-primary font-medium">
                    Faça login
                  </p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed">
                Faça login para acessar seus portais e gerenciar suas operações
                com segurança.
              </p>
            </div>

            {/* Auth0 Login Button */}
            <Button
              onClick={handleAuth0Login}
              disabled={isLoading}
              className="w-full h-11 rounded-md mb-4 bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center justify-center gap-2 group"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Conectando...</span>
                </div>
              ) : (
                <>
                  <img
                    src="https://cdn.builder.io/api/v1/image/assets%2Faa9e931ad59b462c9cf6adb1ab6191c2%2F3403c2d4318f49d29f5d270b18089327?format=webp&width=800"
                    alt="Auth0"
                    className="w-4 h-4 object-contain"
                  />
                  <span>Entrar com e-mail corporativo</span>
                  <LogIn className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </Button>

            {/* Alerta de mudança */}
            <div className="flex gap-3 p-4 rounded-lg bg-blue-50 border border-blue-200">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900 mb-1">
                  Autenticação com Auth0
                </p>
                <p className="text-xs text-blue-800 leading-relaxed">
                  O acesso ao portal agora é realizado através do Auth0. Utilize
                  suas credenciais cadastradas no sistema para fazer login.
                </p>
              </div>
            </div>

            {/* Features */}
            <div className="mt-6 pt-6 border-t">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: Shield, label: "Seguro" },
                  { icon: Zap, label: "Rápido" },
                  { icon: Clock, label: "24/7" },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex flex-col items-center gap-2 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                  >
                    <item.icon className="w-5 h-5 text-primary" />
                    <span className="text-xs text-muted-foreground font-medium">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 pt-6 border-t">
              <p className="text-xs text-muted-foreground text-center">
                © {new Date().getFullYear()} Portal Evoque — Sistema interno
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
