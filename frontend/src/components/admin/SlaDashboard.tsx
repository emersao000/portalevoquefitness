/**
 * Dashboard de SLA - Painel Admin
 * Exibe métricas, alertas e estatísticas de SLA em tempo real
 * Cache: 15 minutos, atualização automática
 */

import React, { useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  useSLA,
  useSLAAlerts,
  formatarPercentual,
  formatarHoras,
  formatarDataRelativa,
} from "@/hooks/useSLA";

// Cores por status
const CORES = {
  emDia: "#10b981",
  emRisco: "#f59e0b",
  vencido: "#ef4444",
  neutral: "#6b7280",
};

export default function SlaDashboard() {
  const sla = useSLA();
  const { alertas, loading: loadingAlertas } = useSLAAlerts();
  const [filtroSelecionado, setFiltroSelecionado] = useState(30);

  const periodos = [
    { dias: 7, label: "1 Semana" },
    { dias: 30, label: "30 Dias" },
    { dias: 60, label: "60 Dias" },
    { dias: 90, label: "90 Dias" },
  ];

  const handleMudarPeriodo = (dias: number) => {
    setFiltroSelecionado(dias);
    sla.mudarPeriodo(dias);
  };

  const handleAtualizar = async () => {
    try {
      await sla.atualizar();
      // Toast de sucesso pode ser adicionado aqui
    } catch (error) {
      console.error("Erro ao atualizar SLA:", error);
      // Toast de erro pode ser adicionado aqui
    }
  };

  // Loading inicial
  if (sla.loading && !sla.metricas) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Carregando SLA...</p>
        </div>
      </div>
    );
  }

  // Erro
  if (sla.error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 m-4">
        <h3 className="text-red-800 font-semibold">Erro ao carregar SLA</h3>
        <p className="text-red-700 text-sm">{sla.error}</p>
        <button
          onClick={() => sla.carregarDados(sla.periodoDias)}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  if (!sla.metricas) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 m-4">
        <p className="text-yellow-800">Nenhum dado de SLA disponível</p>
      </div>
    );
  }

  const metricas = sla.metricas;
  const dashboard = sla.dashboard;

  // Prepara dados para gráficos
  const dadosStatus = [
    {
      name: "Em Dia",
      value:
        metricas.total_chamados -
        metricas.chamados_em_risco -
        metricas.chamados_vencidos,
      fill: CORES.emDia,
    },
    {
      name: "Em Risco",
      value: metricas.chamados_em_risco,
      fill: CORES.emRisco,
    },
    { name: "Vencido", value: metricas.chamados_vencidos, fill: CORES.vencido },
  ];

  const dadosPrioridade = sla.metricasPorPrioridade || [];

  return (
    <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard de SLA</h1>
        <button
          onClick={handleAtualizar}
          disabled={sla.atualizando}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
        >
          {sla.atualizando ? (
            <>
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
              Atualizando...
            </>
          ) : (
            <>🔄 Atualizar Agora</>
          )}
        </button>
      </div>

      {/* Filtros de Período */}
      <div className="flex gap-2">
        {periodos.map((p) => (
          <button
            key={p.dias}
            onClick={() => handleMudarPeriodo(p.dias)}
            className={`px-4 py-2 rounded-lg transition ${
              filtroSelecionado === p.dias
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 border border-gray-300 hover:border-blue-600"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Info de Atualização */}
      {sla.ultimaAtualizacao && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
          <p className="text-blue-800">
            ✓ Dados em cache - Atualizado{" "}
            {formatarDataRelativa(sla.ultimaAtualizacao)}
          </p>
          {sla.proximaAtualizacao && (
            <p className="text-blue-700">
              Próxima atualização automática em{" "}
              {formatarDataRelativa(sla.proximaAtualizacao)}
            </p>
          )}
        </div>
      )}

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total de Chamados */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-gray-600 text-sm font-semibold">
            Total de Chamados
          </h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {metricas.total_chamados}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {metricas.chamados_abertos} abertos
          </p>
        </div>

        {/* Cumprimento */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-gray-600 text-sm font-semibold">
            Taxa Cumprimento
          </h3>
          <p
            className={`text-3xl font-bold mt-2 ${formatarPercentual(metricas.percentual_cumprimento).cor}`}
          >
            {metricas.percentual_cumprimento.toFixed(1)}%
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {metricas.chamados_vencidos} vencidos
          </p>
        </div>

        {/* Em Risco */}
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
          <h3 className="text-gray-600 text-sm font-semibold">Em Risco</h3>
          <p className="text-3xl font-bold text-yellow-600 mt-2">
            {metricas.chamados_em_risco}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {metricas.percentual_em_risco.toFixed(1)}% do total
          </p>
        </div>

        {/* Vencidos */}
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
          <h3 className="text-gray-600 text-sm font-semibold">Vencidos</h3>
          <p className="text-3xl font-bold text-red-600 mt-2">
            {metricas.chamados_vencidos}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {metricas.percentual_vencidos.toFixed(1)}% do total
          </p>
        </div>

        {/* Pausados */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-gray-600 text-sm font-semibold">Pausados</h3>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {metricas.chamados_pausados}
          </p>
          <p className="text-xs text-gray-500 mt-1">Aguardando/Análise</p>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribuição de Status */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Distribuição de Status
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={dadosStatus}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name} (${value})`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {dadosStatus.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Métricas por Prioridade */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Cumprimento por Prioridade
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dadosPrioridade}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="prioridade" />
              <YAxis
                label={{
                  value: "Cumprimento %",
                  angle: -90,
                  position: "insideLeft",
                }}
              />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="percentual_vencidos"
                stackId="a"
                fill={CORES.vencido}
                name="Vencidos %"
              />
              <Bar
                dataKey="percentual_em_risco"
                stackId="a"
                fill={CORES.emRisco}
                name="Em Risco %"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chamados em Risco */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-yellow-600 mb-4 flex items-center gap-2">
            ⚠️ Chamados em Risco ({alertas.emRisco.length})
          </h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {alertas.emRisco.length > 0 ? (
              alertas.emRisco.slice(0, 10).map((chamado: any) => (
                <div
                  key={chamado.id}
                  className="border border-yellow-200 rounded p-3 bg-yellow-50"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {chamado.codigo}
                      </p>
                      <p className="text-sm text-gray-600">
                        {chamado.prioridade} • {chamado.status}
                      </p>
                    </div>
                    <span className="text-lg font-bold text-yellow-600">
                      {chamado.percentual_resolucao.toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-8">
                ✅ Nenhum chamado em risco
              </p>
            )}
          </div>
        </div>

        {/* Chamados Vencidos */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-red-600 mb-4 flex items-center gap-2">
            🔴 Chamados Vencidos ({alertas.vencidos.length})
          </h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {alertas.vencidos.length > 0 ? (
              alertas.vencidos.slice(0, 10).map((chamado: any) => (
                <div
                  key={chamado.id}
                  className="border border-red-200 rounded p-3 bg-red-50"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {chamado.codigo}
                      </p>
                      <p className="text-sm text-gray-600">
                        {chamado.prioridade} • Vencido há{" "}
                        {formatarHoras(chamado.tempo_vencimento_horas || 0)}
                      </p>
                    </div>
                    <span className="text-lg font-bold text-red-600">
                      {chamado.percentual_resolucao.toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-8">
                ✅ Nenhum chamado vencido
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Observações */}
      {dashboard?.observacoes && dashboard.observacoes.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            📊 Observações
          </h3>
          <div className="space-y-2">
            {dashboard.observacoes.map((obs, idx) => (
              <p key={idx} className="text-gray-700">
                {obs}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-sm text-gray-500 pt-6 border-t">
        <p>
          Dados atualizados automaticamente a cada 15 minutos
          {sla.ultimaAtualizacao && (
            <>
              {" "}
              • Última atualização: {sla.ultimaAtualizacao.toLocaleTimeString()}
            </>
          )}
        </p>
      </div>
    </div>
  );
}
