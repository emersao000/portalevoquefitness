import { useEffect, useState, useRef } from "react";
import { Download } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { exportToExcel } from "@/lib/excel-export";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TicketData {
  id: number;
  codigo: string;
  protocolo: string;
  solicitante: string;
  problema: string;
  descricao: string;
  status: string;
  prioridade: string;
  unidade: string;
  data_abertura: string | null;
  data_conclusao: string | null;
  data_ultima_atualizacao: string | null;
}

interface ReportData {
  count: number;
  total: number;
  data_relatorio: string;
  tickets: TicketData[];
}

interface Props {
  startDate?: string;
  endDate?: string;
}

export default function AttendedTicketsMetric({ startDate, endDate }: Props) {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use ref para rastrear datas já processadas sem causar re-renders
  const lastProcessedDatesRef = useRef<{ start?: string; end?: string }>({});

  useEffect(() => {
    // Verificar se as datas realmente mudaram
    const datesChanged =
      lastProcessedDatesRef.current.start !== startDate ||
      lastProcessedDatesRef.current.end !== endDate;

    if (!datesChanged) {
      return; // Não fazer nada se as datas não mudaram
    }

    // Validar formato das datas customizadas
    const datesValid =
      startDate &&
      endDate &&
      /^\d{4}-\d{2}-\d{2}$/.test(startDate) &&
      /^\d{4}-\d{2}-\d{2}$/.test(endDate);

    // Se não tem datas customizadas, usa padrão
    if (!startDate || !endDate) {
      const fetchDefault = async () => {
        try {
          setLoading(true);
          const response = await apiFetch("/chamados/report/last-30-days");

          if (!response.ok) {
            throw new Error("Erro ao buscar dados");
          }

          const data = await response.json();
          setReportData(data);
          setError(null);
        } catch (err) {
          console.error("[ATTENDED TICKETS] Erro:", err);
          setError(
            err instanceof Error ? err.message : "Erro ao carregar dados"
          );
          toast.error("Não foi possível carregar os dados dos chamados");
        } finally {
          setLoading(false);
        }
      };

      fetchDefault();
      lastProcessedDatesRef.current = { start: undefined, end: undefined };
      return;
    }

    // Se tem datas customizadas válidas
    if (datesValid) {
      const fetchData = async () => {
        try {
          setLoading(true);
          const url = `/chamados/report?start_date=${startDate}&end_date=${endDate}`;

          console.log("[ATTENDED TICKETS] Buscando com datas:", { startDate, endDate, url });
          const response = await apiFetch(url);

          console.log("[ATTENDED TICKETS] Response status:", response.status);

          if (!response.ok) {
            const errorText = await response.text();
            console.error("[ATTENDED TICKETS] Response error:", errorText);
            throw new Error(`Erro ${response.status} ao buscar dados`);
          }

          const data = await response.json();
          console.log("[ATTENDED TICKETS] Dados recebidos:", data);

          if (!data || data.count === undefined) {
            throw new Error("Resposta inválida do servidor");
          }

          setReportData(data);
          setError(null);
          lastProcessedDatesRef.current = { start: startDate, end: endDate };
        } catch (err) {
          console.error("[ATTENDED TICKETS] Erro completo:", err);
          const errorMsg = err instanceof Error ? err.message : "Erro ao carregar dados";
          setError(errorMsg);
          toast.error(errorMsg);
          lastProcessedDatesRef.current = { start: startDate, end: endDate };
        } finally {
          setLoading(false);
        }
      };

      fetchData();
    }
  }, [startDate, endDate]);

  const handleDownloadExcel = async () => {
    if (!reportData) {
      toast.error("Nenhum dado disponível para exportar");
      return;
    }

    try {
      await exportToExcel(reportData, "relatorio_chamados_30dias.xlsx");
      toast.success("Relatório baixado com sucesso!");
    } catch (err) {
      console.error("[EXCEL EXPORT] Erro:", err);
      toast.error("Erro ao baixar relatório");
    }
  };

  // Estilos dos cards de métrica - mesmo padrão visual
  const colorStyles = {
    gradient: "from-blue-500 to-blue-600",
  };

  return (
    <div className="relative group">
      <div
        className={`absolute -inset-1 bg-gradient-to-r ${colorStyles.gradient} rounded-2xl blur-xl opacity-0 group-hover:opacity-30 transition-opacity duration-300`}
      />
      <div
        className={`relative metric-card rounded-2xl bg-gradient-to-br ${colorStyles.gradient} text-white p-5 overflow-hidden`}
      >
        {/* Background pattern - mesmo dos outros cards */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: "32px 32px",
          }}
        />

        <div className="relative space-y-3">
          <div className="flex items-start justify-between">
            <div className="text-xs font-medium opacity-90">
              {startDate && endDate
                ? `${format(parseISO(startDate), "dd 'de' MMM", { locale: ptBR })} até ${format(parseISO(endDate), "dd 'de' MMM", { locale: ptBR })}`
                : "Últimos 30 Dias"}
            </div>
            <Download className="w-5 h-5 opacity-80 cursor-pointer hover:opacity-100 transition-opacity" onClick={handleDownloadExcel} />
          </div>
          {loading ? (
            <div className="h-10 w-20 bg-blue-400 animate-pulse rounded" />
          ) : error ? (
            <div className="text-sm text-red-100">{error}</div>
          ) : (
            <>
              <div className="text-3xl font-extrabold leading-none">
                {reportData?.count || 0}
              </div>
              <div className="flex items-center gap-1.5 text-xs opacity-90">
                <span>chamados atendidos</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
