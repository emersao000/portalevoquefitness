import { useEffect, useMemo, useState, useRef, useCallback } from "react";
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
  Ticket as TicketIcon,
  UserPlus,
  Paperclip,
  Image as ImageIcon,
  Grid3x3,
  List,
  Search,
  ArrowRightLeft,
  UserCheck,
  Inbox,
} from "lucide-react";
import { apiFetch, API_BASE } from "@/lib/api";
import { invalidateSLACache } from "@/hooks/useSLA";
import { useAuthContext } from "@/lib/auth-context";
import { toast } from "@/hooks/use-toast";

type TicketStatus =
  | "ABERTO"
  | "EM_ATENDIMENTO"
  | "AGUARDANDO"
  | "CONCLUIDO"
  | "EXPIRADO";

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
  retroativo?: boolean;
  assumidoPorId?: number | null;
  assumidoPorNome?: string | null;
  assumidoPorEmail?: string | null;
}

function StatusPill({ status }: { status: TicketStatus }) {
  const styles =
    status === "ABERTO"
      ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-300"
      : status === "EM_ATENDIMENTO"
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
        : status === "AGUARDANDO"
          ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300"
          : status === "CONCLUIDO"
            ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300"
            : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300";
  const label =
    status === "ABERTO" ? "Aberto"
      : status === "EM_ATENDIMENTO" ? "Em atendimento"
        : status === "AGUARDANDO" ? "Aguardando"
          : status === "CONCLUIDO" ? "Concluído"
            : "Expirado";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles}`}>
      {label}
    </span>
  );
}

// Card component separado para evitar hooks dentro de .map()
function MeuChamadoCard({
  ticket: t,
  statusLabel,
  allowedNext,
  onOpen,
  onTicket,
  onTransfer,
  onUpdateStatus,
}: {
  ticket: UiTicket;
  statusLabel: Record<TicketStatus, string>;
  allowedNext: TicketStatus[];
  onOpen: () => void;
  onTicket: () => void;
  onTransfer: () => void;
  onUpdateStatus: (id: string, status: TicketStatus) => Promise<void>;
}) {
  const [sel, setSel] = useState<TicketStatus>(t.status);
  const [saving, setSaving] = useState(false);

  return (
    <div onClick={onOpen} className="cursor-pointer hover:scale-[1.02] transition-transform">
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden hover:shadow-lg hover:border-violet-500/40 transition-all">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border/40 bg-muted/20 flex items-center justify-between gap-2">
          <span className="font-bold text-sm text-primary">{t.codigo}</span>
          <div className="flex items-center gap-1.5">
            {t.retroativo && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400">
                Retroativo
              </span>
            )}
            <StatusPill status={t.status} />
          </div>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          <p className="font-semibold text-sm leading-snug line-clamp-2">{t.titulo}</p>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Solicitante</span>
              <span className="font-medium truncate max-w-[55%] text-right">{t.solicitante}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Unidade</span>
              <span className="font-medium truncate max-w-[55%] text-right">{t.unidade}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Abertura</span>
              <span className="font-medium">{new Date(t.criadoEm).toLocaleDateString("pt-BR")}</span>
            </div>
          </div>

          {/* Status selector */}
          {allowedNext.length > 0 ? (
            <div className="pt-1 border-t border-border/30">
              <Select value={sel} onValueChange={(v) => setSel(v as TicketStatus)}>
                <SelectTrigger onClick={(e) => e.stopPropagation()} className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={t.status} disabled>{statusLabel[t.status]} (atual)</SelectItem>
                  {allowedNext.map((s) => (
                    <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="pt-1 border-t border-border/30">
              <div className="h-8 flex items-center justify-center rounded-md bg-muted/30 text-xs text-muted-foreground italic">
                Status final — sem alterações
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-1.5 pt-1">
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => { e.stopPropagation(); onTransfer(); }}
              className="h-8 text-xs px-2 flex-1"
              title="Transferir chamado"
            >
              <ArrowRightLeft className="size-3" />
            </Button>
            {allowedNext.length > 0 && (
              <Button
                size="sm"
                variant="warning"
                disabled={saving || sel === t.status}
                onClick={async (e) => {
                  e.stopPropagation();
                  if (saving || sel === t.status) return;
                  setSaving(true);
                  try { await onUpdateStatus(t.id, sel); }
                  catch { /* toast handled in parent */ }
                  finally { setSaving(false); }
                }}
                className="h-8 text-xs px-2 flex-1"
                title="Salvar status"
              >
                {saving
                  ? <span className="size-3 animate-spin border border-current border-t-transparent rounded-full inline-block" />
                  : <Save className="size-3" />}
              </Button>
            )}
            <Button
              size="sm"
              variant="info"
              onClick={(e) => { e.stopPropagation(); onTicket(); }}
              className="h-8 text-xs px-2 flex-1"
              title="Ver detalhes / enviar ticket"
            >
              <TicketIcon className="size-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MeusChamadosPage() {
  const { user } = useAuthContext();
  const [items, setItems] = useState<UiTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchInput, setSearchInput] = useState("");
  const [visibleCount, setVisibleCount] = useState(6);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Modal state
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<UiTicket | null>(null);
  const [tab, setTab] = useState<"resumo" | "historico" | "ticket">("resumo");
  const [history, setHistory] = useState<{
    t: number; tipo?: string; label: string;
    files?: { name: string; url: string; mime?: string }[];
    usuario_nome?: string | null; usuario_email?: string | null;
  }[]>([]);
  const [modalStatusSel, setModalStatusSel] = useState<TicketStatus | null>(null);
  const [modalSaving, setModalSaving] = useState(false);
  const [ticketSaving, setTicketSaving] = useState(false);

  // Ticket tab state
  const [template, setTemplate] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [ccMe, setCcMe] = useState(false);
  const [priority, setPriority] = useState(false);

  // Transfer state
  const [agents, setAgents] = useState<{ id: number; nome: string; email: string }[]>([]);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferAgent, setTransferAgent] = useState("");

  // Estado do card de status selecionado (null = mostrando só os cards)
  const [activeStatus, setActiveStatus] = useState<TicketStatus | null>(null);

  // currentUserId — resolve o ID do agente logado via lista de agentes (igual ao Index.tsx)
  // MUST be declared before ticketsByStatus (which depends on it) to avoid temporal dead zone crash
  const currentUserId = useMemo(() => {
    if (!user?.email) return null;
    // Tenta user.id direto primeiro
    if (user.id != null) return user.id;
    // Fallback: resolve pelo email na lista de agentes (mesmo método do Index.tsx)
    const me = agents.find((a) => a.email.toLowerCase() === user.email.toLowerCase());
    return me?.id ?? null;
  }, [user, agents]);

  const ticketsByStatus = useMemo(() => {
    // "Meus chamados" = apenas atribuídos a mim (igual ao card "Meus chamados" do Index.tsx)
    let base = currentUserId != null
      ? items.filter((t) => t.assumidoPorId === currentUserId)
      : items.filter((t) => t.assumidoPorId != null); // fallback: qualquer assumido

    if (searchInput.trim()) {
      const q = searchInput.toLowerCase();
      base = base.filter((t) =>
        t.unidade.toLowerCase().includes(q) || t.codigo.toLowerCase().includes(q) || t.titulo.toLowerCase().includes(q)
      );
    }
    if (!activeStatus) return base;
    return base.filter((t) => t.status === activeStatus || (activeStatus === "AGUARDANDO" && t.status === "EXPIRADO"));
  }, [items, activeStatus, searchInput, currentUserId]);

  function toUiStatus(s: string): TicketStatus {
    const n = (s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase().replace(/\s+/g, "_");
    if (n === "EM_ATENDIMENTO") return "EM_ATENDIMENTO";
    if (n === "AGUARDANDO") return "AGUARDANDO";
    if (n === "CONCLUIDO") return "CONCLUIDO";
    if (n === "EXPIRADO") return "EXPIRADO";
    return "ABERTO";
  }

  function adapt(it: any): UiTicket {
    const titulo = it.problema === "Internet" && it.internet_item
      ? `Internet - ${it.internet_item}` : it.problema;
    return {
      id: String(it.id), codigo: it.codigo, protocolo: it.protocolo,
      titulo, solicitante: it.solicitante, unidade: it.unidade,
      categoria: it.problema, status: toUiStatus(it.status || "Aberto"),
      criadoEm: it.data_abertura || new Date().toISOString(),
      cargo: it.cargo, email: it.email, telefone: it.telefone,
      internetItem: it.internet_item ?? null, visita: it.data_visita ?? null,
      gerente: null, descricao: it.descricao ?? null,
      retroativo: it.retroativo ?? false,
      assumidoPorId: it.status_assumido_por_id ?? null,
      assumidoPorNome: it.status_assumido_por_nome ?? null,
      assumidoPorEmail: it.status_assumido_por_email ?? null,
    };
  }

  // Load agents for transfer
  useEffect(() => {
    apiFetch("/usuarios")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (Array.isArray(data)) {
          setAgents(data
            .filter((u: any) => u.nivel_acesso?.toLowerCase().includes("admin") || u.nivel_acesso?.toLowerCase().includes("agente"))
            .map((u: any) => ({ id: u.id, nome: u.nome, email: u.email }))
          );
        }
      })
      .catch(() => {});
  }, []);



  // Load "meus chamados" — usa mesmo endpoint admin do Gerenciar Chamados, filtra client-side
  // Isso garante contagens idênticas entre as duas seções
  useEffect(() => {
    if (!user?.email) return;
    setLoading(true);
    apiFetch("/chamados?admin=true&limit=500")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: any[]) => {
        if (!Array.isArray(data)) return;
        const all = data.map(adapt);
        // Mesma regra de visibilidade do Index.tsx: meu chamado OU não atribuído OU retroativo
        // Para "Meus chamados", só queremos os atribuídos a mim (igual ao card "Meus chamados" do Index)
        // currentUserId pode ainda não estar disponível aqui, então usamos user.email como fallback
        setItems(all);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [user?.email]);

  // Infinite scroll
  useEffect(() => {
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && visibleCount < ticketsByStatus.length) {
        setVisibleCount((p) => Math.min(p + 6, ticketsByStatus.length));
      }
    }, { threshold: 0.1 });
    if (loadMoreRef.current) obs.observe(loadMoreRef.current);
    return () => obs.disconnect();
  }, [visibleCount, (ticketsByStatus ?? []).length]);

  useEffect(() => { setVisibleCount(6); }, [searchInput]);

  const initFromSelected = useCallback((s: UiTicket) => {
    setModalSaving(false);
    setTicketSaving(false);
    setTab("resumo");
    setModalStatusSel(s.status);
    setSubject(`Atualização do Chamado ${s.codigo}`);
    setMessage(""); setTemplate(""); setFiles([]); setPriority(false);
    apiFetch(`/chamados/${s.id}/historico`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        setHistory(data.items.map((it: any) => ({
          t: new Date(it.t).getTime(), tipo: it.tipo, label: it.label,
          usuario_nome: it.usuario_nome, usuario_email: it.usuario_email,
          files: it.anexos?.map((a: any) => ({
            name: a.nome_original,
            url: `${API_BASE.replace(/\/api$/, "")}/${a.caminho_arquivo}`,
            mime: a.mime_type || undefined,
          })),
        })));
      })
      .catch(() => setHistory([{ t: new Date(s.criadoEm).getTime(), label: "Chamado aberto" }]));
  }, []);

  async function handleUpdateStatus(id: string, newStatus: TicketStatus) {
    const statusText = { ABERTO: "Aberto", EM_ATENDIMENTO: "Em atendimento", AGUARDANDO: "Aguardando", CONCLUIDO: "Concluído", EXPIRADO: "Expirado" }[newStatus];
    const r = await apiFetch(`/chamados/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: statusText, autor_email: user?.email || null }),
    });
    if (!r.ok) throw new Error(await r.text());
    invalidateSLACache();
    setItems((prev) => prev.map((it) => it.id === id ? { ...it, status: newStatus } : it));
    if (selected?.id === id) {
      setSelected((s) => s ? { ...s, status: newStatus } : s);
      setModalStatusSel(newStatus);
      const hist = await apiFetch(`/chamados/${id}/historico`).then((x) => x.json());
      setHistory(hist.items.map((it: any) => ({
        t: new Date(it.t).getTime(), tipo: it.tipo, label: it.label,
        usuario_nome: it.usuario_nome, usuario_email: it.usuario_email,
        files: it.anexos?.map((a: any) => ({
          name: a.nome_original,
          url: `${API_BASE.replace(/\/api$/, "")}/${a.caminho_arquivo}`,
          mime: a.mime_type || undefined,
        })),
      })));
      setTab("historico");
    }
    toast({ title: "Status atualizado", description: `Alterado para: ${statusText}` });
  }

  async function handleTransferir() {
    if (!selected || !transferAgent) return;
    try {
      const r = await apiFetch(`/chamados/${selected.id}/transferir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: parseInt(transferAgent) }),
      });
      if (!r.ok) throw new Error(await r.text());
      // Remove from my list after transferring
      setItems((prev) => prev.filter((it) => it.id !== selected.id));
      setTransferDialogOpen(false);
      setTransferAgent("");
      setOpen(false);
      const agent = agents.find((a) => a.id === parseInt(transferAgent));
      toast({ title: "Chamado transferido", description: `Transferido para ${agent?.nome || "agente"}` });
    } catch {
      toast({ title: "Erro", description: "Falha ao transferir chamado", variant: "destructive" });
    }
  }

  async function handleSendTicket() {
    if (!selected || ticketSaving) return;
    setTicketSaving(true);
    try {
      const fd = new FormData();
      fd.set("assunto", subject || "Atualização do chamado");
      fd.set("mensagem", message || "");
      fd.set("destinatarios", ccMe && user?.email ? `${selected.email},${user.email}` : selected.email);
      if (user?.email) fd.set("autor_email", user.email);
      for (const f of files) fd.append("files", f);
      const r = await apiFetch(`/chamados/${selected.id}/ticket`, { method: "POST", body: fd });
      if (!r.ok) throw new Error(await r.text());
      const hist = await apiFetch(`/chamados/${selected.id}/historico`).then((x) => x.json());
      setHistory(hist.items.map((it: any) => ({
        t: new Date(it.t).getTime(), tipo: it.tipo, label: it.label,
        usuario_nome: it.usuario_nome, usuario_email: it.usuario_email,
        files: it.anexos?.map((a: any) => ({
          name: a.nome_original,
          url: `${API_BASE.replace(/\/api$/, "")}/${a.caminho_arquivo}`,
          mime: a.mime_type || undefined,
        })),
      })));
      setTab("historico"); setFiles([]); setSubject(""); setMessage("");
      toast({ title: "Ticket enviado", description: "O ticket foi enviado com sucesso" });
    } catch {
      toast({ title: "Erro", description: "Falha ao enviar ticket", variant: "destructive" });
    } finally {
      setTicketSaving(false);
    }
  }

  const ALLOWED_NEXT: Record<TicketStatus, TicketStatus[]> = {
    ABERTO: ["EM_ATENDIMENTO", "AGUARDANDO", "CONCLUIDO"],
    EM_ATENDIMENTO: ["AGUARDANDO", "CONCLUIDO"],
    AGUARDANDO: ["EM_ATENDIMENTO", "CONCLUIDO"],
    CONCLUIDO: [], EXPIRADO: [],
  };
  const STATUS_LABEL: Record<TicketStatus, string> = {
    ABERTO: "Aberto", EM_ATENDIMENTO: "Em atendimento",
    AGUARDANDO: "Aguardando", CONCLUIDO: "Concluído", EXPIRADO: "Expirado",
  };

  const STATUS_CONFIG = [
    {
      key: "ABERTO" as TicketStatus,
      label: "Aberto",
      desc: "Aguardando atendimento",
      gradient: "from-cyan-500 to-cyan-600",
      ring: "ring-cyan-400",
      iconBg: "bg-cyan-400/20",
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      key: "EM_ATENDIMENTO" as TicketStatus,
      label: "Em atendimento",
      desc: "Em andamento agora",
      gradient: "from-amber-500 to-amber-600",
      ring: "ring-amber-400",
      iconBg: "bg-amber-400/20",
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      key: "AGUARDANDO" as TicketStatus,
      label: "Aguardando",
      desc: "Pendente de resposta",
      gradient: "from-indigo-500 to-indigo-600",
      ring: "ring-indigo-400",
      iconBg: "bg-indigo-400/20",
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
    },
    {
      key: "CONCLUIDO" as TicketStatus,
      label: "Concluído",
      desc: "Resolvidos por você",
      gradient: "from-emerald-500 to-emerald-600",
      ring: "ring-emerald-400",
      iconBg: "bg-emerald-400/20",
      icon: (
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-4 flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-9 w-9 rounded-xl bg-violet-600 flex items-center justify-center flex-shrink-0">
            <Inbox className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold leading-tight">Meus chamados</h2>
            <p className="text-sm text-muted-foreground">Chamados atribuídos a você</p>
          </div>
        </div>
      </div>

      {/* Cards de status — clicáveis */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-shrink-0">
        {STATUS_CONFIG.map((cfg) => {
          const myItems = currentUserId != null
            ? items.filter((t) => t.assumidoPorId === currentUserId)
            : items.filter((t) => t.assumidoPorId != null);
          const count = myItems.filter((t) =>
            t.status === cfg.key || (cfg.key === "AGUARDANDO" && t.status === "EXPIRADO")
          ).length;
          const isActive = activeStatus === cfg.key;
          return (
            <button
              key={cfg.key}
              type="button"
              onClick={() => setActiveStatus(isActive ? null : cfg.key)}
              className={`relative rounded-2xl p-4 text-left text-white bg-gradient-to-br ${cfg.gradient} shadow-md transition-all duration-200
                hover:scale-[1.03] hover:shadow-xl active:scale-[0.98]
                ${isActive ? `ring-2 ring-offset-2 ring-offset-background ${cfg.ring} scale-[1.03] shadow-xl` : "opacity-90 hover:opacity-100"}`}
            >
              {/* ícone */}
              <div className={`w-10 h-10 rounded-xl ${cfg.iconBg} flex items-center justify-center mb-3`}>
                {cfg.icon}
              </div>
              <div className="text-3xl font-extrabold leading-none mb-1">{loading ? "—" : count}</div>
              <div className="text-sm font-semibold leading-tight">{cfg.label}</div>
              <div className="text-xs opacity-80 mt-0.5">{cfg.desc}</div>
              {/* indicador de selecionado */}
              {isActive && (
                <div className="absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full bg-white shadow" />
              )}
            </button>
          );
        })}
      </div>

      {/* Painel de chamados — só aparece quando um card está selecionado */}
      {activeStatus && (
        <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">
          {/* Toolbar do painel */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => { setActiveStatus(null); setSearchInput(""); }}
              className="h-9 w-9 rounded-md border border-input bg-background flex items-center justify-center hover:bg-accent transition-colors flex-shrink-0"
              title="Voltar para os cards"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1 relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por título, unidade ou código..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-8 text-sm"
              />
              {searchInput && (
                <button onClick={() => setSearchInput("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">✕</button>
              )}
            </div>
            <Button type="button" variant={viewMode === "grid" ? "default" : "secondary"} onClick={() => setViewMode("grid")} size="sm" className="gap-1.5">
              <Grid3x3 className="h-4 w-4" /> Grade
            </Button>
            <Button type="button" variant={viewMode === "list" ? "default" : "secondary"} onClick={() => setViewMode("list")} size="sm" className="gap-1.5">
              <List className="h-4 w-4" /> Lista
            </Button>
          </div>

          {/* Lista de chamados filtrada */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <div className="h-full overflow-y-auto pr-2 -mr-2">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              ) : ticketsByStatus.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                  <Inbox className="h-12 w-12 opacity-20" />
                  <p className="text-sm">Nenhum chamado com este status</p>
                </div>
              ) : viewMode === "grid" ? (
                <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pb-4">
                  {ticketsByStatus.slice(0, visibleCount).map((t) => (
                    <MeuChamadoCard
                      key={t.id}
                      ticket={t}
                      statusLabel={STATUS_LABEL}
                      allowedNext={ALLOWED_NEXT[t.status] ?? []}
                      onOpen={() => { setSelected(t); initFromSelected(t); setOpen(true); }}
                      onTicket={() => { setSelected(t); initFromSelected(t); setTab("ticket"); setOpen(true); }}
                      onTransfer={() => { setSelected(t); setTransferAgent(""); setTransferDialogOpen(true); }}
                      onUpdateStatus={handleUpdateStatus}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-2 pb-4">
                  {ticketsByStatus.slice(0, visibleCount).map((t) => (
                    <div key={t.id} onClick={() => { setSelected(t); initFromSelected(t); setOpen(true); }} className="rounded-lg border border-border/50 bg-card overflow-hidden cursor-pointer hover:shadow-md hover:border-violet-500/40 transition-all group">
                      <div className="p-4 flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="text-xs font-bold rounded bg-violet-500/10 text-violet-600 dark:text-violet-400 px-2 py-0.5">{t.codigo}</span>
                            <StatusPill status={t.status} />
                            {t.retroativo && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400">Retroativo</span>}
                          </div>
                          <p className="font-semibold text-sm leading-snug truncate">{t.titulo}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{t.solicitante} &middot; {t.unidade}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <span className="text-xs text-muted-foreground">{new Date(t.criadoEm).toLocaleDateString("pt-BR")}</span>
                          <div className="flex gap-1.5">
                            <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); setSelected(t); setTransferAgent(""); setTransferDialogOpen(true); }} className="h-8 px-2.5 gap-1.5 text-xs">
                              <ArrowRightLeft className="size-3.5" /> Transferir
                            </Button>
                            <Button size="sm" onClick={(e) => { e.stopPropagation(); setSelected(t); initFromSelected(t); setOpen(true); }} className="h-8 px-3 text-xs">
                              <TicketIcon className="h-3.5 w-3.5 mr-1.5" /> Abrir
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {visibleCount < ticketsByStatus.length && (
                <div ref={loadMoreRef} className="py-8 flex justify-center">
                  <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-full max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          {selected && (
            <>
              <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-4 border-b flex-shrink-0">
                <div className="brand-gradient rounded-lg p-3 sm:p-4 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs sm:text-sm text-primary-foreground/90 truncate">{selected.protocolo}</div>
                    <DialogTitle className="mt-1 text-base sm:text-xl font-bold text-primary-foreground line-clamp-2">{selected.titulo}</DialogTitle>
                  </div>
                  <StatusPill status={selected.status} />
                </div>
              </DialogHeader>

              <div className="px-4 sm:px-6 pt-3 pb-3 flex gap-2 flex-shrink-0 border-b overflow-x-auto tabs-scrollable">
                {(["resumo", "historico", "ticket"] as const).map((k) => (
                  <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${tab === k ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80"}`}>
                    {k === "resumo" ? "Resumo" : k === "historico" ? "Histórico" : "Ticket"}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-6">
                {tab === "resumo" && (
                  <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1fr,280px] pt-4">
                    <div className="rounded-lg border bg-card p-5 space-y-3 h-fit">
                      <h3 className="font-semibold text-lg">Ficha do chamado</h3>
                      <div className="grid gap-2 text-sm">
                        {[
                          ["Solicitante", selected.solicitante],
                          ["Cargo", selected.cargo],
                          ["E-mail", selected.email],
                          ["Telefone", selected.telefone],
                          ["Unidade", selected.unidade],
                          ["Problema", selected.categoria],
                          selected.descricao && ["Descrição", selected.descricao],
                          ["Data de abertura", new Date(selected.criadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })],
                          selected.visita && ["Visita técnica", selected.visita],
                        ].filter(Boolean).map((item, i) => (
                          <div key={i} className="grid grid-cols-[140px,1fr] gap-4 py-2 border-b last:border-0">
                            <span className="text-muted-foreground font-medium">{item![0]}:</span>
                            <span className="break-words">{item![1]}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border bg-card p-5 space-y-4 h-fit">
                      <h3 className="font-semibold text-lg">Ações</h3>

                      {/* Atribuição badge */}
                      <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm bg-violet-500/10 border border-violet-500/20 text-violet-700 dark:text-violet-300">
                        <UserCheck className="size-4 flex-shrink-0" />
                        <span className="text-xs font-medium">Atribuído a você</span>
                      </div>

                      <div className="space-y-3">
                        {(() => {
                          const mnext = ALLOWED_NEXT[selected.status] ?? [];
                          if (mnext.length === 0) return (
                            <div className="h-10 flex items-center justify-center rounded-md border bg-muted/40 text-sm text-muted-foreground italic px-3">
                              Status final — sem alterações
                            </div>
                          );
                          return (
                            <Select value={modalStatusSel ?? selected.status} onValueChange={(v) => setModalStatusSel(v as TicketStatus)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value={selected.status} disabled>{STATUS_LABEL[selected.status]} (atual)</SelectItem>
                                {mnext.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          );
                        })()}

                        <Button variant="secondary" className="w-full" onClick={() => { setTransferAgent(""); setTransferDialogOpen(true); }}>
                          <ArrowRightLeft className="size-4" /> Transferir chamado
                        </Button>

                        {(ALLOWED_NEXT[selected.status]?.length ?? 0) > 0 && (
                          <Button variant="warning" className="w-full" disabled={!modalStatusSel || modalStatusSel === selected.status || modalSaving}
                            onClick={async () => {
                              if (!modalStatusSel || modalStatusSel === selected.status || modalSaving) return;
                              setModalSaving(true);
                              try { await handleUpdateStatus(selected.id, modalStatusSel); }
                              catch { toast({ title: "Erro", description: "Falha ao atualizar", variant: "destructive" }); }
                              finally { setModalSaving(false); }
                            }}>
                            {modalSaving
                              ? <span className="size-4 animate-spin border border-current border-t-transparent rounded-full inline-block" />
                              : <Save className="size-4" />}
                            {modalSaving ? "Salvando..." : "Atualizar status"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {tab === "historico" && (
                  <div className="pt-4">
                    <h3 className="font-semibold text-lg mb-6">Linha do tempo</h3>
                    <div className="relative space-y-0">
                      {history.map((ev, idx) => {
                        const isAbertura = idx === 0;
                        const isTicket = ev.tipo === "ticket";
                        return (
                          <div key={idx} className="relative flex gap-4 pb-6 last:pb-0">
                            {idx < history.length - 1 && <div className="absolute left-[19px] top-10 bottom-0 w-0.5 bg-border/50" />}
                            <div className="flex-shrink-0 mt-1.5">
                              <div className={`h-10 w-10 rounded-full flex items-center justify-center ring-4 ring-background ${isAbertura ? "bg-green-500 text-white" : isTicket ? "bg-blue-500 text-white" : "bg-orange-500 text-white"}`}>
                                {isAbertura
                                  ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                  : isTicket
                                    ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                    : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}
                              </div>
                            </div>
                            <div className={`flex-1 min-w-0 rounded-xl border p-4 shadow-sm ${isAbertura ? "bg-green-950/20 border-green-800/40" : isTicket ? "bg-blue-950/20 border-blue-800/40" : "bg-orange-950/15 border-orange-800/30"}`}>
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <p className="font-semibold text-sm flex-1">{ev.label.split("\n\n")[0]}</p>
                                <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">{new Date(ev.t).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
                              </div>
                              {ev.usuario_nome && (
                                <div className="text-xs text-muted-foreground">
                                  <span className="font-medium">{isAbertura ? "Aberto por:" : isTicket ? "Enviado por:" : "Alterado por:"}</span>{" "}
                                  <span className="font-medium">{ev.usuario_nome}</span>
                                  {ev.usuario_email && <span className="opacity-70"> · {ev.usuario_email}</span>}
                                </div>
                              )}
                              {ev.files && ev.files.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/30">
                                  {ev.files.map((f, i) => (
                                    <a key={i} href={f.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border bg-background/80 px-3 py-2 text-xs font-medium hover:bg-accent hover:text-primary transition-colors">
                                      {f.mime?.startsWith("image/") ? <ImageIcon className="w-3.5 h-3.5" /> : <Paperclip className="w-3.5 h-3.5" />}
                                      <span className="truncate max-w-[180px]">{f.name}</span>
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {history.length === 0 && <p className="text-sm text-muted-foreground py-4">Nenhum histórico disponível</p>}
                    </div>
                  </div>
                )}

                {tab === "ticket" && (
                  <div className="pt-4">
                    {/* Compose card */}
                    <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">

                      {/* Header */}
                      <div className="px-4 py-3 bg-muted/30 border-b border-border/40 flex items-center gap-2 text-sm">
                        <svg className="w-4 h-4 flex-shrink-0 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span className="font-medium text-foreground">Para:</span>
                        <span className="truncate text-muted-foreground">{selected?.email || "—"}</span>
                      </div>

                      {/* Seletor de modelo */}
                      <div className="px-4 py-2.5 border-b border-border/40 flex items-center gap-3">
                        <span className="text-xs font-medium text-muted-foreground w-14 flex-shrink-0">Modelo</span>
                        <Select
                          key={`template-select-${template || "none"}`}
                          value={template || "none"}
                          onValueChange={(v) => {
                            const chamadoId = selected?.codigo || "EVQ-XXXX";
                            const solicitante = selected?.solicitante || "[Nome do solicitante]";
                            const problema = selected?.categoria || "[Problema]";
                            const unidade = selected?.unidade || "[Unidade]";
                            const dataAbertura = selected?.criadoEm
                              ? new Date(selected.criadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
                              : "[Data de abertura]";
                            const statusChamado = (() => {
                              if (selected?.status === "ABERTO") return "Aberto";
                              if (selected?.status === "EM_ATENDIMENTO") return "Em atendimento";
                              if (selected?.status === "AGUARDANDO") return "Aguardando";
                              if (selected?.status === "CONCLUIDO") return "Concluído";
                              if (selected?.status === "EXPIRADO") return "Expirado";
                              return "[Status do chamado]";
                            })();
                            if (v === "none") { setTemplate(""); setMessage(""); setSubject(`Atualização do Chamado ${chamadoId}`); }
                            else if (v === "atualizacao") { setTemplate("atualizacao"); setSubject(`Atualização do Chamado ${chamadoId}`); setMessage(`Prezado(a) ${solicitante},\n\nSeu chamado ${chamadoId} foi atualizado.\nStatus atual: ${statusChamado}\n\nAtenciosamente,\nEquipe de Suporte TI`); }
                            else if (v === "confirmacao") { setTemplate("confirmacao"); setSubject(`Atualização do Chamado ${chamadoId}`); setMessage(`Prezado(a) ${solicitante},\n\nConfirmamos o recebimento do seu chamado ${chamadoId}.\nEm breve nossa equipe iniciará o atendimento.\n\nDetalhes do chamado:\n- Problema: ${problema}\n- Unidade: ${unidade}\n- Data de abertura: ${dataAbertura}\n\nManteremos você informado sobre o progresso.\n\nAtenciosamente,\nEquipe de Suporte TI`); }
                            else if (v === "conclusao") { setTemplate("conclusao"); setSubject(`Atualização do Chamado ${chamadoId}`); setMessage(`Prezado(a) ${solicitante},\n\nSeu chamado ${chamadoId} foi concluído com sucesso.\n\nResumo do atendimento:\n- Problema relatado: ${problema}\n- Data de conclusão: ${new Date().toLocaleDateString("pt-BR")}, ${new Date().toLocaleTimeString("pt-BR")}\n\nCaso necessite de suporte adicional, não hesite em abrir um novo chamado.\n\nAtenciosamente,\nEquipe de Suporte TI`); }
                          }}
                        >
                          <SelectTrigger className="h-8 flex-1 text-sm border-border/60">
                            <SelectValue placeholder="Selecione um modelo (opcional)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sem modelo</SelectItem>
                            <SelectItem value="atualizacao">Atualização de Status</SelectItem>
                            <SelectItem value="confirmacao">Confirmação de Recebimento</SelectItem>
                            <SelectItem value="conclusao">Conclusão de Chamado</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Assunto */}
                      <div className="px-4 py-2.5 border-b border-border/40 flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground w-14 flex-shrink-0">Assunto</span>
                        <input
                          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                          placeholder="Assunto do ticket"
                        />
                      </div>

                      {/* Mensagem */}
                      <textarea
                        className="w-full min-h-[200px] px-4 py-3 bg-transparent text-sm resize-none outline-none placeholder:text-muted-foreground/50"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Escreva sua mensagem aqui..."
                      />

                      {/* Arquivos anexados */}
                      {files.length > 0 && (
                        <div className="px-4 pb-2 flex flex-wrap gap-2">
                          {files.map((f, i) => (
                            <div key={i} className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 border border-border/50 px-2.5 py-1 text-xs">
                              <Paperclip className="w-3 h-3 text-muted-foreground" />
                              <span className="max-w-[140px] truncate">{f.name}</span>
                              <button type="button" onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-foreground ml-0.5">✕</button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Toolbar inferior */}
                      <div className="px-4 py-3 border-t border-border/40 bg-muted/20 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {/* Anexar */}
                          <label className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors" title="Anexar arquivo" onClick={(e) => e.stopPropagation()}>
                            <Paperclip className="w-4 h-4" />
                            <input type="file" multiple className="hidden" onClick={(e) => e.stopPropagation()} onChange={(e) => { e.stopPropagation(); setFiles(prev => [...prev, ...Array.from(e.target.files || [])]); }} />
                          </label>

                          <div className="h-4 w-px bg-border/60" />

                          {/* Prioritário */}
                          <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer text-muted-foreground hover:text-foreground transition-colors select-none">
                            <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-colors ${priority ? "bg-amber-500 border-amber-500" : "border-muted-foreground/40"}`}
                              onClick={() => setPriority(p => !p)}>
                              {priority && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                            </div>
                            Prioritário
                          </label>

                          <div className="h-4 w-px bg-border/60" />

                          {/* Cópia para mim */}
                          <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer text-muted-foreground hover:text-foreground transition-colors select-none">
                            <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-colors ${ccMe ? "bg-primary border-primary" : "border-muted-foreground/40"}`}
                              onClick={() => setCcMe(p => !p)}>
                              {ccMe && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                            </div>
                            Cópia para mim
                          </label>
                        </div>

                        <Button onClick={handleSendTicket} disabled={ticketSaving} className="h-9 px-5 gap-2 rounded-xl">
                          {ticketSaving
                            ? <span className="w-4 h-4 animate-spin border-2 border-current border-t-transparent rounded-full" />
                            : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>}
                          {ticketSaving ? "Enviando..." : "Enviar"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="size-5" /> Transferir Chamado
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              O chamado será removido de <strong>Meus chamados</strong> e ficará visível apenas para o novo responsável.
            </p>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Transferir para</label>
              <Select value={transferAgent} onValueChange={setTransferAgent}>
                <SelectTrigger><SelectValue placeholder="Escolha um administrador..." /></SelectTrigger>
                <SelectContent>
                  {agents.filter((a) => a.email !== user?.email).map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.nome} ({a.email})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setTransferDialogOpen(false); setTransferAgent(""); }}>Cancelar</Button>
              <Button onClick={handleTransferir} disabled={!transferAgent}>
                <ArrowRightLeft className="size-4 mr-2" /> Confirmar Transferência
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
