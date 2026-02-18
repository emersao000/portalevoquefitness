import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { Trash2, Plus, Edit2, Grid3x3, List, Zap, Package } from "lucide-react";

export function AdicionarUnidade() {
  const [id, setId] = useState<string>("");
  const [nome, setNome] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleAdd() {
    setMsg(null);
    if (!nome) return;
    setSaving(true);
    try {
      const res = await apiFetch("/unidades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: id ? Number(id) : undefined, nome }),
      });
      if (!res.ok) {
        let detail = "Não foi possível criar a unidade.";
        try {
          const data = await res.json();
          if (data && typeof data.detail === "string") detail = data.detail;
        } catch {}
        if (res.status === 409) {
          setMsg(detail);
          return;
        }
        throw new Error(detail);
      }
      setId("");
      setNome("");
      setMsg("Unidade criada com sucesso.");
    } catch (e: any) {
      setMsg(e?.message || "Não foi possível criar a unidade.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold text-sm">Adicionar Unidade</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Crie uma nova unidade no sistema
          </p>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <input
            className="rounded-md bg-background border px-3 py-2 text-sm"
            placeholder="Nome da unidade"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <input
            className="rounded-md bg-background border px-3 py-2 text-sm"
            placeholder="ID (opcional)"
            value={id}
            onChange={(e) => setId(e.target.value)}
          />
          <Button disabled={saving} onClick={handleAdd} className="h-10">
            {saving ? "Salvando..." : "Adicionar"}
          </Button>
        </div>
        {msg && (
          <div
            className={`text-xs px-3 py-2 rounded-md ${
              msg.includes("sucesso")
                ? "bg-green-100/50 text-green-700 dark:bg-green-900/20 dark:text-green-300"
                : "bg-amber-100/50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
            }`}
          >
            {msg}
          </div>
        )}
      </div>
    </Card>
  );
}

function ListUnidadeItem({ unidade, onDelete }: { unidade: { id: number; nome: string }; onDelete: (id: number) => void }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Tem certeza que deseja deletar a unidade "${unidade.nome}"?`)) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/unidades/${unidade.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao deletar unidade");
      onDelete(unidade.id);
    } catch (e) {
      alert("Não foi possível deletar a unidade");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Package className="w-4 h-4 text-primary flex-shrink-0" />
        <h4 className="font-medium text-sm truncate">{unidade.nome}</h4>
      </div>
      <div className="flex items-center gap-3 whitespace-nowrap ml-2">
        <div className="text-xs text-muted-foreground">
          ID: {unidade.id}
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="p-1 hover:bg-destructive/10 rounded transition-colors disabled:opacity-50"
          title="Deletar unidade"
        >
          <Trash2 className="w-4 h-4 text-destructive" />
        </button>
      </div>
    </div>
  );
}

function UnidadeCard({ nome, id, onDelete }: { nome: string; id: number; onDelete: (id: number) => void }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Tem certeza que deseja deletar a unidade "${nome}"?`)) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/unidades/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao deletar unidade");
      onDelete(id);
    } catch (e) {
      alert("Não foi possível deletar a unidade");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-lg border border-border/60 bg-card overflow-hidden hover:shadow-md hover:border-primary/20 transition-all">
      <div className="px-4 py-3 border-b border-border/60 bg-muted/30 flex items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-primary" />
          <div className="font-semibold text-sm text-primary truncate">
            {nome}
          </div>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="p-1 hover:bg-destructive/10 rounded transition-colors disabled:opacity-50"
          title="Deletar unidade"
        >
          <Trash2 className="w-4 h-4 text-destructive" />
        </button>
      </div>
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">ID</span>
          <span className="font-semibold text-sm text-primary">{id}</span>
        </div>
      </div>
    </div>
  );
}

export function ListarUnidades() {
  type Unidade = { id: number; nome: string; cidade?: string };
  const [items, setItems] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const load = () => {
    setLoading(true);
    apiFetch("/unidades")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("fail"))))
      .then((data: Unidade[]) => Array.isArray(data) && setItems(data))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleDeleteUnidade = (deletedId: number) => {
    setItems((prev) => prev.filter((u) => u.id !== deletedId));
  };

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm">Unidades</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {items.length} unidade{items.length !== 1 ? "s" : ""} cadastrada
              {items.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            <Button
              type="button"
              variant={viewMode === "grid" ? "default" : "ghost"}
              onClick={() => setViewMode("grid")}
              size="sm"
              className="h-8 px-3"
            >
              <Grid3x3 className="h-4 w-4" />
              Grade
            </Button>
            <Button
              type="button"
              variant={viewMode === "list" ? "default" : "ghost"}
              onClick={() => setViewMode("list")}
              size="sm"
              className="h-8 px-3"
            >
              <List className="h-4 w-4" />
              Lista
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            Carregando...
          </div>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            Nenhuma unidade cadastrada.
          </div>
        ) : (
          <div>
            {viewMode === "grid" && (
              <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
                {items.map((u) => (
                  <UnidadeCard
                    key={`${u.id}-${u.nome}`}
                    id={u.id}
                    nome={u.nome}
                    onDelete={handleDeleteUnidade}
                  />
                ))}
              </div>
            )}
            {viewMode === "list" && (
              <div className="space-y-2">
                {items.map((u) => (
                  <ListUnidadeItem key={`${u.id}-${u.nome}`} unidade={u} onDelete={handleDeleteUnidade} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function ProblemaCard({
  id,
  nome,
  prioridade,
  requerInternet,
  onDelete,
}: {
  id: number;
  nome: string;
  prioridade: string;
  requerInternet: boolean;
  onDelete: (id: number) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const priorityColor = {
    Normal: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300",
    Alta: "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300",
    Crítica: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300",
    Baixa:
      "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300",
  } as Record<string, string>;

  const handleDelete = async () => {
    if (!confirm(`Tem certeza que deseja deletar o problema "${nome}"?`)) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/problemas/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao deletar problema");
      onDelete(id);
    } catch (e) {
      alert("Não foi possível deletar o problema");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-lg border border-border/60 bg-card overflow-hidden hover:shadow-md hover:border-primary/20 transition-all">
      <div className="px-4 py-3 border-b border-border/60 bg-muted/30 flex items-center gap-2 justify-between">
        <div className="font-semibold text-sm text-primary truncate">
          {nome}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium rounded-full px-2.5 py-1 whitespace-nowrap ${priorityColor[prioridade] || priorityColor.Normal}`}
          >
            {prioridade}
          </span>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-1 hover:bg-destructive/10 rounded transition-colors disabled:opacity-50"
            title="Deletar problema"
          >
            <Trash2 className="w-4 h-4 text-destructive" />
          </button>
        </div>
      </div>
      <div className="p-4">
        {requerInternet && (
          <div className="inline-flex items-center gap-1.5 text-xs font-medium bg-cyan-100 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-300 rounded-full px-2.5 py-1">
            <Zap className="w-3 h-3" />
            Requer Internet
          </div>
        )}
      </div>
    </div>
  );
}

function ListProblemaItem({ problema, onDelete }: { problema: { id: number; nome: string; prioridade: string; requer_internet: boolean }; onDelete: (id: number) => void }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Tem certeza que deseja deletar o problema "${problema.nome}"?`)) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/problemas/${problema.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao deletar problema");
      onDelete(problema.id);
    } catch (e) {
      alert("Não foi possível deletar o problema");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 p-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Package className="w-4 h-4 text-primary flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <h4 className="font-medium text-sm truncate">
            {problema.nome}
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            {problema.prioridade}
            {problema.requer_internet ? " • Internet" : ""}
          </p>
        </div>
      </div>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="p-1 hover:bg-destructive/10 rounded transition-colors disabled:opacity-50 flex-shrink-0 ml-2"
        title="Deletar problema"
      >
        <Trash2 className="w-4 h-4 text-destructive" />
      </button>
    </div>
  );
}

export function AdicionarBanco() {
  type Problema = {
    id: number;
    nome: string;
    prioridade: string;
    requer_internet: boolean;
  };
  const [items, setItems] = useState<Problema[]>([]);
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState("");
  const [prioridade, setPrioridade] = useState("Normal");
  const [requer, setRequer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const load = () => {
    setLoading(true);
    apiFetch("/problemas")
      .then((r) => {
        if (!r.ok) {
          console.error("API error loading problemas:", r.status, r.statusText);
          return Promise.reject(new Error(`HTTP ${r.status}`));
        }
        return r.json();
      })
      .then((data: Problema[]) => {
        if (Array.isArray(data)) {
          setItems(data);
        } else {
          console.error("Invalid data format from /problemas:", data);
          setItems([]);
        }
      })
      .catch((error) => {
        console.error("Error loading problemas:", error);
        setItems([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleDeleteProblema = (deletedId: number) => {
    setItems((prev) => prev.filter((p) => p.id !== deletedId));
  };

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!nome) return;
    setSaving(true);
    try {
      const res = await apiFetch("/problemas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, prioridade, requer_internet: requer }),
      });
      if (!res.ok) throw new Error("Falha ao criar problema");
      setNome("");
      setPrioridade("Normal");
      setRequer(false);
      load();
    } catch {
      // noop, UI simples
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-sm">Adicionar Novo Problema</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Cadastre um novo problema ao banco de dados
            </p>
          </div>
          <form onSubmit={handleAdd} className="grid gap-3 sm:grid-cols-3">
            <input
              className="rounded-md bg-background border px-3 py-2 text-sm"
              placeholder="Nome do Problema"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
            <select
              className="rounded-md bg-background border px-3 py-2 text-sm"
              value={prioridade}
              onChange={(e) => setPrioridade(e.target.value)}
            >
              <option value="Normal">Normal</option>
              <option value="Alta">Alta</option>
              <option value="Crítica">Crítica</option>
              <option value="Baixa">Baixa</option>
            </select>
            <Button disabled={saving} className="h-10">
              <Plus className="w-4 h-4 mr-1" />
              {saving ? "Salvando..." : "Adicionar"}
            </Button>
          </form>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={requer}
              onChange={(e) => setRequer(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <span>Requer acesso à internet</span>
          </label>
        </div>
      </Card>

      <Card className="p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">Problemas Cadastrados</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {items.length} problema{items.length !== 1 ? "s" : ""} no banco
              </p>
            </div>
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              <Button
                type="button"
                variant={viewMode === "grid" ? "default" : "ghost"}
                onClick={() => setViewMode("grid")}
                size="sm"
                className="h-8 px-3"
              >
                <Grid3x3 className="h-4 w-4" />
                Grade
              </Button>
              <Button
                type="button"
                variant={viewMode === "list" ? "default" : "ghost"}
                onClick={() => setViewMode("list")}
                size="sm"
                className="h-8 px-3"
              >
                <List className="h-4 w-4" />
                Lista
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              Carregando...
            </div>
          ) : items.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              Nenhum problema cadastrado.
            </div>
          ) : (
            <div>
              {viewMode === "grid" && (
                <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {items.map((p) => (
                    <ProblemaCard
                      key={`${p.id}-${p.nome}`}
                      id={p.id}
                      nome={p.nome}
                      prioridade={p.prioridade}
                      requerInternet={p.requer_internet}
                      onDelete={handleDeleteProblema}
                    />
                  ))}
                </div>
              )}
              {viewMode === "list" && (
                <div className="space-y-2">
                  {items.map((p) => (
                    <ListProblemaItem key={`${p.id}-${p.nome}`} problema={p} onDelete={handleDeleteProblema} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
