/**
 * useSLA - Hook para dados de SLA em tempo real
 * SLA conta: Aberto e Em atendimento
 * SLA pausa: Aguardando
 * Contabiliza apenas chamados abertos >= 16/02/2026
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";

const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutos
const AUTO_REFRESH_MS = 30 * 1000;   // 30 segundos

export interface SlaMetricas {
  total_chamados: number;
  chamados_abertos: number;
  chamados_em_risco: number;
  chamados_vencidos: number;
  chamados_pausados: number;
  percentual_cumprimento: number;
  percentual_em_risco: number;
  percentual_vencidos: number;
  tempo_medio_resposta_horas: number;
  tempo_medio_resolucao_horas: number;
  tempo_medio_resposta_formatado: string;
  tempo_medio_resolucao_formatado: string;
  por_prioridade: SlaPrioridade[];
  lista_em_risco: SlaChamado[];
  lista_vencidos: SlaChamado[];
  lista_pausados: SlaChamado[];
  periodo_inicio: string;
  periodo_fim: string;
  sla_data_inicio: string;
  ultima_atualizacao: string;
}

export interface SlaPrioridade {
  prioridade: string;
  total: number;
  em_risco: number;
  vencidos: number;
  pausados: number;
  percentual_em_risco: number;
  percentual_vencidos: number;
}

export interface SlaChamado {
  chamado_id: number;
  codigo: string;
  prioridade: string;
  status: string;
  pausado: boolean;
  percentual_resolucao: number;
  percentual_resposta: number;
  resolucao_trabalhado_horas: number;
  resolucao_limite_horas: number;
  resolucao_vencida: boolean;
  resolucao_em_risco: boolean;
}

interface CacheEntry {
  data: SlaMetricas;
  timestamp: number;
  periodoDias: number;
}

let _cache: CacheEntry | null = null;

function cacheValido(entry: CacheEntry | null, dias: number): boolean {
  if (!entry || entry.periodoDias !== dias) return false;
  return Date.now() - entry.timestamp < CACHE_TTL_MS;
}

/** Invalida o cache SLA forçando refresh imediato no próximo render */
export function invalidateSLACache(): void {
  _cache = null;
}

export function useSLA(periodoDiasInicial = 30) {
  const [metricas, setMetricas] = useState<SlaMetricas | null>(
    cacheValido(_cache, periodoDiasInicial) ? _cache!.data : null
  );
  const [loading, setLoading] = useState(!cacheValido(_cache, periodoDiasInicial));
  const [atualizando, setAtualizando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [periodoDias, setPeriodoDias] = useState(periodoDiasInicial);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(
    _cache ? new Date(_cache.timestamp) : null
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const carregarDados = useCallback(async (dias: number, silencioso = false) => {
    if (!silencioso) setAtualizando(true);
    try {
      const dataFim = new Date();
      const dataInicio = new Date();
      dataInicio.setDate(dataInicio.getDate() - dias);

      // SLA começa em 16/02/2026
      const slaInicio = new Date("2026-02-16T00:00:00");
      const inicioEfetivo = dataInicio < slaInicio ? slaInicio : dataInicio;

      const params = new URLSearchParams({
        data_inicio: inicioEfetivo.toISOString(),
        data_fim: dataFim.toISOString(),
      });

      const resp = await api.get(`/sla/dashboard?${params}`);
      const data: SlaMetricas = resp.data;

      _cache = { data, timestamp: Date.now(), periodoDias: dias };
      setMetricas(data);
      setUltimaAtualizacao(new Date());
      setError(null);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || "Erro ao carregar SLA";
      setError(msg);
      console.error("[useSLA]", err);
      // Reagenda tentativa rápida após erro (5s)
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setTimeout(() => {
        carregarDados(dias, silencioso);
      }, 5000) as unknown as ReturnType<typeof setInterval>;
    } finally {
      setLoading(false);
      setAtualizando(false);
    }
  }, []);

  useEffect(() => {
    if (!cacheValido(_cache, periodoDias)) {
      carregarDados(periodoDias);
    }
    intervalRef.current = setInterval(() => {
      carregarDados(periodoDias, true);
    }, AUTO_REFRESH_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [periodoDias, carregarDados]);

  const mudarPeriodo = useCallback((dias: number) => {
    setPeriodoDias(dias);
    _cache = null;
    setLoading(true);
    carregarDados(dias);
  }, [carregarDados]);

  const atualizar = useCallback(async () => {
    _cache = null;
    await carregarDados(periodoDias);
  }, [periodoDias, carregarDados]);

  return {
    metricas,
    loading,
    atualizando,
    error,
    periodoDias,
    ultimaAtualizacao,
    proximaAtualizacao: ultimaAtualizacao
      ? new Date(ultimaAtualizacao.getTime() + AUTO_REFRESH_MS)
      : null,
    carregarDados,
    mudarPeriodo,
    atualizar,
    metricasPorPrioridade: metricas?.por_prioridade ?? [],
    dashboard: metricas,
  };
}

export function useSLAAlerts() {
  const { metricas, loading } = useSLA();
  return {
    alertas: {
      emRisco: metricas?.lista_em_risco ?? [],
      vencidos: metricas?.lista_vencidos ?? [],
      pausados: metricas?.lista_pausados ?? [],
    },
    loading,
  };
}

// ─── Helpers de formatação ───────────────────────────────────────────────────

export function formatarPercentual(valor: number): { texto: string; cor: string } {
  const texto = `${valor.toFixed(1)}%`;
  if (valor >= 90) return { texto, cor: "text-green-600" };
  if (valor >= 70) return { texto, cor: "text-yellow-600" };
  return { texto, cor: "text-red-600" };
}

export function formatarHoras(horas: number): string {
  if (!horas || horas <= 0) return "—";
  const h = Math.floor(horas);
  const m = Math.round((horas - h) * 60);
  if (h > 0 && m > 0) return `${h}h ${m}min`;
  if (h > 0) return `${h}h`;
  return `${m}min`;
}

export function formatarDataRelativa(data: Date): string {
  const diff = Date.now() - data.getTime();
  const seg = Math.floor(diff / 1000);
  const min = Math.floor(seg / 60);
  const h = Math.floor(min / 60);
  if (seg < 60) return "agora mesmo";
  if (min < 60) return `${min} min atrás`;
  if (h < 24) return `${h}h atrás`;
  return data.toLocaleDateString("pt-BR");
}
