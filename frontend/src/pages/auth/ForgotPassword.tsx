import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Mail } from "lucide-react";
import LoginMediaPanel from "./components/LoginMediaPanel";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simula envio do e-mail (substituir por integração real)
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Redireciona para página de sucesso
    navigate("/auth/reset-password-success", {
      state: { email },
      replace: true,
    });
  };

  return (
    <div className="relative min-h-[100svh] w-full overflow-hidden bg-background">
      {/* Fundo com mídia */}
      <div className="absolute inset-0">
        <LoginMediaPanel />
      </div>

      {/* Conteúdo principal */}
      <div className="relative z-10 w-full min-h-[100svh] flex items-center justify-center p-6 md:p-10">
        <div
          className={`w-full max-w-[480px] transition-all duration-1000 ${
            mounted ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
        >
          {/* Card de Recuperação */}
          <div className="card-surface rounded-xl p-6 sm:p-8 shadow-2xl border">
            {/* Header com logo */}
            <div className="mb-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-lg animate-pulse" />
                  <img
                    src="https://cdn.builder.io/api/v1/image/assets%2F9d3cd95728fb42ddb457587cf6bcb599%2F24cd0e1fefd74f0984a9fe08247241f1?format=webp&width=800"
                    alt="Central de suporte"
                    className="w-12 h-12 object-contain"
                  />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">
                    Central de suporte
                  </h1>
                  <p className="text-sm text-primary font-medium">
                    Sistema de Atendimento TI
                  </p>
                </div>
              </div>
            </div>

            {/* Título da página */}
            <div className="mb-6">
              <Link
                to="/auth0/login"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 group"
              >
                <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                Voltar ao login
              </Link>
              <h2 className="text-xl font-semibold mb-2">
                Esqueci minha senha
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Digite seu e-mail para receber instruções de recuperação de
                senha.
              </p>
            </div>

            {/* Formulário */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="pl-10 h-11"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 rounded-md mt-6"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    <span>Enviando...</span>
                  </div>
                ) : (
                  "Enviar instruções"
                )}
              </Button>
            </form>

            {/* Link voltar */}
            <div className="mt-6 pt-6 border-t text-center">
              <p className="text-sm text-muted-foreground">
                Lembrou da senha?{" "}
                <Link
                  to="/auth0/login"
                  className="text-primary hover:underline font-medium"
                >
                  Fazer login
                </Link>
              </p>
            </div>

            {/* Footer */}
            <div className="mt-6 pt-6 border-t">
              <p className="text-xs text-muted-foreground text-center">
                © {new Date().getFullYear()} Central de suporte TI — Sistema
                interno
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
