import { NavLink, Outlet } from "react-router-dom";

const menu = [
  { to: "notificacoes", label: "Notificações" },
  { to: "midia-login", label: "Mídia do Login" },
  { to: "alertas", label: "Alertas" },
  { to: "acoes", label: "Ações do Sistema" },
];

export default function ConfiguracoesLayout() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {menu.map((m) => (
          <NavLink
            key={m.to}
            to={m.to}
            className={({ isActive }) =>
              `rounded-full px-3 py-1.5 text-sm border ${isActive ? "bg-primary text-primary-foreground border-transparent" : "bg-secondary hover:bg-secondary/80"}`
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
