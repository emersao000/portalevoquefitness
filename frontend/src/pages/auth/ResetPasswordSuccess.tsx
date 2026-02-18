import { Button } from "@/components/ui/button";
import { Link, useLocation } from "react-router-dom";
import { CheckCircle, Mail, ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import LoginMediaPanel from "./components/LoginMediaPanel";

export default function ResetPasswordSuccess() {
  const location = useLocation();
  const email = location.state?.email || "";
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
          {/* Card de Sucesso */}
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

            {/* Ícone de sucesso */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-green-500/20 rounded-full blur-xl animate-pulse" />
                <div className="relative h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center border-2 border-green-500/20">
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
              </div>
            </div>

            {/* Título */}
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold mb-2">
                E-mail enviado com sucesso!
              </h2>
              <p className="text-sm text-muted-foreground">
                Enviamos instruções para recuperação da senha
              </p>
            </div>

            {/* E-mail */}
            {email && (
              <div className="flex items-center justify-center gap-2 mb-6 p-3 bg-secondary/50 rounded-lg border border-primary/10">
                <Mail className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{email}</span>
              </div>
            )}

            {/* Instruções */}
            <div className="mb-6 p-4 bg-secondary/30 rounded-lg border border-border/50">
              <p className="text-sm font-semibold mb-3 text-center">
                Próximos passos:
              </p>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex-shrink-0 mt-0.5">
                    1
                  </span>
                  <span>
                    Verifique sua caixa de entrada (incluindo spam/lixo
                    eletrônico)
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex-shrink-0 mt-0.5">
                    2
                  </span>
                  <span>Clique no link de recuperação enviado por e-mail</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex-shrink-0 mt-0.5">
                    3
                  </span>
                  <span>Crie uma nova senha segura para sua conta</span>
                </li>
              </ul>
            </div>

            {/* Botão principal */}
            <Button asChild className="w-full h-11 rounded-md mb-4 group">
              <Link to="/auth0/login">
                <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-1 transition-transform" />
                Voltar ao login
              </Link>
            </Button>

            {/* Link secundário */}
            <div className="text-center pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                Não recebeu o e-mail?{" "}
                <Link
                  to="/auth/forgot-password"
                  className="text-primary hover:underline font-medium"
                >
                  Reenviar instruções
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
