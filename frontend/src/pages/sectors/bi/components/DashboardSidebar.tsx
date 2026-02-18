import { Dashboard, DashboardCategory } from "../hooks/useDashboards";
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  Target,
  BarChart3,
  PieChart,
  Activity,
  Zap,
} from "lucide-react";

interface DashboardSidebarProps {
  categories: DashboardCategory[];
  selectedDashboard: Dashboard | null;
  onSelectDashboard: (dashboard: Dashboard) => void;
}

// Mapeamento de ícones por título do dashboard
const getDashboardIcon = (title: string) => {
  const lowerTitle = title.toLowerCase();

  if (lowerTitle.includes("visão geral") || lowerTitle.includes("overview")) {
    return <LayoutDashboard className="w-full h-full" />;
  }
  if (lowerTitle.includes("vendas") || lowerTitle.includes("receita")) {
    return <TrendingUp className="w-full h-full" />;
  }
  if (lowerTitle.includes("cliente") || lowerTitle.includes("member")) {
    return <Users className="w-full h-full" />;
  }
  if (lowerTitle.includes("meta") || lowerTitle.includes("objetivo")) {
    return <Target className="w-full h-full" />;
  }
  if (lowerTitle.includes("performance") || lowerTitle.includes("desempenho")) {
    return <Activity className="w-full h-full" />;
  }
  if (lowerTitle.includes("análise") || lowerTitle.includes("analytics")) {
    return <PieChart className="w-full h-full" />;
  }
  if (lowerTitle.includes("operacion")) {
    return <Zap className="w-full h-full" />;
  }

  // Ícone padrão
  return <BarChart3 className="w-full h-full" />;
};

export default function DashboardSidebar({
  categories,
  selectedDashboard,
  onSelectDashboard,
}: DashboardSidebarProps) {
  const dashboards = categories.flatMap((c) => c.dashboards);

  return (
    <aside className="bi-sidebar">
      <div className="bi-sidebar-header">
        <img
          src="https://images.totalpass.com/public/1280x720/czM6Ly90cC1pbWFnZS1hZG1pbi1wcm9kL2d5bXMva2g2OHF6OWNuajloN2lkdnhzcHhhdWx4emFhbWEzYnc3MGx5cDRzZ3p5aTlpZGM0OHRvYnk0YW56azRk"
          alt="Evoque"
          className="bi-logo"
        />
        <h2 className="bi-sidebar-title">Dashboards</h2>
      </div>

      <nav className="bi-nav" aria-label="Dashboards navigation">
        {dashboards.map((dashboard) => (
          <button
            key={dashboard.id}
            onClick={() => onSelectDashboard(dashboard)}
            className={`bi-item ${
              selectedDashboard?.id === dashboard.id ? "active" : ""
            }`}
            title={dashboard.title}
            aria-current={selectedDashboard?.id === dashboard.id}
          >
            <span className="bi-item-icon">
              {getDashboardIcon(dashboard.title)}
            </span>
            <span className="bi-item-label">{dashboard.title}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
