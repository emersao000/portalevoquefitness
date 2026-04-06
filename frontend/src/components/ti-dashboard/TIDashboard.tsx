import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { MetricsCard } from "./MetricsCard";
import { DailyChart } from "./DailyChart";
import { WeeklyChart } from "./WeeklyChart";
import { PerformanceMetrics } from "./PerformanceMetrics";
import { AlertCircle, TrendingUp, Clock, CheckCircle } from "lucide-react";

interface DashboardData {
  chamados_hoje: number;
  comparacao_ontem: {
    hoje: number;
    ontem: number;
    percentual: number;
    direcao: "up" | "down";
  };
  tempo_resposta_24h: string;
  tempo_resposta_mes: string;
  total_chamados_mes: number;
  abertos_agora: number;
  tempo_resolucao_30dias: string;
}

interface DailyData {
  dia: string;
  data?: string;
  quantidade: number;
}

interface WeeklyData {
  semana: string;
  quantidade: number;
}

interface PerformanceData {
  tempo_resolucao_medio: string;
  primeira_resposta_media: string;
  taxa_reaberturas: string;
  chamados_backlog: number;
}

export function TIDashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(
    null,
  );
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  const [performanceData, setPerformanceData] =
    useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [dashboard, daily, weekly, performance] = await Promise.all([
          apiFetch("/api/metrics/dashboard")
            .then((r) => r.json())
            .catch(() => null),
          apiFetch("/api/metrics/chamados-por-dia")
            .then((r) => r.json())
            .catch(() => ({ dados: [] })),
          apiFetch("/api/metrics/chamados-por-semana")
            .then((r) => r.json())
            .catch(() => ({ dados: [] })),
          apiFetch("/api/metrics/performance")
            .then((r) => r.json())
            .catch(() => null),
        ]);

        setDashboardData(dashboard);
        setDailyData(daily?.dados || []);
        setWeeklyData(weekly?.dados || []);
        setPerformanceData(performance);
      } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !dashboardData) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Carregando dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricsCard
          title="Chamados hoje"
          value={dashboardData?.chamados_hoje || 0}
          subtitle="Novos chamados"
          icon={<TrendingUp className="w-6 h-6" />}
          comparison={
            dashboardData?.comparacao_ontem
              ? {
                  value: dashboardData.comparacao_ontem.percentual,
                  direction: dashboardData.comparacao_ontem.direcao,
                }
              : undefined
          }
        />

        <MetricsCard
          title="Tempo médio de resposta"
          value={dashboardData?.tempo_resposta_mes || "—"}
          subtitle={`Este mês (${dashboardData?.total_chamados_mes || 0} chamados)`}
          icon={<Clock className="w-6 h-6" />}
        />

        <MetricsCard
          title="Chamados ativos"
          value={dashboardData?.abertos_agora || 0}
          subtitle="não concluídos"
          icon={<AlertCircle className="w-6 h-6" />}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DailyChart data={dailyData} loading={loading} />
        <WeeklyChart data={weeklyData} loading={loading} />
      </div>

      {/* Performance Metrics */}
      {performanceData && (
        <PerformanceMetrics
          tempoResolucaoMedio={performanceData.tempo_resolucao_medio}
          primeiraRespostMedia={performanceData.primeira_resposta_media}
          taxaReaberturas={performanceData.taxa_reaberturas}
          chamadosBacklog={performanceData.chamados_backlog}
          loading={loading}
        />
      )}
    </div>
  );
}
