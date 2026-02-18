import { ReactNode } from "react";
import { ArrowUpIcon, ArrowDownIcon } from "lucide-react";

interface MetricsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  comparison?: {
    value: number;
    direction: "up" | "down";
  };
  className?: string;
}

export function MetricsCard({
  title,
  value,
  subtitle,
  icon,
  comparison,
  className,
}: MetricsCardProps) {
  return (
    <div
      className={`rounded-xl border border-border/60 bg-card p-6 ${className || ""}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground mb-2">{title}</p>
          <div className="text-3xl font-bold tracking-tight">{value}</div>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-2">{subtitle}</p>
          )}
        </div>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
      {comparison && (
        <div
          className={`flex items-center gap-1 text-sm mt-4 ${comparison.direction === "up" ? "text-green-600" : "text-red-600"}`}
        >
          {comparison.direction === "up" ? (
            <ArrowUpIcon className="w-4 h-4" />
          ) : (
            <ArrowDownIcon className="w-4 h-4" />
          )}
          <span>{comparison.value}% vs ontem</span>
        </div>
      )}
    </div>
  );
}
