import { Dashboard } from "../hooks/useDashboards";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";

interface DashboardGridProps {
  dashboards: Dashboard[];
  onSelectDashboard: (dashboard: Dashboard) => void;
}

export default function DashboardGrid({
  dashboards,
  onSelectDashboard,
}: DashboardGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {dashboards.map((dashboard) => (
        <Card
          key={dashboard.id}
          className="p-6 hover:shadow-lg transition flex flex-col"
        >
          <div className="flex items-start justify-between mb-4">
            <Eye className="w-8 h-8 text-primary flex-shrink-0" />
          </div>
          <h3 className="font-semibold text-lg mb-2 flex-1">
            {dashboard.title}
          </h3>
          <p className="text-sm text-muted-foreground mb-4 flex-1">
            {dashboard.description}
          </p>
          <Button
            onClick={() => onSelectDashboard(dashboard)}
            className="w-full"
          >
            Visualizar
          </Button>
        </Card>
      ))}
    </div>
  );
}
