import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useEffect } from "react";

interface DashboardMetrics {
  chamados_hoje: number;
  comparacao_ontem: {
    hoje: number;
    ontem: number;
    percentual: number;
    direcao: "up" | "down";
  };
  tempo_resposta_24h: string;
  abertos_agora: number;
  tempo_resolucao_30dias: string;
}

/**
 * Hook para obter métricas do dashboard com cache inteligente
 *
 * Estratégia:
 * - staleTime: 5 minutos (cache está fresco por 5 min)
 * - refetchInterval: 10 minutos (atualiza periodicamente, fallback)
 * - Listener WebSocket para atualizações em tempo real
 * - Usa cache do servidor + React Query
 */
export function useMetrics() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["metrics-dashboard"],
    queryFn: async () => {
      const response = await api.get("/metrics/dashboard");
      return response.data as DashboardMetrics;
    },
    refetchInterval: 10 * 60 * 1000, // A cada 10 minutos (fallback)
    staleTime: 5 * 60 * 1000, // Cache considerado fresco por 5 minutos
    gcTime: 30 * 60 * 1000, // Cache pode permanecer na memória por 30 minutos
  });

  // Listener WebSocket para atualizações em tempo real
  useEffect(() => {
    try {
      const socket = (window as any).__APP_SOCK__;

      if (!socket) {
        console.debug(
          "[useMetrics] WebSocket não disponível ainda, usando polling apenas",
        );
        return;
      }

      const handleMetricsUpdated = () => {
        console.debug(
          "[useMetrics] Recebido evento metrics:updated, invalidando cache",
        );
        // Invalida query para forçar refetch imediato
        queryClient.invalidateQueries({ queryKey: ["metrics-dashboard"] });
      };

      socket.on("metrics:updated", handleMetricsUpdated);

      return () => {
        socket.off("metrics:updated", handleMetricsUpdated);
      };
    } catch (error) {
      console.debug(
        "[useMetrics] Erro ao configurar listener WebSocket:",
        error,
      );
    }
  }, [queryClient]);

  return query;
}
