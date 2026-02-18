import { useEffect, useState } from "react";
import { format, parseISO, startOfDay, endOfDay } from "date-fns";
import {
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Loader,
  Calendar,
  X,
  AlertTriangle,
  CheckIcon,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import AttendedTicketsMetric from "@/components/ti-dashboard/AttendedTicketsMetric";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useSLA, invalidateSLACache } from "@/hooks/useSLA";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

function Metric({
  label,
  value,
  sub,
  variant,
  icon: Icon,
  trend,
}: {
  label: string;
  value: string;
  sub?: string;
  variant: "orange" | "blue" | "green" | "purple";
  icon: any;
  trend?: "up" | "down";
}) {
  const colorMap = {
    orange: "from-orange-500 to-orange-600",
    blue: "from-blue-500 to-blue-600",
    green: "from-green-500 to-green-600",
    purple: "from-purple-500 to-purple-600",
  };

  return (
    <div className="relative group">
      <div
        className={`absolute -inset-1 bg-gradient-to-r ${colorMap[variant]} rounded-2xl blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-300`}
      />
      <div
        className={`relative metric-card rounded-2xl bg-gradient-to-br ${colorMap[variant]} text-white p-5 overflow-hidden`}
      >
        {/* Background pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: "32px 32px",
          }}
        />

        <div className="relative space-y-3">
          <div className="flex items-start justify-between">
            <div className="text-xs font-medium opacity-90">{label}</div>
            <Icon className="w-5 h-5 opacity-80" />
          </div>
          <div className="text-3xl font-extrabold leading-none">{value}</div>
          {sub && (
            <div className="flex items-center gap-1.5 text-xs opacity-90">
              {trend &&
                (trend === "up" ? (
                  <ArrowUpRight className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDownRight className="w-3.5 h-3.5" />
                ))}
              <span>{sub}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const colorStyles = {
  orange: "bg-orange-500",
  blue: "bg-blue-500",
  green: "bg-green-500",
  purple: "bg-purple-500",
};

const STATUS_OPTIONS = [
  "Aberto",
  "Em atendimento",
  "Aguardando",
  "Concluído",
  "Expirado",
] as const;

export default function Overview() {
  const queryClient = useQueryClient();
  const [metrics, setMetrics] = useState<any>(null);
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [performanceData, setPerformanceData] = useState<{
    tempo_resolucao_medio: string;
    primeira_resposta_media: string;
    taxa_reaberturas: string;
    chamados_backlog: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d" | "all">(
    "30d",
  );
  const [showCompleted, setShowCompleted] = useState(true);
  const [selectedStatuses, setSelectedStatuses] = useState<
    typeof STATUS_OPTIONS
  >(["Aberto", "Em atendimento", "Concluído"]);

  // SLA em tempo real (horas úteis, pausa por Aguardando, >= 16/02/2026)
  const { metricas: slaMetricas, loading: slaLoading, atualizar: atualizarSLA } = useSLA(
    dateRange === "7d" ? 7 : dateRange === "90d" ? 90 : 30
  );

  // Força reload do SLA ao montar o componente (recupera de erros anteriores)
  useEffect(() => {
    invalidateSLACache();
    atualizarSLA();
  }, []);

  // Custom date range filter
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [customDateMode, setCustomDateMode] = useState(false);

  // Debounced dates for actual filtering
  const [appliedStartDate, setAppliedStartDate] = useState<string>("");
  const [appliedEndDate, setAppliedEndDate] = useState<string>("");

  // Cache de métricas com React Query
  const { data: basicMetricsData, isLoading: basicLoading } = useQuery({
    queryKey: ["metrics-basic", dateRange, customDateMode, appliedStartDate, appliedEndDate],
    queryFn: async () => {
      if (customDateMode && appliedStartDate && appliedEndDate) {
        const response = await api.get(
          `/metrics/dashboard/basic?start_date=${appliedStartDate}&end_date=${appliedEndDate}`,
        );
        return response.data;
      }
      const response = await api.get(`/metrics/dashboard/basic?range=${dateRange}`);
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 30 * 60 * 1000, // 30 minutos (cache persistence)
  });

  const { data: dailyChartData, isLoading: dailyLoading } = useQuery({
    queryKey: ["metrics-daily", selectedStatuses, customDateMode, appliedStartDate, appliedEndDate],
    queryFn: async () => {
      const statusQuery =
        selectedStatuses.length > 0
          ? `&statuses=${selectedStatuses.join(",")}`
          : "";

      if (customDateMode && appliedStartDate && appliedEndDate) {
        const response = await api.get(
          `/metrics/chamados-por-dia?start_date=${appliedStartDate}&end_date=${appliedEndDate}${statusQuery}`,
        );
        return response.data?.dados || [];
      }

      const response = await api.get(
        `/metrics/chamados-por-dia?dias=7${statusQuery}`,
      );
      return response.data?.dados || [];
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  const { data: weeklyChartData, isLoading: weeklyLoading } = useQuery({
    queryKey: ["metrics-weekly", selectedStatuses, customDateMode, appliedStartDate, appliedEndDate],
    queryFn: async () => {
      const statusQuery =
        selectedStatuses.length > 0
          ? `&statuses=${selectedStatuses.join(",")}`
          : "";

      if (customDateMode && appliedStartDate && appliedEndDate) {
        const response = await api.get(
          `/metrics/chamados-por-semana?start_date=${appliedStartDate}&end_date=${appliedEndDate}${statusQuery}`,
        );
        return response.data?.dados || [];
      }

      const response = await api.get(
        `/metrics/chamados-por-semana?semanas=4${statusQuery}`,
      );
      return response.data?.dados || [];
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  const { data: performanceMetricsData, isLoading: performanceLoading } =
    useQuery({
      queryKey: ["metrics-performance"],
      queryFn: async () => {
        const response = await api.get("/metrics/performance");
        return response.data;
      },
      staleTime: 15 * 60 * 1000,
      gcTime: 60 * 60 * 1000,
    });

  const { data: monthlyChartData, isLoading: monthlyLoading } = useQuery({
    queryKey: ["metrics-monthly", dateRange, selectedStatuses, customDateMode, appliedStartDate, appliedEndDate],
    queryFn: async () => {
      const statusQuery =
        selectedStatuses.length > 0
          ? `&statuses=${selectedStatuses.join(",")}`
          : "";

      if (customDateMode && appliedStartDate && appliedEndDate) {
        const response = await api.get(
          `/metrics/chamados-por-mes?start_date=${appliedStartDate}&end_date=${appliedEndDate}${statusQuery}`,
        );
        return response.data?.dados || [];
      }

      const response = await api.get(
        `/metrics/chamados-por-mes?range=${dateRange}${statusQuery}`,
      );
      return response.data?.dados || [];
    },
    staleTime: 15 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  // Atualiza estado local quando dados do React Query chegam
  useEffect(() => {
    if (basicMetricsData) {
      setMetrics(basicMetricsData);
    }
  }, [basicMetricsData]);

  useEffect(() => {
    if (dailyChartData && Array.isArray(dailyChartData)) {
      setDailyData(dailyChartData);
    }
  }, [dailyChartData]);

  useEffect(() => {
    if (weeklyChartData && Array.isArray(weeklyChartData)) {
      setWeeklyData(weeklyChartData);
    }
  }, [weeklyChartData]);

  useEffect(() => {
    if (monthlyChartData && Array.isArray(monthlyChartData)) {
      setMonthlyData(monthlyChartData);
    }
  }, [monthlyChartData]);

  useEffect(() => {
    if (performanceMetricsData) {
      setPerformanceData(performanceMetricsData);
      console.log("[Overview] Performance data loaded:", performanceMetricsData);
    } else {
      console.log("[Overview] Performance data is null/undefined");
    }
  }, [performanceMetricsData]);

  // Toggle status selection
  const toggleStatus = (status: (typeof STATUS_OPTIONS)[number]) => {
    setSelectedStatuses((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status],
    );
  };

  // Listener WebSocket para atualizações em tempo real de métricas
  useEffect(() => {
    try {
      const socket = (window as any).__APP_SOCK__;

      if (!socket) {
        console.debug(
          "[Overview] WebSocket não disponível ainda para listener de métricas",
        );
        return;
      }

      const handleMetricsUpdated = () => {
        console.debug(
          "[Overview] Recebido evento metrics:updated, invalidando cache",
        );
        // Invalida todas as queries de métricas para forçar refetch imediato
        queryClient.invalidateQueries({ queryKey: ["metrics-basic"] });
        queryClient.invalidateQueries({ queryKey: ["metrics-daily"] });
        queryClient.invalidateQueries({ queryKey: ["metrics-weekly"] });
        queryClient.invalidateQueries({ queryKey: ["metrics-monthly"] });
        queryClient.invalidateQueries({ queryKey: ["metrics-performance"] });
      };

      socket.on("metrics:updated", handleMetricsUpdated);

      return () => {
        socket.off("metrics:updated", handleMetricsUpdated);
      };
    } catch (error) {
      console.debug("[Overview] Erro ao configurar listener WebSocket:", error);
    }
  }, [queryClient]);

  // Determina se está carregando
  useEffect(() => {
    const allLoading =
      basicLoading ||
      dailyLoading ||
      weeklyLoading ||
      performanceLoading ||
      monthlyLoading;
    setIsLoading(allLoading);
  }, [
    basicLoading,
    dailyLoading,
    weeklyLoading,
    performanceLoading,
    monthlyLoading,
  ]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Visão Geral</h1>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="relative group h-32 rounded-2xl bg-muted/50 animate-pulse flex items-center justify-center"
            >
              <Loader className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const comparacao = metrics?.comparacao_ontem || {
    hoje: 0,
    ontem: 0,
    percentual: 0,
    direcao: "up",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-start gap-4">
          <h1 className="text-2xl font-bold">Visão Geral</h1>
          <div className="flex flex-col gap-2 items-end">
            <Button
              size="sm"
              variant={customDateMode ? "default" : "outline"}
              onClick={() => setCustomDateMode(!customDateMode)}
              className="h-9"
            >
              {customDateMode ? "← Voltar ao padrão" : "📅 Filtro customizado"}
            </Button>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              {!customDateMode ? (
                <Select
                  value={dateRange}
                  onValueChange={(v) => setDateRange(v as any)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">Últimos 7 dias</SelectItem>
                    <SelectItem value="30d">Últimos 30 dias</SelectItem>
                    <SelectItem value="90d">Últimos 90 dias</SelectItem>
                    <SelectItem value="all">Todos os dados</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-9 px-3 rounded-md border border-input bg-background text-sm"
                  />
                  <span className="text-sm text-muted-foreground">até</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-9 px-3 rounded-md border border-input bg-background text-sm"
                  />
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => {
                      if (startDate && endDate) {
                        // Validar formato das datas
                        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                        if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
                          toast.error("Selecione datas válidas");
                          return;
                        }

                        // Validar se a data inicial não é depois da final
                        const start = new Date(startDate);
                        const end = new Date(endDate);
                        if (start > end) {
                          toast.error("Data inicial não pode ser maior que a final");
                          return;
                        }

                        setAppliedStartDate(startDate);
                        setAppliedEndDate(endDate);
                        toast.success("Filtro aplicado!");
                      } else {
                        toast.error("Preencha ambas as datas");
                      }
                    }}
                    disabled={!startDate || !endDate}
                    className="h-9"
                  >
                    Filtrar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setStartDate("");
                      setEndDate("");
                      setAppliedStartDate("");
                      setAppliedEndDate("");
                    }}
                    className="h-9 px-2"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <span className="text-sm">
                  Status selecionados ({selectedStatuses.length})
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {STATUS_OPTIONS.map((status) => (
                <DropdownMenuCheckboxItem
                  key={status}
                  checked={selectedStatuses.includes(status)}
                  onCheckedChange={() => toggleStatus(status)}
                >
                  {status}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {selectedStatuses.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setSelectedStatuses(["Aberto", "Em atendimento", "Concluído"])
              }
              className="text-xs"
            >
              Redefinir filtro
            </Button>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric
          label="Chamados hoje"
          value={String(metrics?.chamados_hoje || 0)}
          sub={`${comparacao.percentual >= 0 ? "+" : ""}${comparacao.percentual}% vs ontem`}
          variant="orange"
          icon={TrendingUp}
          trend={comparacao.direcao}
        />
        <Metric
          label="Em atendimento"
          value={String(metrics?.em_atendimento || 0)}
          sub="Chamados ativos"
          variant="blue"
          icon={Clock}
        />
        <Metric
          label="Concluídos"
          value={String(metrics?.concluidos || 0)}
          sub="Últimos 30 dias"
          variant="green"
          icon={CheckCircle2}
        />
        <Metric
          label="Em risco"
          value={String(metrics?.em_risco || 0)}
          sub="Requer atenção"
          variant="purple"
          icon={AlertCircle}
        />
      </div>

      {/* Performance Metrics Grid - SLA (horas úteis 08-18 seg-sex, >= 16/02/2026) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric
          label="Tempo médio de resolução"
          value={slaMetricas?.tempo_medio_resolucao_formatado ?? performanceData?.tempo_resolucao_medio ?? "—"}
          sub="Horas úteis (chamados concluídos)"
          variant="blue"
          icon={Clock}
        />
        <Metric
          label="Primeira resposta média"
          value={slaMetricas?.tempo_medio_resposta_formatado ?? performanceData?.primeira_resposta_media ?? "—"}
          sub="Horas úteis até 1ª resposta"
          variant="purple"
          icon={Clock}
        />
        <Metric
          label="SLA cumprido"
          value={slaMetricas ? `${slaMetricas.percentual_cumprimento}%` : (performanceData?.taxa_reaberturas ?? "—")}
          sub={slaMetricas ? `${slaMetricas.chamados_vencidos} vencidos • ${slaMetricas.chamados_em_risco} em risco` : ""}
          variant="orange"
          icon={AlertTriangle}
        />
        <Metric
          label="Chamados ativos (SLA)"
          value={String(slaMetricas?.chamados_abertos ?? performanceData?.chamados_backlog ?? 0)}
          sub={slaMetricas ? `${slaMetricas.chamados_pausados} pausados (Aguardando)` : "Aberto + Em atendimento"}
          variant="green"
          icon={CheckIcon}
        />
      </div>

      {/* Attended Tickets Metric Card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AttendedTicketsMetric
          startDate={customDateMode ? appliedStartDate : undefined}
          endDate={customDateMode ? appliedEndDate : undefined}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative card-surface rounded-2xl p-6 border border-border/60">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Chamados por dia</h3>
              <div className="px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-full">
                <span className="text-xs font-medium text-primary">
                  Última semana
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={dailyData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  opacity={0.3}
                />
                <XAxis
                  dataKey="dia"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                {selectedStatuses.includes("Aberto") && (
                  <Bar
                    dataKey="aberto"
                    fill="#06b6d4"
                    radius={[8, 8, 0, 0]}
                    name="Aberto"
                  />
                )}
                {selectedStatuses.includes("Em atendimento") && (
                  <Bar
                    dataKey="em_atendimento"
                    fill="#f59e0b"
                    radius={[8, 8, 0, 0]}
                    name="Em atendimento"
                  />
                )}
                {selectedStatuses.includes("Aguardando") && (
                  <Bar
                    dataKey="aguardando"
                    fill="#8b5cf6"
                    radius={[8, 8, 0, 0]}
                    name="Aguardando"
                  />
                )}
                {selectedStatuses.includes("Concluído") && (
                  <Bar
                    dataKey="concluido"
                    fill="#10b981"
                    radius={[8, 8, 0, 0]}
                    name="Concluído"
                  />
                )}
                {selectedStatuses.includes("Expirado") && (
                  <Bar
                    dataKey="expirado"
                    fill="#ef4444"
                    radius={[8, 8, 0, 0]}
                    name="Expirado"
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative card-surface rounded-2xl p-6 border border-border/60">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Chamados por semana</h3>
              <div className="px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-full">
                <span className="text-xs font-medium text-primary">
                  Último mês
                </span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={weeklyData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  opacity={0.3}
                />
                <XAxis
                  dataKey="semana"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                {selectedStatuses.includes("Aberto") && (
                  <Bar
                    dataKey="aberto"
                    fill="#06b6d4"
                    radius={[8, 8, 0, 0]}
                    name="Aberto"
                  />
                )}
                {selectedStatuses.includes("Em atendimento") && (
                  <Bar
                    dataKey="em_atendimento"
                    fill="#f59e0b"
                    radius={[8, 8, 0, 0]}
                    name="Em atendimento"
                  />
                )}
                {selectedStatuses.includes("Aguardando") && (
                  <Bar
                    dataKey="aguardando"
                    fill="#8b5cf6"
                    radius={[8, 8, 0, 0]}
                    name="Aguardando"
                  />
                )}
                {selectedStatuses.includes("Concluído") && (
                  <Bar
                    dataKey="concluido"
                    fill="#10b981"
                    radius={[8, 8, 0, 0]}
                    name="Concluído"
                  />
                )}
                {selectedStatuses.includes("Expirado") && (
                  <Bar
                    dataKey="expirado"
                    fill="#ef4444"
                    radius={[8, 8, 0, 0]}
                    name="Expirado"
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Monthly Chart */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative card-surface rounded-2xl p-6 border border-border/60">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">Chamados por Mês</h3>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={monthlyData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                opacity={0.3}
              />
              <XAxis
                dataKey="mes"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Legend />
              {selectedStatuses.includes("Aberto") && (
                <Bar
                  dataKey="aberto"
                  fill="#06b6d4"
                  radius={[8, 8, 0, 0]}
                  name="Aberto"
                />
              )}
              {selectedStatuses.includes("Em atendimento") && (
                <Bar
                  dataKey="em_atendimento"
                  fill="#f59e0b"
                  radius={[8, 8, 0, 0]}
                  name="Em atendimento"
                />
              )}
              {selectedStatuses.includes("Aguardando") && (
                <Bar
                  dataKey="aguardando"
                  fill="#8b5cf6"
                  radius={[8, 8, 0, 0]}
                  name="Aguardando"
                />
              )}
              {selectedStatuses.includes("Concluído") && (
                <Bar
                  dataKey="concluido"
                  fill="#10b981"
                  radius={[8, 8, 0, 0]}
                  name="Concluído"
                />
              )}
              {selectedStatuses.includes("Expirado") && (
                <Bar
                  dataKey="expirado"
                  fill="#ef4444"
                  radius={[8, 8, 0, 0]}
                  name="Expirado"
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
