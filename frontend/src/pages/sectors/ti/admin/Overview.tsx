import { useEffect, useState } from "react";
import { format, parseISO, startOfDay, endOfDay } from "date-fns";
import {
  TrendingUp,
  Clock,
  Loader,
  Calendar,
  X,
  AlertTriangle,
  PauseCircle,
  RefreshCw,
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
}: {
  label: string;
  value: string;
  sub?: string;
  variant: "orange" | "blue" | "green" | "purple" | "gray";
  icon: any;
  trend?: "up" | "down";
}) {
  const colorMap = {
    orange: "from-orange-500 to-orange-600",
    blue: "from-blue-500 to-blue-600",
    green: "from-green-500 to-green-600",
    purple: "from-purple-500 to-purple-600",
    gray: "from-slate-500 to-slate-600",
  };

  return (
    <div className={`rounded-xl bg-gradient-to-br ${colorMap[variant]} text-white p-4 flex items-center gap-3`}>
      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium opacity-80 leading-tight mb-0.5">{label}</div>
        <div className="text-2xl font-extrabold leading-none">{value}</div>
        {sub && <div className="text-xs opacity-75 leading-tight mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

const colorStyles = {
  orange: "bg-orange-500",
  blue: "bg-blue-500",
  green: "bg-green-500",
  purple: "bg-purple-500",
  gray: "bg-slate-500",
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

  // Refresh manual
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [pendingNewTickets, setPendingNewTickets] = useState(0);
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

  // Carrega SLA apenas se o cache estiver expirado (não invalida na montagem)
  // O useSLA já gerencia o cache de 15 min e o auto-refresh de 30s
  useEffect(() => {
    // Só força refresh se não houver métricas ainda (ex: primeira visita)
    if (!slaMetricas) {
      atualizarSLA();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Custom date range filter
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [customDateMode, setCustomDateMode] = useState(false);

  // Debounced dates for actual filtering
  const [appliedStartDate, setAppliedStartDate] = useState<string>("");
  const [appliedEndDate, setAppliedEndDate] = useState<string>("");

  // Mapeia dateRange para parâmetros corretos de cada endpoint
  const dailyDias =
    dateRange === "7d" ? 7 :
    dateRange === "30d" ? 30 :
    dateRange === "90d" ? 90 : 365;

  const weeklySemanas =
    dateRange === "7d" ? 2 :
    dateRange === "30d" ? 4 :
    dateRange === "90d" ? 13 : 52;

  // Cache de métricas com React Query
  // Uma única requisição para todos os dados do overview
  const overviewQueryKey = ["metrics-overview", dateRange, selectedStatuses, customDateMode, appliedStartDate, appliedEndDate];
  const { data: overviewData, isLoading: overviewLoading } = useQuery({
    queryKey: overviewQueryKey,
    queryFn: async () => {
      const statusQuery = selectedStatuses.length > 0 ? `&statuses=${selectedStatuses.join(",")}` : "";
      const url = customDateMode && appliedStartDate && appliedEndDate
        ? `/metrics/overview?start_date=${appliedStartDate}&end_date=${appliedEndDate}${statusQuery}`
        : `/metrics/overview?range=${dateRange}${statusQuery}`;
      const response = await api.get(url);
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const basicMetricsData = overviewData?.basic;
  const dailyChartData   = overviewData?.daily?.dados   ?? [];
  const weeklyChartData  = overviewData?.weekly?.dados  ?? [];
  const monthlyChartData = overviewData?.monthly?.dados ?? [];
  const performanceMetricsData = overviewData?.performance;
  const basicLoading = overviewLoading;
  const dailyLoading = overviewLoading;
  const weeklyLoading = overviewLoading;
  const monthlyLoading = overviewLoading;
  const performanceLoading = overviewLoading;
  const dailyFetching = false;
  const weeklyFetching = false;
  const monthlyFetching = false;

  // Atualiza estado local quando dados do React Query chegam
  useEffect(() => {
    if (basicMetricsData) {
      setMetrics(basicMetricsData);
      setLastUpdated(new Date());
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
      if (!socket) return;

      const handleMetricsUpdated = () => {
        // Apenas atualiza métricas gerais — SLA tem seu próprio ciclo de 30s
        queryClient.invalidateQueries({ queryKey: ["metrics-overview"] });
        setLastUpdated(new Date());
      };

      const handleChamadoCreated = () => {
        // Novo chamado: invalida tudo incluindo SLA
        setPendingNewTickets((n) => n + 1);
        queryClient.invalidateQueries({ queryKey: ["metrics-overview"] });
        invalidateSLACache();
        atualizarSLA();
        setLastUpdated(new Date());
        toast.info("Novo chamado recebido!", {
          description: "Os cards foram atualizados automaticamente.",
          duration: 4000,
        });
      };

      const handleChamadoStatus = () => {
        // Mudança de status: invalida métricas e SLA
        queryClient.invalidateQueries({ queryKey: ["metrics-overview"] });
        invalidateSLACache();
        atualizarSLA();
        setLastUpdated(new Date());
      };

      socket.on("metrics:updated", handleMetricsUpdated);
      socket.on("chamado:created", handleChamadoCreated);
      socket.on("chamado:status", handleChamadoStatus);

      return () => {
        socket.off("metrics:updated", handleMetricsUpdated);
        socket.off("chamado:created", handleChamadoCreated);
        socket.off("chamado:status", handleChamadoStatus);
      };
    } catch (error) {
      console.debug("[Overview] Erro ao configurar listener WebSocket:", error);
    }
  }, [queryClient, atualizarSLA]);

  // Função de refresh manual
  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setPendingNewTickets(0);
    try {
      invalidateSLACache();
      await queryClient.invalidateQueries({ queryKey: ["metrics-overview"] });
      await queryClient.refetchQueries({ queryKey: ["metrics-overview"] });
      atualizarSLA();
      setLastUpdated(new Date());
      toast.success("Dados atualizados!");
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  // FIX: isLoading só bloqueia na carga inicial (sem dados ainda).
  // Refetches posteriores (troca de filtro) não escondem os gráficos — usamos
  // isFetching por gráfico individualmente para mostrar um indicador sutil.
  useEffect(() => {
    const initialLoad = basicLoading && !metrics;
    setIsLoading(initialLoad);
  }, [basicLoading, metrics]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-lg font-bold">Visão Geral</h1>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[72px] rounded-xl bg-muted/50 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[72px] rounded-xl bg-muted/50 animate-pulse" />
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
    <div className="space-y-4">
      {/* Toolbar compacta — tudo em uma linha */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Status filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
              Status ({selectedStatuses.length})
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
          <Button variant="ghost" size="sm" className="h-8 text-xs px-2"
            onClick={() => setSelectedStatuses(["Aberto", "Em atendimento", "Concluído"])}>
            Redefinir
          </Button>
        )}

        {/* Botão de Refresh */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Atualizar dados"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          {pendingNewTickets > 0 && (
            <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 rounded-full bg-green-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
              +{pendingNewTickets}
            </span>
          )}
        </div>

        {/* Última atualização */}
        {lastUpdated && (
          <span className="text-[11px] text-muted-foreground hidden sm:inline">
            Atualizado às {lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        )}

        <div className="flex-1" />

        {/* Date controls */}
        {!customDateMode ? (
          <>
            <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <Select value={dateRange} onValueChange={(v) => setDateRange(v as any)}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="90d">Últimos 90 dias</SelectItem>
                <SelectItem value="all">Todos os dados</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="h-8 text-xs"
              onClick={() => setCustomDateMode(true)}>
              Customizar
            </Button>
          </>
        ) : (
          <>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="h-8 px-2 rounded-md border border-input bg-background text-xs w-32" />
            <span className="text-xs text-muted-foreground">até</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="h-8 px-2 rounded-md border border-input bg-background text-xs w-32" />
            <Button size="sm" variant="default" className="h-8 text-xs"
              disabled={!startDate || !endDate}
              onClick={() => {
                if (!startDate || !endDate) { toast.error("Preencha ambas as datas"); return; }
                const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) { toast.error("Datas inválidas"); return; }
                if (new Date(startDate) > new Date(endDate)) { toast.error("Data inicial maior que final"); return; }
                setAppliedStartDate(startDate); setAppliedEndDate(endDate);
                toast.success("Filtro aplicado!");
              }}>
              Filtrar
            </Button>
            <Button size="sm" variant="ghost" className="h-8 px-2"
              onClick={() => { setStartDate(""); setEndDate(""); setAppliedStartDate(""); setAppliedEndDate(""); setCustomDateMode(false); }}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </>
        )}
      </div>

      {/* Métricas — linha 1: status */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Metric
          label="Chamados abertos"
          value={String(metrics?.abertos_agora ?? 0)}
          sub="Aguardando atendimento"
          variant="green"
          icon={TrendingUp}
        />
        <Metric
          label="Em atendimento"
          value={String(metrics?.em_atendimento || 0)}
          sub="Chamados ativos"
          variant="orange"
          icon={Clock}
        />
        <Metric
          label="Aguardando"
          value={String(metrics?.aguardando || 0)}
          sub="Pausados aguardando resposta"
          variant="blue"
          icon={PauseCircle}
        />
      </div>

      {/* Métricas — linha 2: SLA/performance + relatório */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric
          label="Tempo médio de resolução"
          value={slaMetricas?.tempo_medio_resolucao_formatado ?? performanceData?.tempo_resolucao_medio ?? "—"}
          sub="Horas úteis (concluídos)"
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
          sub={slaMetricas ? `${slaMetricas.chamados_vencidos} vencidos` : ""}
          variant="gray"
          icon={AlertTriangle}
        />
        {/* Relatório de chamados atendidos — compacto na mesma linha */}
        <AttendedTicketsMetric
          startDate={customDateMode ? appliedStartDate : undefined}
          endDate={customDateMode ? appliedEndDate : undefined}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chamados por Dia */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative card-surface rounded-2xl p-6 border border-border/60">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg">Chamados por dia</h3>
                {dailyFetching && (
                  <Loader className="w-4 h-4 animate-spin text-muted-foreground" />
                )}
              </div>
              <div className="px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-full">
                <span className="text-xs font-medium text-primary">
                  {customDateMode && appliedStartDate && appliedEndDate
                    ? "Período customizado"
                    : dateRange === "7d" ? "Últimos 7 dias"
                    : dateRange === "30d" ? "Últimos 30 dias"
                    : dateRange === "90d" ? "Últimos 90 dias"
                    : "Todos os dados"}
                </span>
              </div>
            </div>
            {dailyLoading && dailyData.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center">
                <Loader className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : dailyData.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
                Nenhum dado para o período selecionado
              </div>
            ) : (
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
                    <Bar dataKey="aberto" fill="#06b6d4" radius={[8, 8, 0, 0]} name="Aberto" />
                  )}
                  {selectedStatuses.includes("Em atendimento") && (
                    <Bar dataKey="em_atendimento" fill="#f59e0b" radius={[8, 8, 0, 0]} name="Em atendimento" />
                  )}
                  {selectedStatuses.includes("Aguardando") && (
                    <Bar dataKey="aguardando" fill="#8b5cf6" radius={[8, 8, 0, 0]} name="Aguardando" />
                  )}
                  {selectedStatuses.includes("Concluído") && (
                    <Bar dataKey="concluido" fill="#10b981" radius={[8, 8, 0, 0]} name="Concluído" />
                  )}
                  {selectedStatuses.includes("Expirado") && (
                    <Bar dataKey="expirado" fill="#ef4444" radius={[8, 8, 0, 0]} name="Expirado" />
                  )}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chamados por Semana */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative card-surface rounded-2xl p-6 border border-border/60">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg">Chamados por semana</h3>
                {weeklyFetching && (
                  <Loader className="w-4 h-4 animate-spin text-muted-foreground" />
                )}
              </div>
              <div className="px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-full">
                <span className="text-xs font-medium text-primary">
                  {customDateMode && appliedStartDate && appliedEndDate
                    ? "Período customizado"
                    : dateRange === "7d" ? "Últimas 2 semanas"
                    : dateRange === "30d" ? "Últimas 4 semanas"
                    : dateRange === "90d" ? "Últimas 13 semanas"
                    : "Histórico completo"}
                </span>
              </div>
            </div>
            {weeklyLoading && weeklyData.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center">
                <Loader className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : weeklyData.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
                Nenhum dado para o período selecionado
              </div>
            ) : (
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
                    <Bar dataKey="aberto" fill="#06b6d4" radius={[8, 8, 0, 0]} name="Aberto" />
                  )}
                  {selectedStatuses.includes("Em atendimento") && (
                    <Bar dataKey="em_atendimento" fill="#f59e0b" radius={[8, 8, 0, 0]} name="Em atendimento" />
                  )}
                  {selectedStatuses.includes("Aguardando") && (
                    <Bar dataKey="aguardando" fill="#8b5cf6" radius={[8, 8, 0, 0]} name="Aguardando" />
                  )}
                  {selectedStatuses.includes("Concluído") && (
                    <Bar dataKey="concluido" fill="#10b981" radius={[8, 8, 0, 0]} name="Concluído" />
                  )}
                  {selectedStatuses.includes("Expirado") && (
                    <Bar dataKey="expirado" fill="#ef4444" radius={[8, 8, 0, 0]} name="Expirado" />
                  )}
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Monthly Chart */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative card-surface rounded-2xl p-6 border border-border/60">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">Chamados por Mês</h3>
              {monthlyFetching && (
                <Loader className="w-4 h-4 animate-spin text-muted-foreground" />
              )}
            </div>
            <div className="px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-full">
              <span className="text-xs font-medium text-primary">
                {customDateMode && appliedStartDate && appliedEndDate
                  ? "Período customizado"
                  : dateRange === "7d" ? "Últimos 7 dias"
                  : dateRange === "30d" ? "Últimos 30 dias"
                  : dateRange === "90d" ? "Últimos 90 dias"
                  : "Histórico completo"}
              </span>
            </div>
          </div>
          {monthlyLoading && monthlyData.length === 0 ? (
            <div className="h-[320px] flex items-center justify-center">
              <Loader className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : monthlyData.length === 0 ? (
            <div className="h-[320px] flex items-center justify-center text-sm text-muted-foreground">
              Nenhum dado para o período selecionado
            </div>
          ) : (
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
                  <Bar dataKey="aberto" fill="#06b6d4" radius={[8, 8, 0, 0]} name="Aberto" />
                )}
                {selectedStatuses.includes("Em atendimento") && (
                  <Bar dataKey="em_atendimento" fill="#f59e0b" radius={[8, 8, 0, 0]} name="Em atendimento" />
                )}
                {selectedStatuses.includes("Aguardando") && (
                  <Bar dataKey="aguardando" fill="#8b5cf6" radius={[8, 8, 0, 0]} name="Aguardando" />
                )}
                {selectedStatuses.includes("Concluído") && (
                  <Bar dataKey="concluido" fill="#10b981" radius={[8, 8, 0, 0]} name="Concluído" />
                )}
                {selectedStatuses.includes("Expirado") && (
                  <Bar dataKey="expirado" fill="#ef4444" radius={[8, 8, 0, 0]} name="Expirado" />
                )}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
