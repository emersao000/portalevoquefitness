import { useState, useEffect } from "react";
import { X, Clock, User } from "lucide-react";
import { apiFetch } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader } from "lucide-react";

interface AlertViewer {
  id: string;
  email: string;
  nome: string;
  sobrenome?: string;
  visualizado_em?: string;
}

interface AlertViewersModalProps {
  alertId: number;
  alertTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AlertViewersModal({
  alertId,
  alertTitle,
  open,
  onOpenChange,
}: AlertViewersModalProps) {
  const [viewers, setViewers] = useState<AlertViewer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadViewers();
    }
  }, [open, alertId]);

  const loadViewers = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/alerts/${alertId}/viewers`);
      if (res.ok) {
        const data = await res.json();
        setViewers(data.viewers || []);
      }
    } catch (error) {
      console.error("Erro ao carregar viewers:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (isoDate?: string) => {
    if (!isoDate) return "Data não registrada";
    try {
      const date = new Date(isoDate);
      return date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return isoDate;
    }
  };

  const extractNameAndSurname = (viewer: AlertViewer) => {
    if (viewer.sobrenome) {
      return `${viewer.nome} ${viewer.sobrenome}`;
    }
    const parts = viewer.nome.split(" ");
    if (parts.length >= 2) {
      return `${parts[0]} ${parts[parts.length - 1]}`;
    }
    return viewer.nome;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Quem visualizou o alerta
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p className="font-medium">Alerta: {alertTitle}</p>
            <p className="text-xs mt-1">
              Total de visualizações: {viewers.length}
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : viewers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">Nenhuma visualização registrada</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {viewers.map((viewer, index) => (
                <div
                  key={`${viewer.id}-${index}`}
                  className="flex items-start justify-between gap-3 p-3 rounded-lg border bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">
                        {extractNameAndSurname(viewer)}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {viewer.email}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {formatDateTime(viewer.visualizado_em)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
