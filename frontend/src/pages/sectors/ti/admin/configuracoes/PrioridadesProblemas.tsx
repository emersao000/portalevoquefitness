import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { apiFetch, api } from "@/lib/api";
import { Grid3x3, List, ChevronLeft, ChevronRight } from "lucide-react";

interface Problema {
  id: number;
  nome: string;
  prioridade: string;
  requer_internet: boolean;
  tempo_resolucao_horas: number | null;
}

const PRIORIDADES = ["Crítica", "Alta", "Normal", "Baixa"];
const ITEMS_PER_PAGE = 12;

export function PrioridadesProblemas() {
  const [problemas, setProblemas] = useState<Problema[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPrioridade, setFilterPrioridade] = useState<string>("Todos");
  const [currentPage, setCurrentPage] = useState(1);
  const [formData, setFormData] = useState({
    nome: "",
    prioridade: "Normal",
    tempo_resolucao_horas: "",
    requer_internet: false,
  });

  useEffect(() => {
    carregarProblemas();
  }, []);

  const carregarProblemas = async () => {
    try {
      setLoading(true);
      const response = await apiFetch("/problemas");
      if (!response.ok) throw new Error("Falha ao carregar problemas");
      const data = await response.json();
      setProblemas(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erro ao carregar problemas:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os problemas",
        variant: "destructive",
      });
      setProblemas([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome.trim()) {
      toast({
        title: "Aviso",
        description: "Nome do problema é obrigatório",
      });
      return;
    }

    try {
      const payload = {
        nome: formData.nome.trim(),
        prioridade: formData.prioridade,
        tempo_resolucao_horas: formData.tempo_resolucao_horas
          ? parseInt(formData.tempo_resolucao_horas)
          : null,
        requer_internet: formData.requer_internet,
      };

      if (editingId) {
        const patchPayload = {
          prioridade: formData.prioridade,
          tempo_resolucao_horas: formData.tempo_resolucao_horas
            ? parseInt(formData.tempo_resolucao_horas)
            : null,
          requer_internet: formData.requer_internet,
        };

        try {
          await api.patch(`/problemas/${editingId}`, patchPayload);

          toast({
            title: "Sucesso",
            description: "Problema atualizado com sucesso",
          });

          carregarProblemas();
          setFormData({
            nome: "",
            prioridade: "Normal",
            tempo_resolucao_horas: "",
            requer_internet: false,
          });
          setOpen(false);
          setEditingId(null);
        } catch (error: any) {
          let errorMsg = "Falha ao atualizar problema";

          if (error.response?.data?.detail) {
            const detail = error.response.data.detail;
            if (Array.isArray(detail)) {
              errorMsg = detail
                .map((e: any) =>
                  typeof e === "string" ? e : e.msg || "Erro de validação",
                )
                .join("; ");
            } else {
              errorMsg = detail;
            }
          }

          console.error("Erro ao atualizar problema:", errorMsg);
          toast({
            title: "Erro",
            description: errorMsg,
            variant: "destructive",
          });
        }
      } else {
        const response = await apiFetch("/problemas", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("Erro ao criar problema:", errorData);
          throw new Error(errorData.detail || "Falha ao criar problema");
        }

        toast({
          title: "Sucesso",
          description: "Problema criado com sucesso",
        });

        carregarProblemas();
        setFormData({
          nome: "",
          prioridade: "Normal",
          tempo_resolucao_horas: "",
          requer_internet: false,
        });
        setOpen(false);
      }
    } catch (error) {
      console.error("Erro ao salvar problema:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o problema",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (problema: Problema) => {
    setEditingId(problema.id);
    setFormData({
      nome: problema.nome,
      prioridade: problema.prioridade,
      tempo_resolucao_horas: problema.tempo_resolucao_horas?.toString() || "",
      requer_internet: problema.requer_internet,
    });
    setOpen(true);
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setEditingId(null);
    setFormData({
      nome: "",
      prioridade: "Normal",
      tempo_resolucao_horas: "",
      requer_internet: false,
    });
  };

  const formatTempo = (horas: number | null) => {
    if (!horas) return "—";
    if (horas < 24) return `${horas}h`;
    const dias = horas / 24;
    return dias % 1 === 0 ? `${dias}d` : `${horas}h`;
  };

  const getPrioridadeColor = (prioridade: string) => {
    const colors: Record<string, string> = {
      Crítica: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      Alta: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      Normal: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      Baixa:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    };
    return colors[prioridade] || colors.Normal;
  };

  const filteredProblemas = useMemo(() => {
    return problemas.filter((problema) => {
      const matchesSearch = problema.nome
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesPrioridade =
        filterPrioridade === "Todos" ||
        problema.prioridade === filterPrioridade;
      return matchesSearch && matchesPrioridade;
    });
  }, [problemas, searchTerm, filterPrioridade]);

  const totalPages = Math.ceil(filteredProblemas.length / ITEMS_PER_PAGE);
  const paginatedProblemas = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProblemas.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredProblemas, currentPage]);

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const renderProblemaCard = (problema: Problema) => {
    const commonContent = (
      <>
        <div className="flex-1">
          <h3 className="font-medium text-sm sm:text-base">{problema.nome}</h3>
          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
            <span
              className={`inline-block px-2 py-1 rounded-md text-xs font-medium ${getPrioridadeColor(problema.prioridade)}`}
            >
              {problema.prioridade}
            </span>
            {problema.tempo_resolucao_horas && (
              <span className="text-muted-foreground">
                Prazo: {formatTempo(problema.tempo_resolucao_horas)}
              </span>
            )}
            {problema.requer_internet && (
              <span className="text-muted-foreground">Requer Internet</span>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleEdit(problema)}
          className="text-xs"
        >
          Editar
        </Button>
      </>
    );

    if (viewMode === "grid") {
      return (
        <div
          key={problema.id}
          className="card-surface rounded-lg p-4 border border-border/60 flex flex-col gap-3"
        >
          {commonContent}
        </div>
      );
    }

    return (
      <div
        key={problema.id}
        className="card-surface rounded-lg p-4 flex items-center justify-between gap-4 border border-border/60"
      >
        {commonContent}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Problemas e Prioridades</h2>
        <p className="text-sm text-muted-foreground">
          Gerencie as prioridades padrão e tempos de resolução dos problemas
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-3">
          <div className="flex-1 space-y-2">
            <Label htmlFor="search" className="text-xs font-medium">
              Buscar problema
            </Label>
            <Input
              id="search"
              placeholder="Digite o nome do problema..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9"
            />
          </div>

          <div className="space-y-2 sm:min-w-[160px]">
            <Label htmlFor="prioridade-filter" className="text-xs font-medium">
              Filtrar por prioridade
            </Label>
            <Select
              value={filterPrioridade}
              onValueChange={(value) => {
                setFilterPrioridade(value);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger id="prioridade-filter" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                {PRIORIDADES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="h-9 w-9 p-0"
              title="Visualizar como lista"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className="h-9 w-9 p-0"
              title="Visualizar como grade"
            >
              <Grid3x3 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {filteredProblemas.length > 0 && (
          <div className="text-xs text-muted-foreground">
            Mostrando {paginatedProblemas.length} de {filteredProblemas.length}{" "}
            problemas
            {filteredProblemas.length !== problemas.length &&
              ` (filtrados de ${problemas.length})`}
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          Carregando problemas...
        </div>
      ) : problemas.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Nenhum problema cadastrado.
        </div>
      ) : filteredProblemas.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Nenhum problema encontrado com os filtros selecionados.
        </div>
      ) : (
        <>
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                : "space-y-3"
            }
          >
            {paginatedProblemas.map((problema) => renderProblemaCard(problema))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .slice(
                    Math.max(0, currentPage - 2),
                    Math.min(totalPages, currentPage + 1),
                  )
                  .map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(page)}
                      className="h-8 w-8 p-0 text-xs"
                    >
                      {page}
                    </Button>
                  ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Problema" : "Novo Problema"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="nome">Nome do Problema</Label>
              <Input
                id="nome"
                placeholder="Ex: Hardware, Software, Rede..."
                value={formData.nome}
                onChange={(e) =>
                  setFormData({ ...formData, nome: e.target.value })
                }
                disabled={editingId !== null}
                className={editingId !== null ? "opacity-50" : ""}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="prioridade">Prioridade Padrão</Label>
              <Select
                value={formData.prioridade}
                onValueChange={(value) =>
                  setFormData({ ...formData, prioridade: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORIDADES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tempo">Tempo Máximo de Resolução (horas)</Label>
              <Input
                id="tempo"
                type="number"
                placeholder="Ex: 24, 48, 72..."
                value={formData.tempo_resolucao_horas}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    tempo_resolucao_horas: e.target.value,
                  })
                }
                min="1"
              />
              <p className="text-xs text-muted-foreground">
                Deixe vazio para não definir prazo
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="internet"
                checked={formData.requer_internet}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    requer_internet: e.target.checked,
                  })
                }
                className="rounded border-gray-300"
              />
              <Label htmlFor="internet" className="mb-0">
                Requer Item de Internet
              </Label>
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
              >
                Cancelar
              </Button>
              <Button type="submit">{editingId ? "Atualizar" : "Criar"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
