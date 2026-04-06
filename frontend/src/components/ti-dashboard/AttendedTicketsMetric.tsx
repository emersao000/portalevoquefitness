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
    <div className="rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white p-4 flex items-center gap-3">
      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
        <Download
          className="w-5 h-5 cursor-pointer hover:scale-110 transition-transform"
          onClick={handleDownloadExcel}
          title="Baixar relatório Excel"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium opacity-80 leading-tight mb-0.5">
          {startDate && endDate
            ? `${format(parseISO(startDate), "dd/MM")} – ${format(parseISO(endDate), "dd/MM", { locale: ptBR })}`
            : "Últimos 30 dias"}
        </div>
        {loading ? (
          <div className="h-7 w-12 bg-blue-400/60 animate-pulse rounded mt-1" />
        ) : error ? (
          <div className="text-xs text-red-200">{error}</div>
        ) : (
          <>
            <div className="text-2xl font-extrabold leading-none">{reportData?.count || 0}</div>
            <div className="text-xs opacity-75 leading-tight mt-0.5">chamados atendidos</div>
          </>
        )}
      </div>
    </div>
  );
}
