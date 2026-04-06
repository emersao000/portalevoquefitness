import React from "react";
import { SlaChamadoStatus } from "../../services/slaService";
import { AlertTriangle, AlertCircle, Clock } from "lucide-react";

interface SlaAlertsListProps {
  title: string;
  chamados: SlaChamadoStatus[];
  type: "em_risco" | "vencido" | "pausado";
}

export const SlaAlertsList: React.FC<SlaAlertsListProps> = ({
  title,
  chamados,
  type,
}) => {
  const getIcon = () => {
    switch (type) {
      case "vencido":
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      case "em_risco":
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case "pausado":
        return <Clock className="w-5 h-5 text-blue-500" />;
      default:
        return null;
    }
  };

  const getHeaderColor = () => {
    switch (type) {
      case "vencido":
        return "bg-red-50 border-red-200";
      case "em_risco":
        return "bg-yellow-50 border-yellow-200";
      case "pausado":
        return "bg-blue-50 border-blue-200";
      default:
        return "bg-gray-50";
    }
  };

  const getBadgeColor = (percentual: number) => {
    if (percentual >= 100) return "bg-red-100 text-red-800";
    if (percentual >= 80) return "bg-yellow-100 text-yellow-800";
    return "bg-gray-100 text-gray-800";
  };

  return (
    <div
      className={`sla-alerts-list border rounded-lg overflow-hidden ${getHeaderColor()}`}
    >
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          {getIcon()}
          <h3 className="font-semibold text-gray-800">{title}</h3>
        </div>
        <span className="bg-white px-2 py-1 rounded text-sm font-semibold text-gray-700">
          {chamados.length}
        </span>
      </div>

      {chamados.length === 0 ? (
        <div className="p-4 text-center text-gray-500 text-sm">
          Nenhum chamado{" "}
          {type === "vencido"
            ? "vencido"
            : type === "em_risco"
              ? "em risco"
              : "pausado"}
        </div>
      ) : (
        <div className="divide-y">
          {chamados.slice(0, 10).map((chamado) => (
            <div
              key={chamado.chamado_id}
              className="p-3 hover:bg-gray-50 transition"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-gray-800">
                    {chamado.codigo} - {chamado.solicitante}
                  </div>
                  <div className="text-xs text-gray-600 truncate">
                    {chamado.problema}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {chamado.unidade && `Unidade: ${chamado.unidade}`}
                  </div>
                </div>
                <div className="text-right whitespace-nowrap">
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-semibold ${getBadgeColor(
                      chamado.percentual_consumido,
                    )}`}
                  >
                    {chamado.percentual_consumido.toFixed(0)}%
                  </span>
                  <div className="text-xs text-gray-500 mt-1">
                    {chamado.tempo_restante_horas.toFixed(1)}h restante
                  </div>
                </div>
              </div>
            </div>
          ))}
          {chamados.length > 10 && (
            <div className="p-3 text-center text-sm text-gray-500">
              +{chamados.length - 10} mais
            </div>
          )}
        </div>
      )}
    </div>
  );
};
