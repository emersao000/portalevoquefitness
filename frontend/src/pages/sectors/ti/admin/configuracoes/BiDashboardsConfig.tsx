import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { clearBISubcategoriesCache } from "@/data/sectors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BarChart3,
  Plus,
  Trash2,
  Edit2,
  Shield,
  Users,
  Globe,
  Lock,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface Dashboard {
  id: number;
  dashboard_id: string;
  title: string;
  description: string | null;
  report_id: string;
  dataset_id: string | null;
  category: string;
  category_name: string;
  order: number;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

interface Permissions {
  roles: string[];
  users: number[];
  public: boolean;
}

interface DashboardPermissions {
  dashboard_id: string;
  title: string;
  permissoes: Permissions;
  permissoes_atualizadas_em: string | null;
}

const AVAILABLE_ROLES = [
  "Administrador",
  "Gestor",
  "Funcionário",
  "Agente",
  "Financeiro",
  "Comercial",
  "Cobrança",
];

const emptyForm = {
  dashboard_id: "",
  title: "",
  description: "",
  report_id: "",
  dataset_id: "",
  category: "",
  category_name: "",
  order: 0,
  ativo: true,
};

export default function BiDashboardsConfig() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  // Permissions modal
  const [permModal, setPermModal] = useState<string | null>(null);
  const [perms, setPerms] = useState<Permissions>({
    roles: [],
    users: [],
    public: false,
  });
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [savingPerms, setSavingPerms] = useState(false);
  const [newRoleInput, setNewRoleInput] = useState("");

  // Expanded rows
  const [expanded, setExpanded] = useState<string | null>(null);

  const showFeedback = (type: "success" | "error", msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 4000);
  };

  const fetchDashboards = async () => {
    try {
      setLoading(true);
      const res = await apiFetch("/powerbi/db/dashboards");
      if (!res.ok) throw new Error("Erro ao buscar dashboards");
      const data = await res.json();
      setDashboards(data);
    } catch (e) {
      showFeedback("error", "Falha ao carregar dashboards");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboards();
  }, []);

  const handleSubmit = async () => {
    if (!form.dashboard_id || !form.title || !form.report_id || !form.category) {
      showFeedback("error", "Preencha os campos obrigatórios: ID, Título, Report ID e Categoria");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        dashboard_id: form.dashboard_id.trim(),
        title: form.title.trim(),
        description: form.description.trim() || null,
        report_id: form.report_id.trim(),
        dataset_id: form.dataset_id.trim() || null,
        category: form.category.trim().toLowerCase().replace(/\s+/g, "-"),
        category_name: form.category_name.trim() || form.category.trim(),
        order: Number(form.order),
        ativo: form.ativo,
      };

      const res = editingId
        ? await apiFetch(`/powerbi/db/dashboards/${editingId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await apiFetch("/powerbi/db/dashboards", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Erro ao salvar");
      }

      showFeedback("success", editingId ? "Dashboard atualizado!" : "Dashboard criado!");
      clearBISubcategoriesCache();
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      fetchDashboards();
    } catch (e: any) {
      showFeedback("error", e.message || "Erro ao salvar dashboard");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (dashboardId: string, title: string) => {
    if (!confirm(`Desativar dashboard "${title}"?`)) return;
    try {
      const res = await apiFetch(`/powerbi/db/dashboards/${dashboardId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Erro ao deletar");
      clearBISubcategoriesCache();
      showFeedback("success", "Dashboard desativado");
      fetchDashboards();
    } catch {
      showFeedback("error", "Erro ao desativar dashboard");
    }
  };

  const handleEdit = (d: Dashboard) => {
    setForm({
      dashboard_id: d.dashboard_id,
      title: d.title,
      description: d.description || "",
      report_id: d.report_id,
      dataset_id: d.dataset_id || "",
      category: d.category,
      category_name: d.category_name,
      order: d.order,
      ativo: d.ativo,
    });
    setEditingId(d.dashboard_id);
    setShowForm(true);
  };

  const openPermissions = async (dashboardId: string) => {
    setPermModal(dashboardId);
    setLoadingPerms(true);
    try {
      const res = await apiFetch(`/api/dashboard-permissions/${dashboardId}`);
      if (res.ok) {
        const data: DashboardPermissions = await res.json();
        setPerms(data.permissoes);
      }
    } catch {
      setPerms({ roles: [], users: [], public: false });
    } finally {
      setLoadingPerms(false);
    }
  };

  const savePermissions = async () => {
    if (!permModal) return;
    setSavingPerms(true);
    try {
      const res = await apiFetch(`/api/dashboard-permissions/${permModal}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(perms),
      });
      if (!res.ok) throw new Error("Erro ao salvar permissões");
      showFeedback("success", "Permissões salvas!");
      setPermModal(null);
    } catch {
      showFeedback("error", "Erro ao salvar permissões");
    } finally {
      setSavingPerms(false);
    }
  };

  const toggleRole = (role: string) => {
    setPerms((p) => ({
      ...p,
      roles: p.roles.includes(role)
        ? p.roles.filter((r) => r !== role)
        : [...p.roles, role],
    }));
  };

  const addCustomRole = () => {
    const r = newRoleInput.trim();
    if (r && !perms.roles.includes(r)) {
      setPerms((p) => ({ ...p, roles: [...p.roles, r] }));
    }
    setNewRoleInput("");
  };

  // Group dashboards by category
  const grouped = dashboards.reduce((acc, d) => {
    if (!acc[d.category]) acc[d.category] = { name: d.category_name, items: [] };
    acc[d.category].items.push(d);
    return acc;
  }, {} as Record<string, { name: string; items: Dashboard[] }>);

  const currentDashboard = dashboards.find((d) => d.dashboard_id === permModal);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <BarChart3 className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Dashboards Power BI</h2>
            <p className="text-xs text-muted-foreground">
              Gerencie relatórios e permissões de acesso
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchDashboards}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Atualizar
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setForm(emptyForm);
              setEditingId(null);
              setShowForm(true);
            }}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Novo dashboard
          </Button>
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium ${
            feedback.type === "success"
              ? "bg-green-500/10 text-green-600 border border-green-500/20"
              : "bg-red-500/10 text-red-600 border border-red-500/20"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 flex-shrink-0" />
          )}
          {feedback.msg}
        </div>
      )}

      {/* Form Modal */}
      <Dialog open={showForm} onOpenChange={(o) => !saving && setShowForm(o)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar dashboard" : "Novo dashboard"}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do relatório Power BI
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>
                  ID único <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="ex: kpi-cobranca"
                  value={form.dashboard_id}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, dashboard_id: e.target.value }))
                  }
                  disabled={!!editingId}
                />
              </div>
              <div className="space-y-1.5">
                <Label>
                  Título <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="ex: KPI Cobrança"
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input
                placeholder="ex: Indicadores de performance de cobrança"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>
                Report ID <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="ex: 6fb5a5c7-53ea-4661-a8ec-53624dd930f0"
                value={form.report_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, report_id: e.target.value }))
                }
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Extraído da URL do relatório no Power BI Service
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Dataset ID</Label>
              <Input
                placeholder="ex: 782e2d92-796e-4ed3-9dee-2061acd7fa71 (opcional)"
                value={form.dataset_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dataset_id: e.target.value }))
                }
                className="font-mono text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>
                  Categoria (slug) <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="ex: financeiro"
                  value={form.category}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nome da categoria</Label>
                <Input
                  placeholder="ex: Financeiro"
                  value={form.category_name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, category_name: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Ordem</Label>
                <Input
                  type="number"
                  value={form.order}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, order: Number(e.target.value) }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <div className="flex items-center gap-2 h-9">
                  <Switch
                    checked={form.ativo}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v }))}
                  />
                  <span className="text-sm text-muted-foreground">
                    {form.ativo ? "Ativo" : "Inativo"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowForm(false)}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={handleSubmit}
                disabled={saving}
              >
                {saving && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
                {editingId ? "Salvar alterações" : "Criar dashboard"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Permissions Modal */}
      <Dialog open={!!permModal} onOpenChange={(o) => !savingPerms && !o && setPermModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Permissões — {currentDashboard?.title}
            </DialogTitle>
            <DialogDescription>
              Defina quem pode visualizar este dashboard
            </DialogDescription>
          </DialogHeader>

          {loadingPerms ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-5 pt-2">
              {/* Public access */}
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Acesso público</p>
                    <p className="text-xs text-muted-foreground">
                      Todos os usuários logados podem ver
                    </p>
                  </div>
                </div>
                <Switch
                  checked={perms.public}
                  onCheckedChange={(v) =>
                    setPerms((p) => ({ ...p, public: v }))
                  }
                />
              </div>

              {!perms.public && (
                <>
                  {/* Roles */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                      <Label className="text-sm">Perfis com acesso</Label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {AVAILABLE_ROLES.map((role) => (
                        <button
                          key={role}
                          onClick={() => toggleRole(role)}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                            perms.roles.includes(role)
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-secondary text-muted-foreground border-border hover:bg-muted"
                          }`}
                        >
                          {role}
                        </button>
                      ))}
                    </div>
                    {/* Custom role input */}
                    <div className="flex gap-2 mt-1">
                      <Input
                        placeholder="Adicionar perfil customizado..."
                        value={newRoleInput}
                        onChange={(e) => setNewRoleInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addCustomRole()}
                        className="text-sm h-8"
                      />
                      <Button size="sm" variant="outline" className="h-8 px-2" onClick={addCustomRole}>
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    {perms.roles.filter((r) => !AVAILABLE_ROLES.includes(r)).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {perms.roles
                          .filter((r) => !AVAILABLE_ROLES.includes(r))
                          .map((r) => (
                            <span
                              key={r}
                              className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 text-blue-600 border border-blue-500/20 rounded-full text-xs"
                            >
                              {r}
                              <button onClick={() => toggleRole(r)} className="hover:text-red-500">
                                ×
                              </button>
                            </span>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Summary */}
                  <div className="p-3 rounded-lg bg-muted/40 border text-xs text-muted-foreground">
                    {perms.roles.length === 0 && !perms.public ? (
                      <span className="flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5" />
                        Nenhum perfil selecionado — somente admins verão este dashboard
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        Acesso liberado para: {perms.roles.join(", ")}
                      </span>
                    )}
                  </div>
                </>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setPermModal(null)}
                  disabled={savingPerms}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={savePermissions}
                  disabled={savingPerms}
                >
                  {savingPerms && (
                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                  )}
                  Salvar permissões
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dashboard List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : dashboards.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Nenhum dashboard cadastrado ainda
            </p>
            <Button
              size="sm"
              className="mt-4"
              onClick={() => {
                setForm(emptyForm);
                setEditingId(null);
                setShowForm(true);
              }}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Adicionar primeiro dashboard
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([categoryId, group]) => (
            <Card key={categoryId}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-500" />
                  {group.name}
                  <Badge variant="secondary" className="text-xs ml-auto">
                    {group.items.length} dashboard{group.items.length !== 1 ? "s" : ""}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                {group.items.map((d) => (
                  <div
                    key={d.dashboard_id}
                    className="border rounded-lg overflow-hidden"
                  >
                    <div
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() =>
                        setExpanded(
                          expanded === d.dashboard_id ? null : d.dashboard_id
                        )
                      }
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">
                            {d.title}
                          </span>
                          <Badge
                            variant={d.ativo ? "default" : "secondary"}
                            className="text-[10px] py-0"
                          >
                            {d.ativo ? "ativo" : "inativo"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {d.description || "Sem descrição"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            openPermissions(d.dashboard_id);
                          }}
                        >
                          <Shield className="w-3.5 h-3.5 mr-1" />
                          Permissões
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(d);
                          }}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-red-500 hover:text-red-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(d.dashboard_id, d.title);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                        {expanded === d.dashboard_id ? (
                          <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {expanded === d.dashboard_id && (
                      <div className="border-t px-4 py-3 bg-muted/20 space-y-1.5">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                          <div>
                            <span className="text-muted-foreground">Dashboard ID: </span>
                            <code className="font-mono">{d.dashboard_id}</code>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Ordem: </span>
                            <span>{d.order}</span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Report ID: </span>
                            <code className="font-mono text-[11px]">{d.report_id}</code>
                          </div>
                          {d.dataset_id && (
                            <div className="col-span-2">
                              <span className="text-muted-foreground">Dataset ID: </span>
                              <code className="font-mono text-[11px]">{d.dataset_id}</code>
                            </div>
                          )}
                          <div>
                            <span className="text-muted-foreground">Criado: </span>
                            <span>
                              {new Date(d.criado_em).toLocaleDateString("pt-BR")}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Atualizado: </span>
                            <span>
                              {new Date(d.atualizado_em).toLocaleDateString("pt-BR")}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
