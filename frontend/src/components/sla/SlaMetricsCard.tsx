import React from "react";

interface SlaMetricsCardProps {
  title: string;
  percentual: number;
  chamadosAtivos: number;
  timeAv: string;
}

export const SlaMetricsCard: React.FC<SlaMetricsCardProps> = ({
  title,
  percentual,
  chamadosAtivos,
  timeAv,
}) => {
  const isHealthy = percentual >= 80;
  const statusColor =
    percentual >= 95
      ? "bg-green-100 text-green-800"
      : percentual >= 80
        ? "bg-yellow-100 text-yellow-800"
        : "bg-red-100 text-red-800";

  return (
    <div className="sla-metrics-card bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>

      <div className={`${statusColor} rounded-lg p-4 mb-4`}>
        <div className="text-3xl font-bold">{percentual.toFixed(1)}%</div>
        <div className="text-sm mt-1">Taxa de cumprimento</div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-gray-600 text-sm">Chamados Ativos</div>
          <div className="text-2xl font-bold text-gray-900">
            {chamadosAtivos}
          </div>
        </div>
        <div>
          <div className="text-gray-600 text-sm">Tempo Médio</div>
          <div className="text-lg font-semibold text-gray-900">{timeAv}</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4 bg-gray-200 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${
            percentual >= 95
              ? "bg-green-500"
              : percentual >= 80
                ? "bg-yellow-500"
                : "bg-red-500"
          }`}
          style={{ width: `${Math.min(percentual, 100)}%` }}
        />
      </div>
    </div>
  );
};
