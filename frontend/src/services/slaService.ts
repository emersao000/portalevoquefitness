/**
 * Serviço de SLA - Comunicação com API backend
 * Otimizado com cache local e tratamento de erros
 */

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000";

interface MetricasSLA {
  total_chamados: number;
  chamados_abertos: number;
  chamados_em_risco: number;
  chamados_vencidos: number;
  chamados_pausados: number;
  percentual_em_risco: number;
  percentual_vencidos: number;
  percentual_cumprimento: number;
  tempo_medio_resposta_horas: number;
  tempo_medio_resolucao_horas: number;
  cached_at?: string;
}

interface MetricaPrioridade {
  prioridade: string;
  total: number;
  em_risco: number;
  vencidos: number;
  pausados: number;
  percentual_em_risco: number;
  percentual_vencidos: number;
  tempo_medio_resposta_horas: number;
  tempo_medio_resolucao_horas: number;
}

interface Chamado {
  id: number;
  codigo: string;
  prioridade: string;
  status: string;
  percentual_resolucao: number;
  tempo_decorrido_horas: number;
  tempo_limite_horas: number;
  data_abertura: string;
}

interface Dashboard {
  timestamp: string;
  metricas_gerais: MetricasSLA;
  metricas_por_prioridade: MetricaPrioridade[];
  alertas: {
    chamados_em_risco: Chamado[];
    chamados_vencidos: Chamado[];
    total_alertas: number;
  };
  observacoes: string[];
}

interface CacheStatus {
  fonte: string;
  tempo_resposta_ms: string;
  atualizado_em?: string;
}

class SLAService {
  private baseUrl: string;
  private timeout: number;

  constructor() {
    this.baseUrl = `${API_BASE}/api/sla/cache`;
    this.timeout = 5000; // 5 segundos
  }

  /**
   * Faz requisição com timeout
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit = {},
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Obter métricas gerais de SLA
   * @param periodoDias - Número de dias (7, 30, 60, 90)
   */
  async obterMetricas(periodoDias: number = 30): Promise<{
    periodo: { inicio: string; fim: string; dias: number };
    metricas: MetricasSLA;
    cache: CacheStatus;
  }> {
    try {
      const url = `${this.baseUrl}/metricas?periodo_dias=${periodoDias}`;
      const response = await this.fetchWithTimeout(url);

      if (!response.ok) {
        throw new Error(
          `Erro ao obter métricas: ${response.status} ${response.statusText}`,
        );
      }

      return await response.json();
    } catch (error) {
      console.error("Erro ao obter métricas SLA:", error);
      throw error;
    }
  }

  /**
   * Obter métricas por prioridade
   */
  async obterMetricasPorPrioridade(periodoDias: number = 30): Promise<{
    periodo_dias: number;
    por_prioridade: MetricaPrioridade[];
    total_prioridades: number;
  }> {
    try {
      const url = `${this.baseUrl}/metricas/por-prioridade?periodo_dias=${periodoDias}`;
      const response = await this.fetchWithTimeout(url);

      if (!response.ok) {
        throw new Error(`Erro ao obter métricas por prioridade`);
      }

      return await response.json();
    } catch (error) {
      console.error("Erro ao obter métricas por prioridade:", error);
      throw error;
    }
  }

  /**
   * Obter chamados em risco
   */
  async obterChamadosEmRisco(): Promise<{
    total: number;
    chamados: Chamado[];
    alerta: string;
    mensagem: string;
  }> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/chamados/em-risco`,
      );

      if (!response.ok) {
        throw new Error(`Erro ao obter chamados em risco`);
      }

      return await response.json();
    } catch (error) {
      console.error("Erro ao obter chamados em risco:", error);
      throw error;
    }
  }

  /**
   * Obter chamados vencidos
   */
  async obterChamadosVencidos(): Promise<{
    total: number;
    chamados: Chamado[];
    alerta: string;
    severidade: string;
  }> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/chamados/vencidos`,
      );

      if (!response.ok) {
        throw new Error(`Erro ao obter chamados vencidos`);
      }

      return await response.json();
    } catch (error) {
      console.error("Erro ao obter chamados vencidos:", error);
      throw error;
    }
  }

  /**
   * Obter dashboard executivo completo
   */
  async obterDashboard(): Promise<Dashboard> {
    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/dashboard`);

      if (!response.ok) {
        throw new Error(`Erro ao obter dashboard`);
      }

      return await response.json();
    } catch (error) {
      console.error("Erro ao obter dashboard:", error);
      throw error;
    }
  }

  /**
   * Obter SLA de um chamado específico
   */
  async obterSLAChamado(chamadoId: number): Promise<any> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/chamado/${chamadoId}`,
      );

      if (!response.ok) {
        throw new Error(`Erro ao obter SLA do chamado ${chamadoId}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Erro ao obter SLA do chamado ${chamadoId}:`, error);
      throw error;
    }
  }

  /**
   * Atualizar SLA manualmente
   */
  async atualizarSLA(): Promise<{
    sucesso: boolean;
    mensagem: string;
    timestamp: string;
    dados_atualizados: {
      chamados_processados: number;
      em_risco: number;
      vencidos: number;
      pausados: number;
    };
  }> {
    try {
      const response = await this.fetchWithTimeout(
        `${this.baseUrl}/atualizar`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        throw new Error(`Erro ao atualizar SLA`);
      }

      return await response.json();
    } catch (error) {
      console.error("Erro ao atualizar SLA:", error);
      throw error;
    }
  }

  /**
   * Obter status do cache
   */
  async obterStatusCache(): Promise<{
    status: string;
    tipo_cache: string;
    ttl_padrao_minutos: number;
    estatisticas: any;
    atualizacao_intervalo_minutos: number;
  }> {
    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/status`);

      if (!response.ok) {
        throw new Error(`Erro ao obter status do cache`);
      }

      return await response.json();
    } catch (error) {
      console.error("Erro ao obter status do cache:", error);
      throw error;
    }
  }

  /**
   * Limpar cache
   */
  async limparCache(): Promise<{
    sucesso: boolean;
    mensagem: string;
    proxima_atualizacao: string;
  }> {
    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/limpar`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(`Erro ao limpar cache`);
      }

      return await response.json();
    } catch (error) {
      console.error("Erro ao limpar cache:", error);
      throw error;
    }
  }
}

export const slaService = new SLAService();
export type { MetricasSLA, MetricaPrioridade, Chamado, Dashboard, CacheStatus };
