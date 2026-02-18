import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DailyChartProps {
  data: Array<{
    dia: string;
    data?: string;
    quantidade: number;
  }>;
  loading?: boolean;
}

export function DailyChart({ data, loading }: DailyChartProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-6 h-80 flex items-center justify-center">
        <p className="text-muted-foreground">Carregando dados...</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card p-6">
      <h3 className="text-lg font-semibold mb-6">Chamados por dia</h3>
      <p className="text-xs text-muted-foreground mb-4">Última semana</p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={data}
          margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="dia"
            stroke="var(--muted-foreground)"
            style={{ fontSize: "12px" }}
          />
          <YAxis
            stroke="var(--muted-foreground)"
            style={{ fontSize: "12px" }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
            }}
            labelStyle={{ color: "var(--foreground)" }}
          />
          <Bar
            dataKey="quantidade"
            fill="var(--primary)"
            radius={[8, 8, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
