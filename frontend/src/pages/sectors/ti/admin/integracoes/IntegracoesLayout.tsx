import { NavLink, Outlet } from "react-router-dom";

const menu = [
  { to: "adicionar-unidade", label: "Adicionar unidade" },
  { to: "listar-unidades", label: "Listar unidades" },
  { to: "adicionar-ao-banco", label: "Adicionar ao banco" },
];

export default function IntegracoesLayout() {
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
