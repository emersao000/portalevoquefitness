import { NavLink, Outlet } from "react-router-dom";

const menu = [
  { to: "notificacoes", label: "Notificações" },
  { to: "midia-login", label: "Mídia do Login" },
  { to: "alertas", label: "Alertas" },
  { to: "acoes", label: "Ações do Sistema" },
  { to: "sla", label: "⏱ SLA" },
  { to: "bi-dashboards", label: "📊 Dashboards BI" },
];

export default function ConfiguracoesLayout() {
  return (
    <div className="space-y-6">
      <div className="tabs-scrollable">
        {menu.map((m) => (
          <NavLink
            key={m.to}
            to={m.to}
            className={({ isActive }) =>
              `rounded-full px-3 py-1.5 text-sm border whitespace-nowrap flex-shrink-0 ${isActive ? "bg-primary text-primary-foreground border-transparent" : "bg-secondary hover:bg-secondary/80"}`
            }
          >
            {m.label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  );
}
