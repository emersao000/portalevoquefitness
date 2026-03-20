import { useState, FormEvent, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";
import LoginMediaPanel from "./components/LoginMediaPanel";

export default function ChangePassword() {
  const { user, logout } = useAuthContext();
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [senhaConfirm, setSenhaConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!user) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (senha.length < 6) return alert("Senha deve ter ao menos 6 caracteres");
    if (senha !== senhaConfirm) return alert("Senhas não conferem");
    setLoading(true);
    try {
      const res = await fetch(`/api/usuarios/${user.id}/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senha }),
      });
      if (!res.ok) {
        const t = await res.json().catch(() => ({}) as any);
        throw new Error(
          (t && (t.detail || t.message)) || "Falha ao alterar senha",
        );
      }
      alert("Senha alterada com sucesso. Faça login novamente.");
      logout();
      navigate("/auth0/login");
    } catch (err: any) {
      alert(err?.message || "Erro");
    } finally {
      setLoading(false);
    }
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
          {/* Card de Alteração de Senha */}
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
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-xl font-semibold">Alterar senha</h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Por segurança, você precisa alterar sua senha antes de
                continuar. Escolha uma senha forte com no mínimo 6 caracteres.
              </p>
            </div>

            {/* Formulário */}
            <form onSubmit={submit} className="space-y-4">
              {/* Nova senha */}
              <div className="grid gap-2">
                <Label htmlFor="senha">Nova senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="senha"
                    type={showPassword ? "text" : "password"}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="pl-10 pr-10 h-11"
                    required
                    disabled={loading}
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Confirmar senha */}
              <div className="grid gap-2">
                <Label htmlFor="senhaConfirm">Confirmar nova senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="senhaConfirm"
                    type={showPassword ? "text" : "password"}
                    value={senhaConfirm}
                    onChange={(e) => setSenhaConfirm(e.target.value)}
                    placeholder="Digite a senha novamente"
                    className="pl-10 h-11"
                    required
                    disabled={loading}
                    minLength={6}
                  />
                </div>
              </div>

              {/* Indicador de força da senha */}
              {senha && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    <div
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        senha.length >= 6 ? "bg-primary" : "bg-muted"
                      }`}
                    />
                    <div
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        senha.length >= 8 ? "bg-primary" : "bg-muted"
                      }`}
                    />
                    <div
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        senha.length >= 10 &&
                        /[A-Z]/.test(senha) &&
                        /[0-9]/.test(senha)
                          ? "bg-primary"
                          : "bg-muted"
                      }`}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {senha.length < 6
                      ? "Senha fraca"
                      : senha.length < 8
                        ? "Senha média"
                        : senha.length >= 10 &&
                            /[A-Z]/.test(senha) &&
                            /[0-9]/.test(senha)
                          ? "Senha forte"
                          : "Senha boa"}
                  </p>
                </div>
              )}

              {/* Botões */}
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    logout();
                    navigate("/login");
                  }}
                  disabled={loading}
                  className="flex-1 h-11 rounded-md"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 h-11 rounded-md"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                      <span>Salvando...</span>
                    </div>
                  ) : (
                    "Salvar senha"
                  )}
                </Button>
              </div>
            </form>

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
