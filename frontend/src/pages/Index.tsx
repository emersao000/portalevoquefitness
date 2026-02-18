import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { sectors } from "@/data/sectors";
import { ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuthContext } from "@/lib/auth-context";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

export default function Index() {
  const { user } = useAuthContext();
  const [, setTick] = useState(0);
  const [showPermissionUpdate, setShowPermissionUpdate] = useState(false);

  useEffect(() => {
    const handler = () => {
      console.debug("[INDEX] Permission update detected (auth:refresh)");
      setTick((t) => t + 1);
      // Show a brief notification when permissions are updated
      setShowPermissionUpdate(true);
      setTimeout(() => setShowPermissionUpdate(false), 3000);
    };

    const userDataHandler = () => {
      console.debug("[INDEX] Permission update detected (user:data-updated)");
      setTick((t) => t + 1);
      setShowPermissionUpdate(true);
      setTimeout(() => setShowPermissionUpdate(false), 3000);
    };

    window.addEventListener("auth:refresh", handler as EventListener);
    window.addEventListener(
      "user:data-updated",
      userDataHandler as EventListener,
    );
    window.addEventListener("users:changed", handler as EventListener);

    return () => {
      window.removeEventListener("auth:refresh", handler as EventListener);
      window.removeEventListener(
        "user:data-updated",
        userDataHandler as EventListener,
      );
      window.removeEventListener("users:changed", handler as EventListener);
    };
  }, []);

  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await apiFetch("/alerts");
        if (res.ok) {
          const data = await res.json();
          if (mounted && Array.isArray(data)) setAlerts(data);
        }
      } catch (e) {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const dismissed =
    typeof window !== "undefined"
      ? (JSON.parse(
          sessionStorage.getItem("dismissedAlerts") || "[]",
        ) as number[])
      : [];
  const dismiss = (id: number) => {
    try {
      const arr = JSON.parse(
        sessionStorage.getItem("dismissedAlerts") || "[]",
      ) as number[];
      if (!Array.isArray(arr)) {
        sessionStorage.setItem("dismissedAlerts", JSON.stringify([id]));
      } else {
        if (!arr.includes(id)) arr.push(id);
        sessionStorage.setItem("dismissedAlerts", JSON.stringify(arr));
      }
    } catch {
      sessionStorage.setItem("dismissedAlerts", JSON.stringify([id]));
    }
    setAlerts((cur) => cur.filter((a) => a.id !== id));
  };

  const normalize = (s: any) =>
    typeof s === "string"
      ? s
          .normalize("NFKD")
          .replace(/\p{Diacritic}/gu, "")
          .toLowerCase()
      : s;
  const slugToKey: Record<string, string> = {
    ti: "Portal de TI",
    manutencao: "Portal de Manutenção",
    bi: "Portal de BI",
    financeiro: "Portal Financeiro",
  };
  const canAccess = (slug: string) => {
    if (!user) return false;
    if (user.nivel_acesso === "Administrador") return true;
    const required = slugToKey[slug];
    if (!required) return false;
    const req = normalize(required);
    const arr = Array.isArray(user.setores) ? user.setores.map(normalize) : [];
    return arr.some(
      (s) => s && (s === req || s.includes(req) || req.includes(s)),
    );
  };

  return (
    <Layout>
      {/* Permission update indicator */}
      {showPermissionUpdate && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-green-50 border border-green-300 rounded-lg px-4 py-3 text-sm text-green-800 shadow-md animate-in fade-in slide-in-from-top-2 duration-300">
          ✓ Suas permissões foram atualizadas!
        </div>
      )}

      {/* Hero Section */}
      <section className="relative overflow-hidden py-8 sm:py-12">
        <div className="container relative z-10">
          <div className="rounded-3xl brand-gradient px-8 sm:px-12 py-12 sm:py-16 shadow-2xl border border-white/20 backdrop-blur-sm overflow-hidden">
            <div className="relative z-10 text-center max-w-2xl mx-auto">
              {/* Main heading */}
              <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-primary-foreground mb-3 drop-shadow-lg">
                Portal Evoque
              </h1>

              {/* Subtitle */}
              <p className="text-base sm:text-lg text-primary-foreground/90 mb-7">
                Acesse seus setores e gerencie suas operações com facilidade
              </p>

              {/* CTA Button */}
              <div className="flex items-center justify-center">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="rounded-full bg-white text-primary hover:bg-white/90 shadow-xl hover:shadow-2xl transition-all duration-300 font-bold px-9 h-12 text-base">
                      Escolher portal <ChevronDown className="size-6 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" className="w-40">
                    {sectors.map((s) => {
                      const allowed = canAccess(s.slug);
                      const isFinanceiro = s.slug === "financeiro";

                      const handleClick = (e: React.MouseEvent) => {
                        if (isFinanceiro) {
                          e.preventDefault();
                          window.open("https://portalfinanceiro.cloud/", "_blank");
                        }
                      };

                      const href = isFinanceiro
                        ? "#"
                        : user
                          ? `/setor/${s.slug}`
                          : `/auth0/login?redirect=/setor/${s.slug}`;

                      return (
                        <Link
                          key={s.slug}
                          to={href}
                          onClick={handleClick}
                        >
                          <DropdownMenuItem
                            className={`cursor-pointer text-sm transition-all ${
                              !user || allowed
                                ? ""
                                : "opacity-50 pointer-events-none"
                            }`}
                          >
                            <s.icon className="w-3 h-3 mr-2" />
                            {s.title}
                          </DropdownMenuItem>
                        </Link>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sectors Grid Section */}
      <section id="setores" className="relative flex-1 py-5 sm:py-7">
        {/* Decorative background */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Gradient background */}
          <div className="absolute inset-0 bg-gradient-to-b from-muted/40 via-muted/20 to-background" />

          {/* Floating elements */}
          <div className="absolute top-1/2 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2" />
          <div className="absolute top-1/3 left-0 w-80 h-80 bg-accent/5 rounded-full blur-3xl" />

          {/* Grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
                               linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)`,
              backgroundSize: "64px 64px",
            }}
          />
        </div>

        <div className="container relative z-10">
          {/* Section Header */}
          <div className="text-center mb-5 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-bold mb-1 text-foreground">
              Nossos Setores
            </h2>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
            {sectors.map((s, idx) => {
              const allowed = canAccess(s.slug);
              const isFinanceiro = s.slug === "financeiro";

              const handleClick = (e: React.MouseEvent) => {
                if (isFinanceiro) {
                  e.preventDefault();
                  window.open("https://portalfinanceiro.cloud/", "_blank");
                }
              };

              const href = isFinanceiro
                ? "#"
                : user
                  ? `/setor/${s.slug}`
                  : `/auth0/login?redirect=/setor/${s.slug}`;

              return (
                <Link
                  to={href}
                  onClick={handleClick}
                  key={s.slug}
                  className={`group relative ${
                    user && !allowed
                      ? "opacity-50 pointer-events-none cursor-not-allowed"
                      : "cursor-pointer"
                  }`}
                >
                  <div
                    className={`card-surface rounded-2xl p-6 sm:p-7 h-full transition-all duration-300 border border-border/60 hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring overflow-hidden relative hover:shadow-lg hover:-translate-y-1 backdrop-blur-sm bg-background/60 flex flex-col`}
                    aria-disabled={user ? String(!allowed) : undefined}
                  >
                    {/* Gradient overlay on hover */}
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                    {/* Content */}
                    <div className="relative z-10 flex flex-col flex-1">
                      {/* Icon Container */}
                      <div className="inline-flex items-center justify-center w-14 h-14 bg-primary/10 rounded-xl mb-4 group-hover:bg-primary/20 transition-all duration-300 group-hover:scale-110">
                        <s.icon className="w-7 h-7 text-primary" />
                      </div>

                      {/* Text Content */}
                      <h3 className="font-bold text-base text-foreground mb-2 group-hover:text-primary transition-colors duration-300 flex-1">
                        {s.title}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                        {s.description}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </Layout>
  );
}
