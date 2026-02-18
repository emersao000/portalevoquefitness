import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { NavLink, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Save,
  Trash2,
  Ticket as TicketIcon,
  UserPlus,
  Paperclip,
  Image as ImageIcon,
  Grid3x3,
  List,
  Search,
  ChevronDown,
} from "lucide-react";
import { ticketsMock } from "../mock";
import { apiFetch, API_BASE } from "@/lib/api";
import { useAuthContext } from "@/lib/auth-context";
import { toast } from "@/hooks/use-toast";

type TicketStatus =
  | "ABERTO"
  | "EM_ANDAMENTO"
  | "EM_ANALISE"
  | "CONCLUIDO"
  | "CANCELADO";

interface UiTicket {
  id: string;
  codigo: string;
  protocolo: string;
  titulo: string;
  solicitante: string;
  unidade: string;
  categoria: string;
  status: TicketStatus;
  criadoEm: string;
  cargo: string;
  email: string;
  telefone: string;
  internetItem?: string | null;
  visita?: string | null;
  gerente?: string | null;
  descricao?: string | null;
}

const statusMap = [
  { key: "todos", label: "Todos" },
  { key: "abertos", label: "Abertos" },
  { key: "em-andamento", label: "Em andamento" },
  { key: "em-analise", label: "Em análise" },
  { key: "concluidos", label: "Concluídos" },
  { key: "cancelados", label: "Cancelados" },
] as const;

function SummaryCard({
  title,
  value,
  bgClass,
}: {
  title: string;
  value: number;
  bgClass: string;
}) {
  return (
    <div className={`rounded-xl p-4 text-white ${bgClass}`}>
      <div className="text-sm/5 opacity-90">{title}</div>
      <div className="text-2xl font-extrabold mt-1">{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: TicketStatus }) {
  const styles =
    status === "ABERTO"
      ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-300"
      : status === "EM_ANDAMENTO"
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
        : status === "EM_ANALISE"
          ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300"
          : status === "CONCLUIDO"
            ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300"
            : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300";
  const label =
    status === "ABERTO"
      ? "Aberto"
      : status === "EM_ANDAMENTO"
        ? "Em andamento"
        : status === "EM_ANALISE"
          ? "Em análise"
          : status === "CONCLUIDO"
            ? "Concluído"
            : "Cancelado";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles}`}
    >
      {label}
    </span>
  );
}

function TicketCard({
  id,
  codigo,
  titulo,
  solicitante,
  unidade,
  categoria,
  status,
  criadoEm,
  onTicket,
  onUpdate,
  onDelete,
}: {
  id: string;
  codigo: string;
  titulo: string;
  solicitante: string;
  unidade: string;
  categoria: string;
  status: TicketStatus;
  criadoEm: string;
  onTicket: () => void;
  onUpdate: (id: string, status: TicketStatus) => void;
  onDelete: (id: string) => void;
}) {
  const [sel, setSel] = useState<TicketStatus>(status);
  return (
    <div className="rounded-lg border border-border/60 bg-card overflow-hidden hover:shadow-md transition-all">
      <div className="px-3 py-2 border-b border-border/60 bg-muted/30 flex items-center justify-between">
        <div className="font-semibold text-sm text-primary">{codigo}</div>
        <StatusPill status={status} />
      </div>

      <div className="p-3 space-y-2.5">
        <div className="font-medium text-sm line-clamp-2">{titulo}</div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          <div className="text-muted-foreground">Solicitante:</div>
          <div className="text-right truncate">{solicitante}</div>

          <div className="text-muted-foreground">Problema:</div>
          <div className="text-right truncate">{categoria}</div>

          <div className="text-muted-foreground">Unidade:</div>
          <div className="text-right truncate">{unidade}</div>

          <div className="text-muted-foreground">Data:</div>
          <div className="text-right">
            {new Date(criadoEm).toLocaleDateString()}
          </div>
        </div>

        <div className="pt-2 border-t border-border/40">
          <Select value={sel} onValueChange={(v) => setSel(v as TicketStatus)}>
            <SelectTrigger
              onClick={(e) => e.stopPropagation()}
              className="h-8 text-xs"
            >
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ABERTO">Aberto</SelectItem>
              <SelectItem value="EM_ANDAMENTO">Em andamento</SelectItem>
              <SelectItem value="EM_ANALISE">Em análise</SelectItem>
              <SelectItem value="CONCLUIDO">Concluído</SelectItem>
              <SelectItem value="CANCELADO">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <Button
            size="sm"
            variant="warning"
            onClick={(e) => {
              e.stopPropagation();
              onUpdate(id, sel);
            }}
            className="h-8 text-xs px-2"
          >
            <Save className="size-3" />
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(id);
            }}
            className="h-8 text-xs px-2"
          >
            <Trash2 className="size-3" />
          </Button>
          <Button
            size="sm"
            variant="info"
            onClick={(e) => {
              e.stopPropagation();
              onTicket();
            }}
            className="h-8 text-xs px-2"
          >
            <TicketIcon className="size-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ChamadosPage() {
  const { filtro } = useParams<{ filtro?: string }>();
  const [items, setItems] = useState<UiTicket[]>([]);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmPwd, setConfirmPwd] = useState("");
  const [confirmLoading, setConfirmLoading] = useState(false);
  const { user } = useAuthContext();

  // Infinite scroll state
  const [visibleTickets, setVisibleTickets] = useState(6);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const ticketsContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreTicketsRef = useRef<HTMLDivElement>(null);

  // Unit filter state
  const [selectedUnidades, setSelectedUnidades] = useState<string[]>([]);
  const [searchUnidade, setSearchUnidade] = useState("");
  const [searchInputValue, setSearchInputValue] = useState("");

  useEffect(() => {
    apiFetch("/usuarios")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("fail"))))
      .then((data) => {
        if (Array.isArray(data)) {
          const agentsData = data.filter(
            (u: any) =>
              u.nivel_acesso &&
              (u.nivel_acesso.toLowerCase().includes("agente") ||
                u.nivel_acesso.toLowerCase() === "administrador"),
          );
          setAgents(
            agentsData.map((u: any) => ({
              id: u.id,
              nome: u.nome,
              email: u.email,
            })),
          );
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function toUiStatus(s: string): TicketStatus {
      const n = (s || "")
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toUpperCase();
      const nn = n.replace(/\s+/g, "_");
      if (nn === "EM_ANDAMENTO" || nn === "AGUARDANDO") return "EM_ANDAMENTO";
      if (nn === "EM_ANALISE") return "EM_ANALISE";
      if (nn === "CONCLUIDO") return "CONCLUIDO";
      if (nn === "CANCELADO") return "CANCELADO";
      return "ABERTO";
    }

    function adapt(it: any): UiTicket {
      const titulo =
        it.problema === "Internet" && it.internet_item
          ? `Internet - ${it.internet_item}`
          : it.problema;
      return {
        id: String(it.id),
        codigo: it.codigo,
        protocolo: it.protocolo,
        titulo,
        solicitante: it.solicitante,
        unidade: it.unidade,
        categoria: it.problema,
        status: toUiStatus(it.status || "Aberto"),
        criadoEm: it.data_abertura || new Date().toISOString(),
        cargo: it.cargo,
        email: it.email,
        telefone: it.telefone,
        internetItem: it.internet_item ?? null,
        visita: it.data_visita ?? null,
        gerente: null,
        descricao: it.descricao ?? null,
      };
    }

    function adaptMock(m: (typeof ticketsMock)[number]): UiTicket {
      return {
        id: m.id,
        codigo: (m as any).codigo || String(m.id),
        protocolo: m.protocolo,
        titulo: m.titulo,
        solicitante: m.solicitante,
        unidade: m.unidade,
        categoria: m.categoria,
        status: m.status,
        criadoEm: m.criadoEm,
        cargo: m.cargo,
        email: m.email,
        telefone: m.telefone,
        internetItem: m.internetItem ?? null,
        visita: m.visita ?? null,
        gerente: m.gerente ?? null,
        descricao: (m as any).descricao ?? null,
      };
    }

    // Calculate date 30 days ago for filtering
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const dateParam = thirtyDaysAgo.toISOString().split("T")[0]; // YYYY-MM-DD format

    apiFetch(`/chamados?after_date=${dateParam}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("fail"))))
      .then((data) =>
        setItems(
          Array.isArray(data) ? data.map(adapt) : ticketsMock.map(adaptMock),
        ),
      )
      .catch(() => setItems(ticketsMock.map(adaptMock)));

    // Socket.IO
    import("socket.io-client").then(({ io }) => {
      const base = API_BASE;
      const origin = base.replace(/\/?api$/, "");
      const socket = io(origin, {
        path: "/socket.io",
        transports: ["websocket", "polling"],
        autoConnect: true,
        withCredentials: false,
        reconnection: true,
        reconnectionAttempts: 10,
      });
      socket.on("connect", () => {});
      socket.on(
        "notification:new",
        (n: { titulo: string; mensagem?: string }) => {
          toast({ title: n.titulo, description: n.mensagem || "" });
        },
      );
      socket.on("chamado:created", () => {
        apiFetch("/chamados")
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error("fail"))))
          .then((data) => setItems(Array.isArray(data) ? data.map(adapt) : []))
          .catch(() => {});
      });
      socket.on("chamado:status", (data: { id: number; status: string }) => {
        setItems((prev) =>
          prev.map((it) =>
            String(it.id) === String(data.id)
              ? {
                  ...it,
                  status: (() => {
                    const n = data.status?.toUpperCase();
                    if (n === "EM_ANDAMENTO") return "EM_ANDAMENTO";
                    if (
                      n === "EM_ANALISE" ||
                      n === "EM ANÁLISE" ||
                      n === "EM ANALISE"
                    )
                      return "EM_ANALISE";
                    if (n === "CONCLUIDO" || n === "CONCLUÍDO")
                      return "CONCLUIDO";
                    if (n === "CANCELADO") return "CANCELADO";
                    return "ABERTO";
                  })() as TicketStatus,
                }
              : it,
          ),
        );
      });
      socket.on("chamado:deleted", (data: { id: number }) => {
        setItems((prev) =>
          prev.filter((it) => String(it.id) !== String(data.id)),
        );
      });
    });
  }, []);

  const counts = useMemo(() => {
    let baseItems = items;

    // Apply unit selection filter
    if (selectedUnidades.length > 0) {
      baseItems = baseItems.filter((t) => selectedUnidades.includes(t.unidade));
    }

    // Apply search input filter (search by unit name or chamado code)
    if (searchInputValue.trim()) {
      const searchLower = searchInputValue.toLowerCase();
      baseItems = baseItems.filter((t) =>
        t.unidade.toLowerCase().includes(searchLower) ||
        t.codigo.toLowerCase().includes(searchLower),
      );
    }

    return {
      todos: baseItems.length,
      abertos: baseItems.filter((t) => t.status === "ABERTO").length,
      aguardando: baseItems.filter((t) => t.status === "EM_ANDAMENTO").length,
      concluidos: baseItems.filter((t) => t.status === "CONCLUIDO").length,
      cancelados: baseItems.filter((t) => t.status === "CANCELADO").length,
    };
  }, [items, selectedUnidades, searchInputValue]);

  const unidades = useMemo(() => {
    const uniqueUnidades = Array.from(new Set(items.map((t) => t.unidade)))
      .filter(Boolean)
      .sort();
    const filtered = uniqueUnidades.filter((u) =>
      u.toLowerCase().includes(searchUnidade.toLowerCase()),
    );
    return filtered;
  }, [items, searchUnidade]);

  const handleToggleUnidade = (unidade: string) => {
    setSelectedUnidades((prev) =>
      prev.includes(unidade)
        ? prev.filter((u) => u !== unidade)
        : [...prev, unidade],
    );
  };

  const handleClearUnidades = () => {
    setSelectedUnidades([]);
    setSearchUnidade("");
  };

  const list = useMemo(() => {
    let filtered = items;

    // Apply status filter
    switch (filtro) {
      case "abertos":
        filtered = filtered.filter((t) => t.status === "ABERTO");
        break;
      case "em-andamento":
        filtered = filtered.filter((t) => t.status === "EM_ANDAMENTO");
        break;
      case "em-analise":
        filtered = filtered.filter((t) => t.status === "EM_ANALISE");
        break;
      case "concluidos":
        filtered = filtered.filter((t) => t.status === "CONCLUIDO");
        break;
      case "cancelados":
        filtered = filtered.filter((t) => t.status === "CANCELADO");
        break;
    }

    // Apply unit filter
    if (selectedUnidades.length > 0) {
      filtered = filtered.filter((t) => selectedUnidades.includes(t.unidade));
    }

    // Apply search input filter (search by unit name or chamado code)
    if (searchInputValue.trim()) {
      const searchLower = searchInputValue.toLowerCase();
      filtered = filtered.filter((t) =>
        t.unidade.toLowerCase().includes(searchLower) ||
        t.codigo.toLowerCase().includes(searchLower),
      );
    }

    return filtered;
  }, [filtro, items, selectedUnidades, searchInputValue]);

  // Infinite scroll para tickets
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleTickets < list.length) {
          setIsLoadingMore(true);
          // Simula delay de carregamento para UX
          setTimeout(() => {
            setVisibleTickets((prev) => Math.min(prev + 6, list.length));
            setIsLoadingMore(false);
          }, 500);
        }
      },
      { threshold: 0.1 },
    );

    if (loadMoreTicketsRef.current) {
      observer.observe(loadMoreTicketsRef.current);
    }

    return () => observer.disconnect();
  }, [visibleTickets, list.length]);

  // Reset visible count when filter changes
  useEffect(() => {
    setVisibleTickets(6);
    setIsLoadingMore(false);
  }, [filtro]);

  // Reset visible count when view mode changes
  useEffect(() => {
    setVisibleTickets(6);
    setIsLoadingMore(false);
  }, [viewMode]);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<UiTicket | null>(null);
  const [tab, setTab] = useState<"resumo" | "historico" | "ticket">("resumo");
  const [history, setHistory] = useState<
    {
      t: number;
      label: string;
      attachments?: string[];
      files?: { name: string; url: string; mime?: string }[];
      usuario_nome?: string | null;
      usuario_email?: string | null;
    }[]
  >([]);
  const [template, setTemplate] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState(false);
  const [ccMe, setCcMe] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [agents, setAgents] = useState<
    { id: number; nome: string; email: string }[]
  >([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  const initFromSelected = useCallback((s: UiTicket) => {
    setTab("resumo");
    setSubject(`Atualização do Chamado ${s.id}`);
    setMessage("");
    setTemplate("");
    setPriority(false);
    setCcMe(false);
    setFiles([]);

    apiFetch(`/chamados/${s.id}/historico`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("fail"))))
      .then(
        (data: {
          items: {
            t: string;
            tipo: string;
            label: string;
            usuario_nome?: string | null;
            usuario_email?: string | null;
            anexos?: {
              id: number;
              nome_original: string;
              caminho_arquivo: string;
              mime_type?: string | null;
            }[];
          }[];
        }) => {
          const arr = data.items.map((it) => ({
            t: new Date(it.t).getTime(),
            label: it.label,
            usuario_nome: it.usuario_nome,
            usuario_email: it.usuario_email,
            attachments: it.anexos
              ? it.anexos.map((a) => a.nome_original)
              : undefined,
            files: it.anexos
              ? it.anexos.map((a) => ({
                  name: a.nome_original,
                  url: `${API_BASE.replace(/\/api$/, "")}/${a.caminho_arquivo}`,
                  mime: a.mime_type || undefined,
                }))
              : undefined,
          }));
          setHistory(arr);
        },
      )
      .catch(() => {
        const base = new Date(s.criadoEm).getTime();
        setHistory([{ t: base, label: "Chamado aberto" }]);
      });
  }, []);

  async function handleSendTicket() {
    if (!selected) return;
    try {
      const fd = new FormData();
      fd.set("assunto", subject || "Atualização do chamado");
      fd.set("mensagem", message || "");
      const destinatarios =
        ccMe && user?.email
          ? `${selected.email},${user.email}`
          : selected.email;
      fd.set("destinatarios", destinatarios);
      if (user?.email) fd.set("autor_email", user.email);
      for (const f of files) fd.append("files", f);
      const r = await apiFetch(`/chamados/${selected.id}/ticket`, {
        method: "POST",
        body: fd,
      });
      if (!r.ok) throw new Error(await r.text());
      const hist = await apiFetch(`/chamados/${selected.id}/historico`).then(
        (x) => x.json(),
      );
      const arr = hist.items.map((it: any) => ({
        t: new Date(it.t).getTime(),
        label: it.label,
        usuario_nome: it.usuario_nome,
        usuario_email: it.usuario_email,
        attachments: it.anexos
          ? it.anexos.map((a: any) => a.nome_original)
          : undefined,
        files: it.anexos
          ? it.anexos.map((a: any) => ({
              name: a.nome_original,
              url: `${API_BASE.replace(/\/api$/, "")}/${a.caminho_arquivo}`,
              mime: a.mime_type || undefined,
            }))
          : undefined,
      }));
      setHistory(arr);
      setTab("historico");
      setFiles([]);
      setSubject("");
      setMessage("");
      toast({
        title: "Ticket enviado",
        description: "O ticket foi enviado com sucesso",
      });
    } catch (e) {
      toast({
        title: "Erro",
        description: "Falha ao enviar ticket",
        variant: "destructive",
      });
    }
  }

  async function handleAssignTicket() {
    if (!selected || !selectedAgent) return;
    try {
      const agentId = parseInt(selectedAgent);
      const r = await apiFetch(`/chamados/${selected.id}/assign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ agent_id: agentId }),
      });
      if (!r.ok) {
        const text = await r.text();
        throw new Error(text);
      }
      const agent = agents.find((a) => a.id === agentId);
      toast({
        title: "Chamado atribuído",
        description: `Atribuído para ${agent?.nome || "agente"}`,
      });
      setAssignDialogOpen(false);

      // Refresh the ticket's history to reflect the assignment
      const hist = await apiFetch(`/chamados/${selected.id}/historico`).then(
        (x) => x.json(),
      );
      const arr = hist.items.map((it: any) => ({
        t: new Date(it.t).getTime(),
        label: it.label,
        usuario_nome: it.usuario_nome,
        usuario_email: it.usuario_email,
        attachments: it.anexos
          ? it.anexos.map((a: any) => a.nome_original)
          : undefined,
        files: it.anexos
          ? it.anexos.map((a: any) => ({
              name: a.nome_original,
              url: `${API_BASE.replace(/\/api$/, "")}/${a.caminho_arquivo}`,
              mime: a.mime_type || undefined,
            }))
          : undefined,
      }));
      setHistory(arr);
      setTab("historico");
    } catch (e) {
      toast({
        title: "Erro",
        description: "Falha ao atribuir chamado",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="space-y-4 flex flex-col h-full">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 flex-shrink-0">
        <SummaryCard
          title="Todos"
          value={counts.todos}
          bgClass="bg-gradient-to-br from-slate-500 to-slate-600"
        />
        <SummaryCard
          title="Abertos"
          value={counts.abertos}
          bgClass="bg-gradient-to-br from-orange-500 to-orange-400"
        />
        <SummaryCard
          title="Em andamento"
          value={counts.aguardando}
          bgClass="bg-gradient-to-br from-amber-500 to-amber-600"
        />
        <SummaryCard
          title="Concluídos"
          value={counts.concluidos}
          bgClass="bg-gradient-to-br from-green-500 to-green-600"
        />
        <SummaryCard
          title="Cancelados"
          value={counts.cancelados}
          bgClass="bg-gradient-to-br from-red-500 to-red-700"
        />
      </div>

      {/* Filters and View Toggle */}
      <div className="flex-shrink-0 space-y-2">
        {/* Status Filters + View Toggle */}
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {statusMap.map((s) => (
              <NavLink
                key={s.key}
                to={`/setor/ti/admin/chamados/${s.key}`}
                className={({ isActive }) =>
                  `rounded-full px-3 py-1.5 text-sm border transition-colors ${isActive ? "bg-primary text-primary-foreground border-transparent" : "bg-secondary hover:bg-secondary/80"}`
                }
              >
                {s.label}
              </NavLink>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={viewMode === "grid" ? "default" : "secondary"}
              onClick={() => setViewMode("grid")}
              size="sm"
              className="inline-flex items-center gap-2"
            >
              <Grid3x3 className="h-4 w-4" />
              Grade
            </Button>
            <Button
              type="button"
              variant={viewMode === "list" ? "default" : "secondary"}
              onClick={() => setViewMode("list")}
              size="sm"
              className="inline-flex items-center gap-2"
            >
              <List className="h-4 w-4" />
              Lista
            </Button>
          </div>
        </div>

        {/* Unit Filter - Search Bar + Dropdown Button */}
        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="flex-1 relative max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por unidade ou código (ex: EVQ-0349)..."
              value={searchInputValue}
              onChange={(e) => setSearchInputValue(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-8 text-sm"
            />
            {searchInputValue && (
              <button
                onClick={() => setSearchInputValue("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                ✕
              </button>
            )}
          </div>

          {/* Unit Dropdown Button */}
          <div className="relative group">
            <button className="h-9 px-3 text-sm font-medium bg-secondary hover:bg-secondary/80 border border-border/60 rounded-md inline-flex items-center gap-1.5 transition-colors">
              Unidades
              {selectedUnidades.length > 0 && (
                <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs font-bold ml-0.5">
                  {selectedUnidades.length}
                </span>
              )}
              <ChevronDown className="h-4 w-4 opacity-70" />
            </button>

            {/* Dropdown Menu */}
            <div className="absolute right-0 mt-1 w-56 bg-card border border-border/60 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <div className="p-2 max-h-80 overflow-y-auto space-y-1">
                {unidades.length > 0 ? (
                  <>
                    {unidades.map((unidade) => (
                      <label
                        key={unidade}
                        className="flex items-center gap-2 px-2.5 py-1.5 text-sm cursor-pointer hover:bg-muted/50 rounded transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedUnidades.includes(unidade)}
                          onChange={() => handleToggleUnidade(unidade)}
                          className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
                        />
                        <span className="flex-1 truncate">{unidade}</span>
                      </label>
                    ))}
                    {selectedUnidades.length > 0 && (
                      <>
                        <div className="h-px bg-border/30 my-1" />
                        <button
                          onClick={handleClearUnidades}
                          className="w-full text-xs font-medium text-primary hover:bg-muted/50 px-2.5 py-1.5 rounded transition-colors text-left"
                        >
                          Limpar filtros
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-3">
                    Nenhuma unidade encontrada
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tickets Grid/List com Scroll Infinito */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div
          ref={ticketsContainerRef}
          className="h-full overflow-y-auto pr-2 -mr-2"
        >
          {viewMode === "grid" && (
            <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 pb-4 w-full">
              {list.slice(0, visibleTickets).map((t) => (
                <div
                  key={t.id}
                  onClick={() => {
                    setSelected(t);
                    initFromSelected(t);
                    setOpen(true);
                  }}
                  className="cursor-pointer transition-all hover:scale-105"
                >
                  <TicketCard
                    {...t}
                    onTicket={() => {
                      setSelected(t);
                      initFromSelected(t);
                      setTab("ticket");
                      setOpen(true);
                    }}
                    onUpdate={async (id, sel) => {
                      const statusText =
                        sel === "ABERTO"
                          ? "Aberto"
                          : sel === "EM_ANDAMENTO"
                            ? "Em andamento"
                            : sel === "EM_ANALISE"
                              ? "Em análise"
                              : sel === "CONCLUIDO"
                                ? "Concluído"
                                : "Cancelado";
                      try {
                        const r = await apiFetch(`/chamados/${id}/status`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ status: statusText }),
                        });
                        if (!r.ok) throw new Error(await r.text());
                        setItems((prev) =>
                          prev.map((it) =>
                            it.id === id ? { ...it, status: sel } : it,
                          ),
                        );
                        if (selected && selected.id === id) {
                          const hist = await apiFetch(
                            `/chamados/${id}/historico`,
                          ).then((x) => x.json());
                          const arr = hist.items.map((it: any) => ({
                            t: new Date(it.t).getTime(),
                            label: it.label,
                            attachments: it.anexos
                              ? it.anexos.map((a: any) => a.nome_original)
                              : undefined,
                            files: it.anexos
                              ? it.anexos.map((a: any) => ({
                                  name: a.nome_original,
                                  url: `${API_BASE.replace(/\/api$/, "")}/${a.caminho_arquivo}`,
                                  mime: a.mime_type || undefined,
                                }))
                              : undefined,
                          }));
                          setHistory(arr);
                          setTab("historico");
                        }
                        toast({
                          title: "Status atualizado",
                          description: `Chamado alterado para: ${statusText}`,
                        });
                      } catch (e) {
                        toast({
                          title: "Erro",
                          description: "Falha ao atualizar status",
                          variant: "destructive",
                        });
                      }
                    }}
                    onDelete={(id) => setConfirmId(id)}
                  />
                </div>
              ))}
            </div>
          )}

          {viewMode === "list" && (
            <div className="space-y-3 pb-4">
              {list.slice(0, visibleTickets).map((t) => (
                <div
                  key={t.id}
                  onClick={() => {
                    setSelected(t);
                    initFromSelected(t);
                    setOpen(true);
                  }}
                  className="rounded-lg border border-border/40 bg-card overflow-hidden cursor-pointer transition-all hover:shadow-md hover:border-primary/30"
                >
                  <div className="p-4">
                    <div className="flex flex-col gap-3">
                      {/* Top Row: Código, Título, Status, Data */}
                      <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
                        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                          <div className="flex items-center gap-2 gap-y-0">
                            <span className="text-xs font-semibold rounded-md bg-primary/10 text-primary px-2.5 py-1 whitespace-nowrap">
                              {t.codigo}
                            </span>
                            <StatusPill status={t.status} />
                          </div>
                          <h3 className="font-semibold text-sm leading-tight line-clamp-2">
                            {t.titulo}
                          </h3>
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(t.criadoEm).toLocaleDateString("pt-BR")}
                          </span>
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelected(t);
                              initFromSelected(t);
                              setTab("ticket");
                              setOpen(true);
                            }}
                            className="h-8 px-3 whitespace-nowrap"
                          >
                            <TicketIcon className="h-3.5 w-3.5 mr-1.5" />
                            Abrir
                          </Button>
                        </div>
                      </div>

                      {/* Bottom Row: Detalhes em Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2.5 pt-2 border-t border-border/20">
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-1">
                            Solicitante
                          </div>
                          <div className="text-sm truncate">
                            {t.solicitante}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-1">
                            Problema
                          </div>
                          <div className="text-sm truncate">{t.categoria}</div>
                        </div>
                        <div className="hidden sm:block">
                          <div className="text-xs font-medium text-muted-foreground mb-1">
                            Unidade
                          </div>
                          <div className="text-sm truncate">{t.unidade}</div>
                        </div>
                        <div className="hidden sm:block">
                          <div className="text-xs font-medium text-muted-foreground mb-1">
                            E-mail
                          </div>
                          <div className="text-sm truncate">{t.email}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Sentinel para infinite scroll com loading */}
          {visibleTickets < list.length && (
            <div
              ref={loadMoreTicketsRef}
              className="py-8 flex flex-col items-center justify-center gap-3"
            >
              {isLoadingMore && (
                <>
                  <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                  <p className="text-sm text-muted-foreground animate-pulse">
                    Carregando chamados...
                  </p>
                </>
              )}
            </div>
          )}

          {list.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum chamado encontrado
            </div>
          )}
        </div>
      </div>

      {/* Delete Dialog */}
      <Dialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir chamado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              O chamado será removido da sua visualização, mas permanecerá
              armazenado no banco de dados para fins de auditoria.
            </p>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Confirme sua senha</label>
              <input
                type="password"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmId(null)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={!confirmPwd || confirmLoading}
                onClick={async () => {
                  if (!confirmId || !user?.email) return;
                  setConfirmLoading(true);
                  try {
                    const r = await apiFetch(`/chamados/${confirmId}`, {
                      method: "DELETE",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        email: user.email,
                        senha: confirmPwd,
                      }),
                    });
                    if (!r.ok) throw new Error(await r.text());
                    setItems((prev) =>
                      prev.filter((it) => it.id !== confirmId),
                    );
                    setConfirmId(null);
                    setConfirmPwd("");
                    toast({
                      title: "Sucesso",
                      description: "Chamado excluído com sucesso",
                    });
                  } catch (e) {
                    toast({
                      title: "Erro",
                      description:
                        e instanceof Error ? e.message : "Erro ao excluir",
                      variant: "destructive",
                    });
                  } finally {
                    setConfirmLoading(false);
                  }
                }}
              >
                {confirmLoading ? "Excluindo..." : "Confirmar exclusão"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalhes - Mantido igual ao anterior */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
          {selected && (
            <>
              <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
                <div className="brand-gradient rounded-lg p-4 flex items-start justify-between">
                  <div>
                    <div className="text-sm text-primary-foreground/90">
                      {selected.protocolo}
                    </div>
                    <DialogTitle className="mt-1 text-xl font-bold text-primary-foreground">
                      {selected.titulo}
                    </DialogTitle>
                  </div>
                  <StatusPill status={selected.status} />
                </div>
              </DialogHeader>

              <div className="px-6 pt-4 flex gap-2 flex-shrink-0 border-b pb-4">
                {(["resumo", "historico", "ticket"] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setTab(k)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      tab === k
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary hover:bg-secondary/80"
                    }`}
                  >
                    {k === "resumo"
                      ? "Resumo"
                      : k === "historico"
                        ? "Histórico"
                        : "Ticket"}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto px-6 pb-6">
                {tab === "resumo" && (
                  <div className="grid gap-6 lg:grid-cols-[1fr,320px] pt-4">
                    <div className="space-y-6">
                      <div className="rounded-lg border bg-card p-5 space-y-4 h-fit">
                        <h3 className="font-semibold text-lg">
                          Ficha do chamado
                        </h3>
                        <div className="grid gap-3 text-sm">
                          {[
                            ["Solicitante", selected.solicitante],
                            ["Cargo", selected.cargo],
                            ["Gerente", selected.gerente || "—"],
                            ["E-mail", selected.email],
                            ["Telefone", selected.telefone],
                            ["Unidade", selected.unidade],
                            ["Problema", selected.categoria],
                            selected.descricao && [
                              "Descrição",
                              selected.descricao,
                            ],
                            selected.internetItem && [
                              "Item Internet",
                              selected.internetItem,
                            ],
                            [
                              "Data de abertura",
                              new Date(selected.criadoEm).toLocaleString(),
                            ],
                            ["Visita técnica", selected.visita || "—"],
                          ]
                            .filter(Boolean)
                            .map((item, i) => (
                              <div
                                key={i}
                                className="grid grid-cols-[140px,1fr] gap-4 py-2 border-b last:border-0"
                              >
                                <span className="text-muted-foreground font-medium">
                                  {item![0]}:
                                </span>
                                <span className="break-words">{item![1]}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border bg-card p-5 space-y-4 h-fit">
                      <h3 className="font-semibold text-lg">Ações</h3>
                      <div className="space-y-3">
                        <Select
                          value={selected.status}
                          onValueChange={(v) =>
                            setSelected((s) =>
                              s ? { ...s, status: v as TicketStatus } : s,
                            )
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ABERTO">Aberto</SelectItem>
                            <SelectItem value="EM_ANDAMENTO">
                              Em andamento
                            </SelectItem>
                            <SelectItem value="EM_ANALISE">
                              Em análise
                            </SelectItem>
                            <SelectItem value="CONCLUIDO">Concluído</SelectItem>
                            <SelectItem value="CANCELADO">Cancelado</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="success"
                          className="w-full"
                          onClick={() => {
                            setSelectedAgent("");
                            setAssignDialogOpen(true);
                          }}
                        >
                          <UserPlus className="size-4" /> Atribuir
                        </Button>
                        <Button
                          variant="warning"
                          className="w-full"
                          onClick={async () => {
                            if (!selected) return;
                            const sel = selected.status;
                            const statusText =
                              sel === "ABERTO"
                                ? "Aberto"
                                : sel === "EM_ANDAMENTO"
                                  ? "Em andamento"
                                  : sel === "EM_ANALISE"
                                    ? "Em análise"
                                    : sel === "CONCLUIDO"
                                      ? "Concluído"
                                      : "Cancelado";
                            try {
                              const r = await apiFetch(
                                `/chamados/${selected.id}/status`,
                                {
                                  method: "PATCH",
                                  headers: {
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify({ status: statusText }),
                                },
                              );
                              if (!r.ok) throw new Error(await r.text());
                              setItems((prev) =>
                                prev.map((it) =>
                                  it.id === selected.id
                                    ? { ...it, status: sel }
                                    : it,
                                ),
                              );
                              const hist = await apiFetch(
                                `/chamados/${selected.id}/historico`,
                              ).then((x) => x.json());
                              const arr = hist.items.map((it: any) => ({
                                t: new Date(it.t).getTime(),
                                label: it.label,
                                usuario_nome: it.usuario_nome,
                                usuario_email: it.usuario_email,
                                attachments: it.anexos
                                  ? it.anexos.map((a: any) => a.nome_original)
                                  : undefined,
                                files: it.anexos
                                  ? it.anexos.map((a: any) => ({
                                      name: a.nome_original,
                                      url: `${API_BASE.replace(/\/api$/, "")}/${a.caminho_arquivo}`,
                                      mime: a.mime_type || undefined,
                                    }))
                                  : undefined,
                              }));
                              setHistory(arr);
                              setTab("historico");
                              toast({
                                title: "Status atualizado",
                                description: `Alterado para: ${statusText}`,
                              });
                            } catch (e) {
                              toast({
                                title: "Erro",
                                description: "Falha ao atualizar",
                                variant: "destructive",
                              });
                            }
                          }}
                        >
                          <Save className="size-4" /> Atualizar
                        </Button>
                        <Button
                          variant="destructive"
                          className="w-full"
                          onClick={() => setConfirmId(selected?.id || null)}
                        >
                          <Trash2 className="size-4" /> Excluir
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {tab === "historico" && (
                  <div className="pt-4">
                    <h3 className="font-semibold text-lg mb-4">
                      Linha do tempo
                    </h3>
                    <div className="relative border-l-2 border-border pl-6 space-y-6">
                      {history.map((ev, idx) => (
                        <div key={idx} className="relative">
                          <div className="absolute -left-[29px] top-2 h-4 w-4 rounded-full bg-primary ring-4 ring-background border-2 border-background" />
                          <div className="space-y-2">
                            <p className="font-medium">{ev.label}</p>
                            <div className="text-xs text-muted-foreground space-y-1">
                              <p>{new Date(ev.t).toLocaleString()}</p>
                              {ev.usuario_nome && (
                                <p className="text-xs text-muted-foreground">
                                  Alterado por:{" "}
                                  <span className="font-medium text-foreground">
                                    {ev.usuario_nome}
                                  </span>
                                  {ev.usuario_email && ` (${ev.usuario_email})`}
                                </p>
                              )}
                            </div>
                            {ev.files && ev.files.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-3">
                                {ev.files.map((f, i) => (
                                  <a
                                    key={i}
                                    href={f.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="group inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm hover:bg-accent transition-colors"
                                  >
                                    {f.mime?.startsWith("image/") ? (
                                      <ImageIcon className="w-4 h-4 text-muted-foreground" />
                                    ) : (
                                      <Paperclip className="w-4 h-4 text-muted-foreground" />
                                    )}
                                    <span className="truncate max-w-[200px] group-hover:text-primary">
                                      {f.name}
                                    </span>
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {history.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          Nenhum histórico disponível
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {tab === "ticket" && (
                  <div className="pt-4 space-y-4">
                    <div className="grid gap-2">
                      <label className="text-sm font-medium">
                        Modelo de Mensagem
                      </label>
                      <Select
                        key={`template-select-${template || "none"}`}
                        value={template || "none"}
                        onValueChange={(v) => {
                          const chamadoId = selected?.codigo || "EVQ-XXXX";
                          const solicitante =
                            selected?.solicitante || "[Nome do solicitante]";
                          const problema = selected?.categoria || "[Problema]";
                          const unidade = selected?.unidade || "[Unidade]";
                          const dataAbertura = selected?.criadoEm
                            ? new Date(selected.criadoEm).toLocaleString(
                                "pt-BR",
                              )
                            : "[Data de abertura]";
                          const statusChamado = (() => {
                            if (selected?.status === "ABERTO") return "Aberto";
                            if (selected?.status === "EM_ANDAMENTO")
                              return "Em andamento";
                            if (selected?.status === "EM_ANALISE")
                              return "Em análise";
                            if (selected?.status === "CONCLUIDO")
                              return "Concluído";
                            if (selected?.status === "CANCELADO")
                              return "Cancelado";
                            return "[Status do chamado]";
                          })();

                          if (v === "none") {
                            setTemplate("");
                            setMessage("");
                            setSubject(`Atualização do Chamado ${chamadoId}`);
                          } else if (v === "atualizacao") {
                            setTemplate("atualizacao");
                            setSubject(`Atualização do Chamado ${chamadoId}`);
                            setMessage(
                              `Prezado(a) ${solicitante},\n\nSeu chamado ${chamadoId} foi atualizado.\nStatus atual: ${statusChamado}\n\nAtenciosamente,\nEquipe de Suporte TI`,
                            );
                          } else if (v === "confirmacao") {
                            setTemplate("confirmacao");
                            setSubject(`Atualização do Chamado ${chamadoId}`);
                            setMessage(
                              `Prezado(a) ${solicitante},\n\nConfirmamos o recebimento do seu chamado ${chamadoId}.\nEm breve nossa equipe iniciará o atendimento.\n\nDetalhes do chamado:\n- Problema: ${problema}\n- Unidade: ${unidade}\n- Data de abertura: ${dataAbertura}\n\nManteremos você informado sobre o progresso.\n\nAtenciosamente,\nEquipe de Suporte TI`,
                            );
                          } else if (v === "conclusao") {
                            setTemplate("conclusao");
                            setSubject(`Atualização do Chamado ${chamadoId}`);
                            const dataConclusao =
                              new Date().toLocaleDateString("pt-BR") +
                              ", " +
                              new Date().toLocaleTimeString("pt-BR");
                            setMessage(
                              `Prezado(a) ${solicitante},\n\nSeu chamado ${chamadoId} foi concluído com sucesso.\n\nResumo do atendimento:\n- Problema relatado: ${problema}\n- Data de conclusão: ${dataConclusao}\n\nCaso necessite de suporte adicional, não hesite em abrir um novo chamado.\n\nAtenciosamente,\nEquipe de Suporte TI`,
                            );
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um modelo (opcional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sem modelo</SelectItem>
                          <SelectItem value="atualizacao">
                            Atualização de Status
                          </SelectItem>
                          <SelectItem value="confirmacao">
                            Confirmação de Recebimento
                          </SelectItem>
                          <SelectItem value="conclusao">
                            Conclusão de Chamado
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Assunto</label>
                      <input
                        className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Assunto do ticket"
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Mensagem</label>
                      <textarea
                        className="min-h-[160px] w-full rounded-md border border-input bg-background p-3 text-sm resize-none"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Digite sua mensagem..."
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-sm font-medium">Anexos</label>
                      <input
                        type="file"
                        multiple
                        onChange={(e) =>
                          setFiles(Array.from(e.target.files || []))
                        }
                        className="text-sm"
                      />
                      {files.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {files.length} arquivo(s) selecionado(s)
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={priority}
                          onChange={(e) => setPriority(e.target.checked)}
                          className="h-4 w-4 rounded border-input accent-primary"
                        />
                        Marcar como prioritário
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ccMe}
                          onChange={(e) => setCcMe(e.target.checked)}
                          className="h-4 w-4 rounded border-input accent-primary"
                        />
                        Enviar cópia para mim
                      </label>
                    </div>
                    <div className="flex justify-end pt-4">
                      <Button onClick={handleSendTicket} size="lg">
                        <TicketIcon className="size-4" /> Enviar Ticket
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atribuir Chamado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Selecione um agente</label>
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um agente..." />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={String(agent.id)}>
                      {agent.nome} ({agent.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setAssignDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button onClick={handleAssignTicket} disabled={!selectedAgent}>
                <UserPlus className="size-4 mr-2" /> Confirmar Atribuição
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
