import Layout from "@/components/layout/Layout";
import { Link, NavLink, Outlet } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Menu,
  LayoutDashboard,
  FileText,
  Users,
  Activity,
  Clock,
  Puzzle,
  Settings,
  ChevronRight,
  Zap,
  Inbox,
} from "lucide-react";
import NotificationBell from "./components/NotificationBell";

const iconMap = {
  "Visão geral": LayoutDashboard,
  "Gerenciar chamados": FileText,
  "Meus chamados": Inbox,
  "Gerenciar usuários": Users,
  Monitoramento: Activity,
  Histórico: Clock,
  Integrações: Puzzle,
  Configurações: Settings,
};

const groups = [
  {
    title: "Operação",
    description: "Gerencie chamados e usuários",
    color: "from-blue-500/10 to-cyan-500/10",
    borderColor: "border-blue-500/20",
    items: [
      {
        to: "/setor/ti/admin/overview",
        label: "Visão geral",
        icon: "LayoutDashboard",
      },
      {
        to: "/setor/ti/admin/chamados",
        label: "Gerenciar chamados",
        icon: "FileText",
      },
      {
        to: "/setor/ti/admin/meus-chamados",
        label: "Meus chamados",
        icon: "Inbox",
      },
      {
        to: "/setor/ti/admin/usuarios",
        label: "Gerenciar usuários",
        icon: "Users",
      },
    ],
  },
  {
    title: "Administração",
    description: "Configure e integre sistemas",
    color: "from-emerald-500/10 to-teal-500/10",
    borderColor: "border-emerald-500/20",
    items: [
      {
        to: "/setor/ti/admin/integracoes",
        label: "Integrações",
        icon: "Puzzle",
      },
      {
        to: "/setor/ti/admin/configuracoes",
        label: "Configurações",
        icon: "Settings",
      },
    ],
  },
];

export default function AdminLayout() {
  return (
    <Layout>
      {/* Header */}
      <section className="w-full border-b border-border/60">
        <div className="brand-gradient relative overflow-hidden">
          {/* Background pattern */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
                               linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)`,
              backgroundSize: "64px 64px",
            }}
          />

          <div className="container py-3 sm:py-4 relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full">
                  <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                  <span className="text-xs font-medium text-white">Sistema Ativo</span>
                </div>
                <h1 className="text-base sm:text-xl font-extrabold text-primary-foreground drop-shadow-lg">
                  Painel Administrativo — TI
                </h1>
              </div>
              <div>
                <NotificationBell />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container py-3 sm:py-4 grid grid-cols-1 md:grid-cols-[260px,1fr] gap-3 sm:gap-6 flex-1 min-h-0">
        {/* Sidebar Desktop */}
        <aside className="hidden md:block">
          <nav className="sticky top-24 space-y-4">
            {groups.map((group) => (
              <div
                key={group.title}
                className={`group/section rounded-2xl border ${group.borderColor} bg-gradient-to-br ${group.color} backdrop-blur-sm overflow-hidden transition-all duration-300 hover:border-opacity-50`}
              >
                {/* Section Header */}
                <div className="px-5 pt-5 pb-3 border-b border-white/5">
                  <h3 className="text-sm font-bold text-foreground mb-1">
                    {group.title}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {group.description}
                  </p>
                </div>

                {/* Menu Items */}
                <div className="px-2 py-3 space-y-1">
                  {group.items.map((item) => {
                    const Icon =
                      iconMap[item.label as keyof typeof iconMap] || FileText;
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                          `group/item flex items-center gap-3 px-4 py-3 mx-1 rounded-lg transition-all duration-200 ${
                            isActive
                              ? "bg-primary text-primary-foreground shadow-md"
                              : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <div
                              className={`flex-shrink-0 transition-all duration-200 ${
                                isActive
                                  ? "scale-110"
                                  : "group-hover/item:scale-110"
                              }`}
                            >
                              <Icon className="w-5 h-5" />
                            </div>
                            <span className="text-sm font-medium flex-1 truncate">
                              {item.label}
                            </span>
                            {isActive && (
                              <ChevronRight className="w-4 h-4 flex-shrink-0 ml-auto animate-in fade-in slide-in-from-left-2" />
                            )}
                          </>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <div className="min-w-0 flex flex-col">
          {/* Mobile menu */}
          <div className="mb-6 md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="secondary"
                  className="rounded-xl h-11 gap-2 border-border/60 hover:bg-muted/80 transition-all"
                >
                  <Menu className="size-4" />
                  <span>Menu de navegação</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[85%] sm:w-[350px] p-0">
                <div className="h-full overflow-y-auto">
                  <div className="p-6 space-y-5">
                    {groups.map((group) => (
                      <div key={group.title} className="space-y-3">
                        {/* Mobile Section Header */}
                        <div className="px-4 py-2">
                          <h3 className="text-sm font-bold text-foreground mb-0.5">
                            {group.title}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {group.description}
                          </p>
                        </div>

                        {/* Mobile Menu Items */}
                        <nav className="space-y-1">
                          {group.items.map((item) => {
                            const Icon =
                              iconMap[item.label as keyof typeof iconMap] ||
                              FileText;
                            return (
                              <Link
                                key={item.to}
                                to={item.to}
                                className="group/mobile flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted/50 active:bg-primary/10 transition-all duration-200"
                              >
                                <Icon className="w-5 h-5 text-muted-foreground group-hover/mobile:text-primary transition-colors duration-200" />
                                <span className="text-sm font-medium group-hover/mobile:text-foreground transition-colors">
                                  {item.label}
                                </span>
                              </Link>
                            );
                          })}
                        </nav>
                      </div>
                    ))}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden">
            <Outlet />
          </div>
        </div>
      </section>
    </Layout>
  );
}
