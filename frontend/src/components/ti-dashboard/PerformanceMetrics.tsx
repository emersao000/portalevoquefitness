import { Clock, RefreshCw, AlertCircle, List } from "lucide-react";

interface PerformanceMetricsProps {
  tempoResolucaoMedio: string;
  primeiraRespostMedia: string;
  taxaReaberturas: string;
  chamadosBacklog: number;
  loading?: boolean;
}

export function PerformanceMetrics({
  tempoResolucaoMedio,
  primeiraRespostMedia,
  taxaReaberturas,
  chamadosBacklog,
  loading,
}: PerformanceMetricsProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-6 flex items-center justify-center h-40">
        <p className="text-muted-foreground">Carregando dados...</p>
      </div>
    );
  }

  const metrics = [
    {
      label: "Tempo médio de resolução",
      value: tempoResolucaoMedio,
      icon: <Clock className="w-5 h-5 text-primary" />,
    },
    {
      label: "Primeira resposta",
      value: primeiraRespostMedia,
      icon: <AlertCircle className="w-5 h-5 text-primary" />,
    },
    {
      label: "Taxa de reaberturas",
      value: taxaReaberturas,
      icon: <RefreshCw className="w-5 h-5 text-primary" />,
    },
    {
      label: "Chamados em backlog",
      value: chamadosBacklog.toString(),
      icon: <List className="w-5 h-5 text-primary" />,
    },
  ];

  return (
    <div className="rounded-xl border border-border/60 bg-card p-6">
      <h3 className="text-lg font-semibold mb-6">Desempenho do mês</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, index) => (
          <div
            key={index}
            className="flex items-start gap-4 p-4 rounded-lg bg-background/50"
          >
            {metric.icon}
            <div className="flex-1">
              <p className="text-sm text-muted-foreground mb-1">
                {metric.label}
              </p>
              <p className="text-xl font-bold">{metric.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
