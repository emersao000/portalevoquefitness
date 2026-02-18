import { NavLink, Outlet } from "react-router-dom";

const menu = [
  { to: "criar", label: "Criar usuário" },
  { to: "bloqueios", label: "Bloqueios" },
  { to: "permissoes", label: "Permissões" },
  { to: "auth0", label: "Usuários (Auth0)" },
  { to: "agentes", label: "Agentes de Suporte" },
  { to: "grupos", label: "Grupos de Usuários" },
];

export default function UsuariosLayout() {
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
