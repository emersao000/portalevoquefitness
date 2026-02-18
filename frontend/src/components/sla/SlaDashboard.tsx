import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader,
  AlertCircle,
  TrendingDown,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { slaService, SlaDashboard } from "@/services/slaService";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: "blue" | "green" | "red" | "yellow" | "purple";
  subtitle?: string;
}

const MetricCard = ({
  label,
  value,
  icon,
  color,
  subtitle,
}: MetricCardProps) => {
  const colorClass = {
    blue: "bg-blue-50 border-blue-200",
    green: "bg-green-50 border-green-200",
    red: "bg-red-50 border-red-200",
    yellow: "bg-yellow-50 border-yellow-200",
    purple: "bg-purple-50 border-purple-200",
  };

  const textColor = {
    blue: "text-blue-700",
    green: "text-green-700",
    red: "text-red-700",
    yellow: "text-yellow-700",
    purple: "text-purple-700",
  };

  return (
    <div className={`${colorClass[color]} border rounded-lg p-4`}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-sm font-medium text-gray-600">{label}</span>
        <div className="text-gray-400">{icon}</div>
      </div>
      <div className={`text-2xl font-bold ${textColor[color]} mb-1`}>
        {value}
      </div>
      {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
    </div>
  );
};

export default function SlaDashboard() {
  const [dashboard, setDashboard] = useState<SlaDashboard | null>(null);
  const [recalculando, setRecalculando] = useState(false);

  const {
    data: slaData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["sla-dashboard"],
    queryFn: () => slaService.getDashboard(),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  useEffect(() => {
    if (slaData) {
      setDashboard(slaData);
    }
  }, [slaData]);

  // WebSocket listener
  useEffect(() => {
    try {
      const socket = (window as any).__APP_SOCK__;
      if (!socket) return;

      const handleSlaUpdated = () => {
        console.log("[SlaDashboard] SLA atualizado via WebSocket");
        refetch();
      };

      socket.on("sla:updated", handleSlaUpdated);
      return () => {
        socket.off("sla:updated", handleSlaUpdated);
      };
    } catch (error) {
      console.debug("[SlaDashboard] Erro ao configurar WebSocket:", error);
    }
  }, [refetch]);

  const handleRecalcular = async () => {
    try {
      setRecalculando(true);
      await slaService.executarRecalculo();
      toast.success("Recálculo iniciado com sucesso");
      refetch();
    } catch (error) {
      toast.error("Erro ao executar recálculo");
      console.error(error);
    } finally {
      setRecalculando(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center space-y-2">
          <Loader className="w-8 h-8 animate-spin mx-auto text-blue-500" />
          <p className="text-gray-600">Carregando dashboard SLA...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <div>
            <h3 className="font-semibold text-red-900">Erro ao carregar SLA</h3>
            <p className="text-sm text-red-700">
              Não foi possível carregar os dados do dashboard SLA
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return null;
  }

  const formatarTempo = (horas: number): string => {
    if (horas < 1) {
      const minutos = Math.round(horas * 60);
      return `${minutos}min`;
    }
    if (horas < 24) {
      return `${horas.toFixed(1)}h`;
    }
    const dias = Math.floor(horas / 24);
    const horasRestantes = horas % 24;
    return `${dias}d ${horasRestantes.toFixed(0)}h`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">SLA Dashboard</h2>
          <p className="text-sm text-gray-500 mt-1">
            Última atualização:{" "}
            {new Date(dashboard.ultima_atualizacao).toLocaleString("pt-BR")}
          </p>
        </div>
        <Button
          onClick={handleRecalcular}
          disabled={recalculando}
          variant="outline"
        >
          {recalculando ? (
            <>
              <Loader className="w-4 h-4 animate-spin mr-2" />
              Recalculando...
            </>
          ) : (
            <>
              <TrendingDown className="w-4 h-4 mr-2" />
              Recalcular Agora
            </>
          )}
        </Button>
      </div>

      {/* Resumo Geral */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total de Chamados"
          value={dashboard.total_chamados}
          icon={<Clock className="w-4 h-4" />}
          color="blue"
          subtitle={`${dashboard.chamados_ativos} ativos, ${dashboard.chamados_concluidos} concluídos`}
        />
        <MetricCard
          label="SLA Resposta"
          value={`${dashboard.percentual_resposta_ok.toFixed(1)}%`}
          icon={<CheckCircle2 className="w-4 h-4" />}
          color="green"
          subtitle={`${dashboard.chamados_resposta_ok}/${dashboard.total_chamados} OK`}
        />
        <MetricCard
          label="SLA Resolução"
          value={`${dashboard.percentual_resolucao_ok.toFixed(1)}%`}
          icon={<CheckCircle2 className="w-4 h-4" />}
          color="green"
          subtitle={`${dashboard.chamados_resolucao_ok}/${dashboard.total_chamados} OK`}
        />
        <MetricCard
          label="Alertas"
          value={dashboard.chamados_em_risco + dashboard.chamados_vencidos}
          icon={<AlertTriangle className="w-4 h-4" />}
          color={
            dashboard.chamados_vencidos > 0
              ? "red"
              : dashboard.chamados_em_risco > 0
                ? "yellow"
                : "green"
          }
          subtitle={`${dashboard.chamados_em_risco} em risco`}
        />
      </div>

      {/* Tempos Médios */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-2">
            Tempo Médio Resposta
          </h3>
          <div className="text-3xl font-bold text-blue-700">
            {formatarTempo(dashboard.tempo_medio_resposta_horas)}
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {dashboard.chamados_resposta_risco} em risco,{" "}
            {dashboard.chamados_resposta_vencido} vencidos
          </p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-2">
            Tempo Médio Resolução
          </h3>
          <div className="text-3xl font-bold text-green-700">
            {formatarTempo(dashboard.tempo_medio_resolucao_horas)}
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {dashboard.chamados_resolucao_risco} em risco,{" "}
            {dashboard.chamados_resolucao_vencido} vencidos
          </p>
        </div>
      </div>

      {/* Alertas */}
      {dashboard.chamados_pausados > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-yellow-600" />
            <h3 className="font-semibold text-yellow-900">Chamados Pausados</h3>
          </div>
          <p className="text-yellow-700 text-sm">
            {dashboard.chamados_pausados} chamado(s) aguardando análise
          </p>
        </div>
      )}

      {dashboard.chamados_vencidos > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <h3 className="font-semibold text-red-900">SLA Vencido</h3>
          </div>
          <p className="text-red-700 text-sm">
            {dashboard.chamados_vencidos} chamado(s) com SLA vencido
          </p>
        </div>
      )}

      {dashboard.chamados_em_risco > 0 && dashboard.chamados_vencidos === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <h3 className="font-semibold text-yellow-900">Em Risco</h3>
          </div>
          <p className="text-yellow-700 text-sm">
            {dashboard.chamados_em_risco} chamado(s) em risco de vencer SLA
          </p>
        </div>
      )}
    </div>
  );
}
