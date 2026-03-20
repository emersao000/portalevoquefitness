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
  ChevronDown,
  UserCheck,
  ArrowRightLeft,
  Inbox,
  RefreshCw,
} from "lucide-react";
// mock removido — não usar dados falsos em produção
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
    status === "ABERTO"
      ? "Aberto"
      : status === "EM_ATENDIMENTO"
        ? "Em atendimento"
        : status === "AGUARDANDO"
          ? "Aguardando"
          : status === "CONCLUIDO"
            ? "Concluído"
            : "Expirado";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles}`}
    >
      {label}
    </span>
  );
}


function StatusDot({ status }: { status: TicketStatus }) {
  const color =
    status === "ABERTO" ? "bg-cyan-400"
    : status === "EM_ATENDIMENTO" ? "bg-amber-400"
    : status === "AGUARDANDO" ? "bg-indigo-400"
    : status === "CONCLUIDO" ? "bg-green-400"
    : "bg-red-400";
  const label =
    status === "ABERTO" ? "Aberto"
    : status === "EM_ATENDIMENTO" ? "Em atendimento"
    : status === "AGUARDANDO" ? "Aguardando"
    : status === "CONCLUIDO" ? "Concluído"
    : "Expirado";
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color}`} title={label} />;
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
  onAtribuirAMim,
  onTransferir,
  retroativo,
  assumidoPorId,
  assumidoPorNome,
  currentUserId,
  isAdminUser,
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
  onAtribuirAMim: (id: string) => void;
  onTransferir: (id: string) => void;
  retroativo?: boolean;
  assumidoPorId?: number | null;
  assumidoPorNome?: string | null;
  currentUserId?: number | null;
  isAdminUser?: boolean;
}) {
  const [sel, setSel] = useState<TicketStatus>(status);
  const [isSaving, setIsSaving] = useState(false);

  const isMine = assumidoPorId != null && assumidoPorId === currentUserId;
  const isAssignedToOther = assumidoPorId != null && assumidoPorId !== currentUserId;

  // Transicoes de status permitidas (sem voltar atras)
  const ALLOWED_NEXT: Record<TicketStatus, TicketStatus[]> = {
    ABERTO:         ["EM_ATENDIMENTO", "AGUARDANDO", "CONCLUIDO"],
    EM_ATENDIMENTO: ["AGUARDANDO", "CONCLUIDO"],
    AGUARDANDO:     ["EM_ATENDIMENTO", "CONCLUIDO"],
    CONCLUIDO:      [],
    EXPIRADO:       [],
  };
  const STATUS_LABEL: Record<TicketStatus, string> = {
    ABERTO: "Aberto",
    EM_ATENDIMENTO: "Em atendimento",
    AGUARDANDO: "Aguardando",
    CONCLUIDO: "Concluído",
    EXPIRADO: "Expirado",
  };
  const allowedNext = ALLOWED_NEXT[status] ?? [];

  return (
    <div className="rounded-lg border border-border/60 bg-card overflow-hidden hover:shadow-md transition-all">
      <div className="px-3 py-2 border-b border-border/60 bg-muted/30 space-y-1.5">
        {/* Linha 1: código + status */}
        <div className="flex items-center justify-between gap-2">
          <div className="font-semibold text-sm text-primary truncate">{codigo}</div>
          <StatusPill status={status} />
        </div>
        {/* Linha 2: badges (só renderiza se tiver algum) */}
        {(retroativo || isMine || isAssignedToOther) && (
          <div className="flex flex-wrap items-center gap-1">
            {retroativo && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300 whitespace-nowrap">
                Retroativo
              </span>
            )}
            {isMine && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300 flex items-center gap-1 whitespace-nowrap">
                <UserCheck className="size-3" /> Meu
              </span>
            )}
            {isAssignedToOther && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300 truncate max-w-[120px]" title={assumidoPorNome || ""}>
                {assumidoPorNome?.split(" ")[0]}
              </span>
            )}
          </div>
        )}
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

        {/* Status change — only if not assigned to someone else */}
        {!isAssignedToOther && (
          <div className="pt-2 border-t border-border/40">
            {allowedNext.length === 0 ? (
              <div className="h-8 flex items-center justify-center text-xs text-muted-foreground italic">
                Status final — sem alterações
              </div>
            ) : (
              <Select value={sel} onValueChange={(v) => setSel(v as TicketStatus)}>
                <SelectTrigger
                  onClick={(e) => e.stopPropagation()}
                  className="h-8 text-xs"
                >
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={status} disabled>
                    {STATUS_LABEL[status]} (atual)
                  </SelectItem>
                  {allowedNext.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        <div className="flex gap-1.5">
          {/* Atribuir a mim — only if not already assigned */}
          {!assumidoPorId && status !== "CONCLUIDO" && status !== "EXPIRADO" && (
            <Button
              size="sm"
              variant="success"
              onClick={(e) => { e.stopPropagation(); onAtribuirAMim(id); }}
              className="h-8 text-xs px-2 flex-1"
              title="Atribuir a mim"
            >
              <UserCheck className="size-3" />
            </Button>
          )}

          {/* Transferir — apenas admin pode transferir chamado de outro */}
          {assumidoPorId != null && status !== "CONCLUIDO" && status !== "EXPIRADO" && isAdminUser && (
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => { e.stopPropagation(); onTransferir(id); }}
              className="h-8 text-xs px-2 flex-1"
              title="Transferir"
            >
              <ArrowRightLeft className="size-3" />
            </Button>
          )}

          {/* Save status — disabled if assigned to other */}
          {!isAssignedToOther && (
            <Button
              size="sm"
              variant="warning"
              disabled={isSaving || sel === status || allowedNext.length === 0}
              onClick={async (e) => {
                e.stopPropagation();
                if (isSaving || sel === status || !allowedNext.includes(sel)) return;
                setIsSaving(true);
                try { await onUpdate(id, sel); } finally { setIsSaving(false); }
              }}
              className="h-8 text-xs px-2 flex-1"
              title="Salvar status"
            >
              {isSaving
                ? <span className="size-3 animate-spin border border-current border-t-transparent rounded-full inline-block" />
                : <Save className="size-3" />}
            </Button>
          )}
          <Button
            size="sm"
            variant="info"
            onClick={(e) => { e.stopPropagation(); onTicket(); }}
            className="h-8 text-xs px-2 flex-1"
            title="Ver detalhes"
          >
            <TicketIcon className="size-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ChamadosPage() {
  const [activeFilter, setActiveFilter] = useState<"todos" | "meus" | TicketStatus>("todos");
  const [items, setItems] = useState<UiTicket[]>([]);
  const { user } = useAuthContext();

  // Refresh manual e rastreamento de novos chamados
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [newTicketsBadge, setNewTicketsBadge] = useState(0);

  // Pagination state
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const INITIAL_SIZE = 30;  // Exibe rápido — só o necessário para renderizar
  const BG_SIZE = 500;      // Busca silenciosa completa em background
  const bgLoadedRef = useRef(false);

  // Infinite scroll state (client-side within loaded items)
  const [visibleTickets, setVisibleTickets] = useState(18);
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

  function toUiStatus(s: string): TicketStatus {
    const n = (s || "")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toUpperCase();
    const nn = n.replace(/\s+/g, "_");
    if (nn === "EM_ATENDIMENTO") return "EM_ATENDIMENTO";
    if (nn === "AGUARDANDO") return "AGUARDANDO";
    if (nn === "CONCLUIDO") return "CONCLUIDO";
    if (nn === "EXPIRADO") return "EXPIRADO";
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
      retroativo: it.retroativo ?? false,
      assumidoPorId: it.status_assumido_por_id ?? null,
      assumidoPorNome: it.status_assumido_por_nome ?? null,
      assumidoPorEmail: it.status_assumido_por_email ?? null,
    };
  }

  // Load tickets: primeiros 30 rápido, depois busca resto em background silenciosamente
  const fetchPage = useCallback(async (pageIndex: number, replace: boolean) => {
    if (pageIndex === 0) setLoadingInitial(true);
    else setLoadingMore(true);
    try {
      const limit = pageIndex === 0 ? INITIAL_SIZE : BG_SIZE;
      const offset = pageIndex === 0 ? 0 : INITIAL_SIZE;
      const r = await apiFetch(
        `/chamados?admin=true&limit=${limit}&offset=${offset}`
      );
      if (!r.ok) throw new Error("fail");
      const data: any[] = await r.json();
      const mapped = Array.isArray(data) ? data.map(adapt) : [];
      if (replace) {
        setItems(mapped);
      } else {
        setItems((prev) => {
          const existingIds = new Set(prev.map((t) => t.id));
          return [...prev, ...mapped.filter((t) => !existingIds.has(t.id))];
        });
      }
      setHasMore(mapped.length === limit);
      setPage(pageIndex);
      if (replace) setLastUpdated(new Date());
      if (replace) setFetchError(false);
    } catch {
      if (pageIndex === 0) {
        // Não usar dados mock — mostrar estado de erro real
        setItems([]);
        setFetchError(true);
      }
    } finally {
      setLoadingInitial(false);
      setLoadingMore(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // adaptMock removido — sem dados fake em produção

  useEffect(() => {
    // Carrega os 10 primeiros rápido, depois busca tudo em background silenciosamente
    bgLoadedRef.current = false;
    (async () => {
      await fetchPage(0, true);          // 30 chamados — rápido
      setTimeout(async () => {
        await fetchPage(1, false);       // restante em background silencioso
        bgLoadedRef.current = true;
      }, 200);
    })();

    // Socket.IO for real-time updates
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
        // Recarrega primeira página para pegar o novo chamado
        fetchPage(0, true);
        // Incrementa badge de novos chamados
        setNewTicketsBadge((n) => n + 1);
        // Notificação visual
        toast({
          title: "📋 Novo chamado recebido",
          description: "Um novo chamado foi aberto e adicionado à lista.",
        });
      });
      socket.on("chamado:status", (data: { id: number; status: string }) => {
        setItems((prev) =>
          prev.map((it) =>
            String(it.id) === String(data.id)
              ? {
                  ...it,
                  status: (() => {
                    const n = data.status?.toUpperCase();
                    if (n === "EM_ATENDIMENTO") return "EM_ATENDIMENTO";
                    if (
                      n === "AGUARDANDO" ||
                      n === "EM ANÁLISE" ||
                      n === "EM ANALISE"
                    )
                      return "AGUARDANDO";
                    if (n === "CONCLUIDO" || n === "CONCLUÍDO")
                      return "CONCLUIDO";
                    if (n === "EXPIRADO" || n === "CANCELADO") return "EXPIRADO";
                    return "ABERTO";
                  })() as TicketStatus,
                }
              : it,
          ),
        );
        setLastUpdated(new Date());
      });
      socket.on("chamado:deleted", (data: { id: number }) => {
        setItems((prev) =>
          prev.filter((it) => String(it.id) !== String(data.id)),
        );
      });
      socket.on("chamado:assigned", (data: {
        id: number;
        assumidoPorId: number;
        assumidoPorNome: string;
        assumidoPorEmail: string;
      }) => {
        setItems((prev) =>
          prev.map((it) =>
            String(it.id) === String(data.id)
              ? {
                  ...it,
                  assumidoPorId: data.assumidoPorId,
                  assumidoPorNome: data.assumidoPorNome,
                  assumidoPorEmail: data.assumidoPorEmail,
                }
              : it,
          ),
        );
        // Atualiza o modal aberto se for o mesmo chamado
        setSelected((s) =>
          s && String(s.id) === String(data.id)
            ? {
                ...s,
                assumidoPorId: data.assumidoPorId,
                assumidoPorNome: data.assumidoPorNome,
                assumidoPorEmail: data.assumidoPorEmail,
              }
            : s,
        );
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [agents, setAgents] = useState<
    { id: number; nome: string; email: string }[]
  >([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState<string | null>(null);
  const [transferAgent, setTransferAgent] = useState<string>("");
  const [modalStatusSel, setModalStatusSel] = useState<TicketStatus | null>(null);
  const [modalSaving, setModalSaving] = useState(false);
  const [ticketSaving, setTicketSaving] = useState(false);

  const currentUserId = useMemo(() => {
    if (!user?.email) return null;
    const me = agents.find((a) => a.email === user.email);
    return me?.id ?? null;
  }, [agents, user]);

  // Administrador vê tudo; agente vê só os seus + sem responsável
  const isAdminUser = useMemo(() => {
    const nivel = user?.nivel_acesso?.toLowerCase() ?? "";
    return nivel === "administrador" || nivel === "admin";
  }, [user]);

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

    // Regra de visibilidade: todos veem todos os chamados
    const visible = (_t: typeof baseItems[number]) => true;

    return {
      todos: baseItems.filter(visible).length,
      meus: baseItems.filter((t) => t.assumidoPorId != null && t.assumidoPorId === currentUserId).length,
      abertos: baseItems.filter((t) => t.status === "ABERTO" && visible(t)).length,
      atendimento: baseItems.filter((t) => t.status === "EM_ATENDIMENTO" && visible(t)).length,
      aguardando: baseItems.filter((t) => (t.status === "AGUARDANDO" || t.status === "EXPIRADO") && visible(t)).length,
      concluidos: baseItems.filter((t) => t.status === "CONCLUIDO" && visible(t)).length,
    };
  }, [items, selectedUnidades, searchInputValue, currentUserId]);

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

    // Todos os usuários veem todos os chamados.
    // Chamados atribuídos a outra pessoa ficam visíveis em modo somente leitura.

    // Apply active filter
    switch (activeFilter) {
      case "meus":
        filtered = filtered.filter((t) => t.assumidoPorId === currentUserId);
        break;
      case "ABERTO":
        filtered = filtered.filter((t) => t.status === "ABERTO");
        break;
      case "EM_ATENDIMENTO":
        filtered = filtered.filter((t) => t.status === "EM_ATENDIMENTO");
        break;
      case "AGUARDANDO":
        filtered = filtered.filter((t) => t.status === "AGUARDANDO" || t.status === "EXPIRADO");
        break;
      case "CONCLUIDO":
        filtered = filtered.filter((t) => t.status === "CONCLUIDO");
        break;
      // "todos" = sem filtro adicional
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
  }, [activeFilter, items, selectedUnidades, searchInputValue, currentUserId]);

  // Infinite scroll para tickets
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        if (visibleTickets < list.length) {
          // Still have locally-loaded items to show
          setVisibleTickets((prev) => Math.min(prev + 12, list.length));
        } else if (hasMore && !loadingMore && activeFilter === "todos" && !bgLoadedRef.current) {
          // Só busca mais páginas no servidor quando não há filtro ativo E bg ainda não terminou
          fetchPage(page + 1, false);
        }
      },
      { threshold: 0.1 },
    );

    if (loadMoreTicketsRef.current) {
      observer.observe(loadMoreTicketsRef.current);
    }

    return () => observer.disconnect();
  }, [visibleTickets, list.length, hasMore, loadingMore, page, fetchPage, activeFilter]);

  // Reset visible count when filter changes
  useEffect(() => {
    setVisibleTickets(18);
  }, [activeFilter]);

  // Reset visible count when view mode changes
  useEffect(() => {
    setVisibleTickets(18);
  }, [viewMode]);

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<UiTicket | null>(null);
  const [tab, setTab] = useState<"resumo" | "historico" | "ticket">("resumo");
  const [history, setHistory] = useState<
    {
      t: number;
      tipo?: string;
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

  const initFromSelected = useCallback((s: UiTicket) => {
    setModalSaving(false);
    setTicketSaving(false);
    setTab("resumo");
    setModalStatusSel(s.status);
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
            tipo: it.tipo,
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
    if (!selected || ticketSaving) return;
    setTicketSaving(true);
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
        tipo: it.tipo,
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

  async function handleAtribuirAMim(chamadoId: string) {
    if (!user) return;
    try {
      const meAgent = agents.find((a) => a.email === user.email);
      if (!meAgent) {
        toast({ title: "Erro", description: "Seu usuário não foi encontrado na lista de agentes", variant: "destructive" });
        return;
      }
      const r = await apiFetch(`/chamados/${chamadoId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: meAgent.id }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      setItems((prev) =>
        prev.map((it) =>
          it.id === chamadoId
            ? {
                ...it,
                assumidoPorId: data.status_assumido_por_id ?? meAgent.id,
                assumidoPorNome: data.status_assumido_por_nome ?? meAgent.nome,
                assumidoPorEmail: data.status_assumido_por_email ?? meAgent.email,
              }
            : it,
        ),
      );
      if (selected?.id === chamadoId) {
        setSelected((s) => s ? {
          ...s,
          assumidoPorId: data.status_assumido_por_id ?? meAgent.id,
          assumidoPorNome: data.status_assumido_por_nome ?? meAgent.nome,
          assumidoPorEmail: data.status_assumido_por_email ?? meAgent.email,
        } : s);
      }
      toast({ title: "Chamado atribuído", description: "O chamado agora está em Meus chamados" });
    } catch {
      toast({ title: "Erro", description: "Falha ao atribuir chamado", variant: "destructive" });
    }
  }

  async function handleTransferir() {
    if (!transferTargetId || !transferAgent) return;
    try {
      const r = await apiFetch(`/chamados/${transferTargetId}/transferir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: parseInt(transferAgent) }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      const agent = agents.find((a) => a.id === parseInt(transferAgent));
      setItems((prev) =>
        prev.map((it) =>
          it.id === transferTargetId
            ? {
                ...it,
                assumidoPorId: data.status_assumido_por_id ?? parseInt(transferAgent),
                assumidoPorNome: data.status_assumido_por_nome ?? agent?.nome ?? "",
                assumidoPorEmail: data.status_assumido_por_email ?? agent?.email ?? "",
              }
            : it,
        ),
      );
      if (selected?.id === transferTargetId) {
        setSelected((s) => s ? {
          ...s,
          assumidoPorId: data.status_assumido_por_id ?? parseInt(transferAgent),
          assumidoPorNome: data.status_assumido_por_nome ?? agent?.nome ?? "",
          assumidoPorEmail: data.status_assumido_por_email ?? agent?.email ?? "",
        } : s);
      }
      setTransferDialogOpen(false);
      setTransferAgent("");
      setTransferTargetId(null);
      toast({ title: "Chamado transferido", description: `Transferido para ${agent?.nome || "agente"}` });
    } catch {
      toast({ title: "Erro", description: "Falha ao transferir chamado", variant: "destructive" });
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
        tipo: it.tipo,
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

  // Refresh manual — recarrega tudo e zera badge
  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setNewTicketsBadge(0);
    bgLoadedRef.current = false;
    try {
      await fetchPage(0, true);
      setTimeout(async () => {
        await fetchPage(1, false);
        bgLoadedRef.current = true;
      }, 200);
      setLastUpdated(new Date());
      toast({ title: "Lista atualizada", description: "Os chamados foram recarregados." });
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  return (
    <div className="space-y-4 flex flex-col h-full">
      {/* Summary Cards — fixos no topo, clicáveis para filtrar */}
      <div className="sticky top-0 z-10 bg-background pb-2 -mx-1 px-1 pt-1">
      <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        {[
          { key: "todos" as const,         label: "Todos",          value: counts.todos,       from: "from-slate-500",  to: "to-slate-600",  ring: "ring-slate-400" },
          { key: "ABERTO" as const,        label: "Abertos",        value: counts.abertos,     from: "from-green-500",  to: "to-green-600",  ring: "ring-green-400" },
          { key: "EM_ATENDIMENTO" as const,label: "Em atendimento", value: counts.atendimento, from: "from-orange-500", to: "to-orange-600", ring: "ring-orange-400" },
          { key: "AGUARDANDO" as const,    label: "Aguardando",     value: counts.aguardando,  from: "from-indigo-500", to: "to-indigo-600", ring: "ring-indigo-400" },
          { key: "CONCLUIDO" as const,     label: "Concluídos",     value: counts.concluidos,  from: "from-blue-500",   to: "to-blue-600",   ring: "ring-blue-400" },
        ].map((card) => {
          const isActive = activeFilter === card.key;
          return (
            <button
              key={card.key}
              type="button"
              onClick={() => setActiveFilter(card.key)}
              className={`relative rounded-xl p-3 text-left text-white bg-gradient-to-br ${card.from} ${card.to} shadow transition-all duration-200
                hover:scale-[1.03] hover:shadow-lg active:scale-[0.98]
                ${isActive ? `ring-2 ring-inset ${card.ring} scale-[1.03] shadow-lg` : "opacity-85 hover:opacity-100"}`}
            >
              <div className="text-xl font-extrabold leading-none mb-0.5">{card.value}</div>
              <div className="text-xs font-medium opacity-90 leading-tight">{card.label}</div>
              {isActive && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-white/80 shadow" />}
            </button>
          );
        })}
      </div>
      </div>{/* /sticky wrapper */}

      {/* View Toggle + Search + Unidades */}
      <div className="flex-shrink-0">
        <div className="flex items-center gap-2">
          {/* Search Input — tamanho fixo, não ocupa tudo */}
          <div className="relative w-56 sm:w-72">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar unidade ou código..."
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
          <div className="relative group flex-shrink-0">
            <button className="h-9 px-3 text-sm font-medium bg-secondary hover:bg-secondary/80 border border-border/60 rounded-md inline-flex items-center gap-1.5 transition-colors whitespace-nowrap">
              <span className="hidden sm:inline">Unidades</span>
              <span className="sm:hidden">🏢</span>
              {selectedUnidades.length > 0 && (
                <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  {selectedUnidades.length}
                </span>
              )}
              <ChevronDown className="h-4 w-4 opacity-70" />
            </button>

            {/* Dropdown Menu */}
            <div className="absolute left-0 mt-1 w-56 bg-card border border-border/60 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
              <div className="p-2 max-h-64 overflow-y-auto space-y-1">
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

          {/* Spacer */}
          <div className="flex-1" />

          {/* View Mode + Refresh */}
          <div className="flex gap-2 flex-shrink-0">
            <Button
              type="button"
              variant={viewMode === "grid" ? "default" : "secondary"}
              onClick={() => setViewMode("grid")}
              size="sm"
              className="inline-flex items-center gap-1.5"
            >
              <Grid3x3 className="h-4 w-4" />
              Grade
            </Button>
            <Button
              type="button"
              variant={viewMode === "list" ? "default" : "secondary"}
              onClick={() => setViewMode("list")}
              size="sm"
              className="inline-flex items-center gap-1.5"
            >
              <List className="h-4 w-4" />
              Lista
            </Button>
            {/* Botão de refresh manual */}
            <div className="relative">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="inline-flex items-center gap-1.5"
                title="Atualizar chamados"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
              {newTicketsBadge > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 rounded-full bg-green-500 text-white text-[10px] font-bold flex items-center justify-center leading-none animate-bounce">
                  +{newTicketsBadge}
                </span>
              )}
            </div>
          </div>
          {/* Última atualização */}
          {lastUpdated && (
            <span className="text-[11px] text-muted-foreground hidden lg:inline flex-shrink-0">
              Atualizado às {lastUpdated.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
        </div>
      </div>

      {/* Tickets Grid/List com Scroll Infinito */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div
          ref={ticketsContainerRef}
          className="h-full overflow-y-auto pr-2 -mr-2"
        >
          {viewMode === "grid" && (
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pb-4 w-full">
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
                    onAtribuirAMim={handleAtribuirAMim}
                    onTransferir={(id) => {
                      setTransferTargetId(id);
                      setTransferAgent("");
                      setTransferDialogOpen(true);
                    }}
                    currentUserId={currentUserId}
                    isAdminUser={isAdminUser}
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
                          : sel === "EM_ATENDIMENTO"
                            ? "Em atendimento"
                            : sel === "AGUARDANDO"
                              ? "Aguardando"
                              : sel === "CONCLUIDO"
                                ? "Concluído"
                                : "Expirado";
                      try {
                        const r = await apiFetch(`/chamados/${id}/status`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ status: statusText, autor_email: user?.email || null }),
                        });
                        if (!r.ok) throw new Error(await r.text());
                        // Invalida cache SLA para recalcular métricas em tempo real
                        invalidateSLACache();
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
                            tipo: it.tipo,
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
                  />
                </div>
              ))}
            </div>
          )}

          {viewMode === "list" && (
            <div className="rounded-xl border border-border/40 overflow-hidden bg-card pb-1">
              {/* Cabeçalho da tabela */}
              <div className="grid grid-cols-[2rem_6rem_1fr_7rem_8rem_8rem_5.5rem_2.5rem] gap-x-3 px-3 py-2 bg-muted/40 border-b border-border/40 text-xs font-medium text-muted-foreground select-none">
                <div />
                <div>Código</div>
                <div>Título</div>
                <div>Solicitante</div>
                <div>Unidade</div>
                <div>Atribuído a</div>
                <div>Data</div>
                <div />
              </div>

              {/* Linhas */}
              {list.slice(0, visibleTickets).map((t, idx) => (
                <div
                  key={t.id}
                  onClick={() => { setSelected(t); initFromSelected(t); setOpen(true); }}
                  className={`grid grid-cols-[2rem_6rem_1fr_7rem_8rem_8rem_5.5rem_2.5rem] gap-x-3 px-3 py-2.5 items-center cursor-pointer transition-colors hover:bg-muted/30 ${idx !== 0 ? "border-t border-border/20" : ""}`}
                >
                  {/* Indicador de prioridade / status */}
                  <div className="flex justify-center">
                    <StatusDot status={t.status} />
                  </div>

                  {/* Código */}
                  <span className="text-xs font-mono font-semibold text-primary truncate">{t.codigo}</span>

                  {/* Título + categoria */}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate leading-tight">{t.titulo}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.categoria}</p>
                  </div>

                  {/* Solicitante */}
                  <span className="text-xs truncate text-muted-foreground">{t.solicitante}</span>

                  {/* Unidade */}
                  <span className="text-xs truncate text-muted-foreground">{t.unidade}</span>

                  {/* Atribuído a */}
                  <span className="text-xs truncate text-muted-foreground">{t.assumidoPorNome || <span className="italic opacity-50">—</span>}</span>

                  {/* Data */}
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(t.criadoEm).toLocaleDateString("pt-BR")}
                  </span>

                  {/* Ação */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelected(t); initFromSelected(t); setTab("ticket"); setOpen(true); }}
                    className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Abrir ticket"
                  >
                    <TicketIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Loading skeleton on initial load */}
          {loadingInitial && (
            <div className={viewMode === "grid"
              ? "grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pb-4 w-full"
              : "space-y-3 pb-4"}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className={`rounded-lg border border-border/40 bg-card animate-pulse overflow-hidden ${viewMode === "list" ? "h-24" : "h-48"}`}>
                  <div className="h-full bg-muted/30" />
                </div>
              ))}
            </div>
          )}

          {/* Sentinel para infinite scroll — só quando sem filtro ativo ou ainda há itens locais */}
          {!loadingInitial && (visibleTickets < list.length || (hasMore && activeFilter === "todos")) && (
            <div
              ref={loadMoreTicketsRef}
              className="py-8 flex flex-col items-center justify-center gap-3"
            >
              {loadingMore && (
                <>
                  <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                  <p className="text-sm text-muted-foreground animate-pulse">
                    Carregando mais chamados...
                  </p>
                </>
              )}
            </div>
          )}

          {!loadingInitial && fetchError && (
            <div className="text-center py-16 space-y-3">
              <div className="text-4xl">⚠️</div>
              <p className="text-base font-semibold text-destructive">Erro ao carregar chamados</p>
              <p className="text-sm text-muted-foreground">Não foi possível conectar ao servidor. Verifique se o backend está online.</p>
              <button
                onClick={() => { setFetchError(false); fetchPage(0, true); }}
                className="mt-2 inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
              >
                <RefreshCw className="h-4 w-4" /> Tentar novamente
              </button>
            </div>
          )}

          {!loadingInitial && !fetchError && list.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum chamado encontrado
            </div>
          )}
        </div>
      </div>

      {/* Modal de Detalhes - Mantido igual ao anterior */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-full max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
          {selected && (
            <>
              <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-4 border-b flex-shrink-0">
                <div className="brand-gradient rounded-lg p-3 sm:p-4 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs sm:text-sm text-primary-foreground/90 truncate">
                      {selected.protocolo}
                    </div>
                    <DialogTitle className="mt-1 text-base sm:text-xl font-bold text-primary-foreground line-clamp-2">
                      {selected.titulo}
                    </DialogTitle>
                  </div>
                  <StatusPill status={selected.status} />
                </div>
              </DialogHeader>

              <div className="px-4 sm:px-6 pt-3 sm:pt-4 flex gap-1.5 sm:gap-2 flex-shrink-0 border-b pb-3 sm:pb-4 overflow-x-auto tabs-scrollable">
                {(["resumo", "historico", "ticket"] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setTab(k)}
                    className={`rounded-full px-3 sm:px-4 py-1.5 sm:py-2 text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
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

              <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-4 sm:pb-6">
                {tab === "resumo" && (
                  <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1fr,300px] pt-4">
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
                              new Date(selected.criadoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
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

                      {/* Atribuição info */}
                      {selected.assumidoPorId ? (
                        <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                          selected.assumidoPorId === currentUserId
                            ? "bg-violet-500/10 border border-violet-500/20 text-violet-700 dark:text-violet-300"
                            : "bg-orange-500/10 border border-orange-500/20 text-orange-700 dark:text-orange-300"
                        }`}>
                          <UserCheck className="size-4 flex-shrink-0" />
                          <span className="text-xs font-medium truncate">
                            {selected.assumidoPorId === currentUserId
                              ? "Atribuído a você"
                              : `Atribuído: ${selected.assumidoPorNome || "outro admin"}`}
                          </span>
                        </div>
                      ) : null}

                      <div className="space-y-3">
                        {(() => {
                          const isAssignedToOther = selected.assumidoPorId != null && selected.assumidoPorId !== currentUserId;
                          const MNEXT: Record<TicketStatus, TicketStatus[]> = {
                            ABERTO:["EM_ATENDIMENTO","AGUARDANDO","CONCLUIDO"],
                            EM_ATENDIMENTO:["AGUARDANDO","CONCLUIDO"],
                            AGUARDANDO:["EM_ATENDIMENTO","CONCLUIDO"],
                            CONCLUIDO:[], EXPIRADO:[],
                          };
                          const MLABEL: Record<TicketStatus,string> = {
                            ABERTO:"Aberto",EM_ATENDIMENTO:"Em atendimento",
                            AGUARDANDO:"Aguardando",CONCLUIDO:"Concluído",EXPIRADO:"Expirado",
                          };
                          const currentStatus = selected.status;
                          const mnext = MNEXT[currentStatus] ?? [];
                          if (isAssignedToOther) return (
                            <div className="h-10 flex items-center justify-center rounded-md border bg-muted/40 text-sm text-muted-foreground italic px-3 text-center">
                              Atribuído a outro admin
                            </div>
                          );
                          if (mnext.length === 0) return (
                            <div className="h-10 flex items-center justify-center rounded-md border bg-muted/40 text-sm text-muted-foreground italic px-3 text-center">
                              Chamado {MLABEL[currentStatus]?.toLowerCase()} — status final
                            </div>
                          );
                          return (
                            <Select
                              value={modalStatusSel ?? currentStatus}
                              onValueChange={(v) => setModalStatusSel(v as TicketStatus)}
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value={currentStatus} disabled>
                                  {MLABEL[currentStatus]} (atual)
                                </SelectItem>
                                {mnext.map((s) => (
                                  <SelectItem key={s} value={s}>{MLABEL[s]}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          );
                        })()}

                        {/* Atribuir a mim */}
                        {!selected.assumidoPorId && selected.status !== "CONCLUIDO" && selected.status !== "EXPIRADO" && (
                          <Button
                            variant="success"
                            className="w-full"
                            onClick={() => handleAtribuirAMim(selected.id)}
                          >
                            <UserCheck className="size-4" /> Atribuir a mim
                          </Button>
                        )}

                        {/* Atribuir a agente */}
                        {!selected.assumidoPorId && (
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => { setSelectedAgent(""); setAssignDialogOpen(true); }}
                          >
                            <UserPlus className="size-4" /> Atribuir a agente
                          </Button>
                        )}

                        {/* Transferir — qualquer admin pode transferir um chamado atribuído */}
                        {selected.assumidoPorId != null &&
                          selected.status !== "CONCLUIDO" &&
                          selected.status !== "EXPIRADO" && (
                          <Button
                            variant="secondary"
                            className="w-full"
                            onClick={() => {
                              setTransferTargetId(selected.id);
                              setTransferAgent("");
                              setTransferDialogOpen(true);
                            }}
                          >
                            <ArrowRightLeft className="size-4" /> Transferir chamado
                          </Button>
                        )}

                        {/* Atualizar status */}
                        {(selected.assumidoPorId == null || selected.assumidoPorId === currentUserId) && (
                          <Button
                            variant="warning"
                            className="w-full"
                            disabled={!selected || !modalStatusSel || modalStatusSel === selected.status || modalSaving}
                            onClick={async () => {
                              if (!selected || !modalStatusSel || modalStatusSel === selected.status || modalSaving) return;
                              setModalSaving(true);
                              const sel = modalStatusSel;
                              const statusText =
                                sel === "ABERTO" ? "Aberto"
                                : sel === "EM_ATENDIMENTO" ? "Em atendimento"
                                : sel === "AGUARDANDO" ? "Aguardando"
                                : sel === "CONCLUIDO" ? "Concluído"
                                : "Expirado";
                              try {
                                const r = await apiFetch(`/chamados/${selected.id}/status`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ status: statusText, autor_email: user?.email || null }),
                                });
                                if (!r.ok) throw new Error(await r.text());
                                invalidateSLACache();
                                setItems((prev) => prev.map((it) => it.id === selected.id ? { ...it, status: sel } : it));
                                setSelected((s) => s ? { ...s, status: sel } : s);
                                setModalStatusSel(sel);
                                const hist = await apiFetch(`/chamados/${selected.id}/historico`).then((x) => x.json());
                                const arr = hist.items.map((it: any) => ({
                                  t: new Date(it.t).getTime(),
                                  tipo: it.tipo,
                                  label: it.label,
                                  usuario_nome: it.usuario_nome,
                                  usuario_email: it.usuario_email,
                                  attachments: it.anexos ? it.anexos.map((a: any) => a.nome_original) : undefined,
                                  files: it.anexos ? it.anexos.map((a: any) => ({
                                    name: a.nome_original,
                                    url: `${API_BASE.replace(/\/api$/, "")}/${a.caminho_arquivo}`,
                                    mime: a.mime_type || undefined,
                                  })) : undefined,
                                }));
                                setHistory(arr);
                                setTab("historico");
                                toast({ title: "Status atualizado", description: `Alterado para: ${statusText}` });
                              } catch (e) {
                                toast({ title: "Erro", description: "Falha ao atualizar", variant: "destructive" });
                              } finally {
                                setModalSaving(false);
                              }
                            }}
                          >
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
                    <h3 className="font-semibold text-lg mb-6">
                      Linha do tempo
                    </h3>
                    <div className="relative space-y-0">
                      {history.map((ev, idx) => {
                        const isAbertura = idx === 0;
                        const isStatus = ev.tipo === "status";
                        const isTicket = ev.tipo === "ticket";
                        const hasAttachments = ev.files && ev.files.length > 0;
                        return (
                          <div key={idx} className="relative flex gap-4 pb-6 last:pb-0">
                            {/* Linha vertical */}
                            {idx < history.length - 1 && (
                              <div className="absolute left-[19px] top-10 bottom-0 w-0.5 bg-border/50" />
                            )}
                            {/* Dot */}
                            <div className="flex-shrink-0 mt-1.5">
                              <div className={`h-10 w-10 rounded-full flex items-center justify-center ring-4 ring-background ${isAbertura ? "bg-green-500 text-white" : isTicket ? "bg-blue-500 text-white" : "bg-orange-500 text-white"}`}>
                                {isAbertura ? (
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                ) : isTicket ? (
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                )}
                              </div>
                            </div>
                            {/* Conteúdo */}
                            <div className={`flex-1 min-w-0 rounded-xl border p-4 shadow-sm ${
                              isAbertura
                                ? "bg-green-950/20 border-green-800/40 dark:bg-green-950/30 dark:border-green-800/50"
                                : isTicket
                                  ? "bg-blue-950/20 border-blue-800/40 dark:bg-blue-950/30 dark:border-blue-800/50"
                                  : "bg-orange-950/15 border-orange-800/30 dark:bg-orange-950/20 dark:border-orange-800/40"
                            }`}>
                              <div className="flex items-start justify-between gap-2 mb-2">
                                {/* Renderizacao do label: tickets e aberturas tem assunto + corpo separados por \n\n */}
                                {isTicket && ev.label.includes("\n\n") ? (
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-sm leading-snug">
                                      {ev.label.split("\n\n")[0]}
                                    </p>
                                    <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap leading-relaxed">
                                      {ev.label.split("\n\n").slice(1).join("\n\n")}
                                    </p>
                                  </div>
                                ) : ev.tipo === "abertura" && ev.label.includes("\n\n") ? (
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-sm leading-snug">
                                      {ev.label.split("\n\n")[0]}
                                    </p>
                                    <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap leading-relaxed border-l-2 border-green-700/50 pl-3">
                                      {ev.label.split("\n\n").slice(1).join("\n\n")}
                                    </p>
                                  </div>
                                ) : (
                                  <p className="font-semibold text-sm leading-snug flex-1">{ev.label}</p>
                                )}
                                <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0 ml-2">
                                  {new Date(ev.t).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                                </span>
                              </div>
                              {/* Quem fez a ação */}
                              <div className="text-xs text-muted-foreground">
                                {ev.usuario_nome ? (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-medium text-muted-foreground">
                                      {ev.tipo === "abertura"
                                        ? "Aberto por:"
                                        : isTicket
                                          ? "Enviado por:"
                                          : "Alterado por:"}
                                    </span>
                                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
                                      isAbertura
                                        ? "bg-green-900/40 text-green-300 dark:bg-green-900/50 dark:text-green-300"
                                        : isTicket
                                          ? "bg-blue-900/40 text-blue-300 dark:bg-blue-900/50 dark:text-blue-300"
                                          : ev.usuario_nome === "Sistema (automático)"
                                            ? "bg-zinc-700/60 text-zinc-300 dark:bg-zinc-700/70 dark:text-zinc-300"
                                            : "bg-orange-900/40 text-orange-300 dark:bg-orange-900/50 dark:text-orange-300"
                                    }`}>
                                      {ev.usuario_nome}
                                      {ev.usuario_email && ev.usuario_nome !== "Sistema (automático)" && (
                                        <span className="opacity-75">· {ev.usuario_email}</span>
                                      )}
                                    </span>
                                  </div>
                                ) : isStatus ? (
                                  <span className="italic text-muted-foreground/50 text-xs">Usuário não identificado</span>
                                ) : null}
                              </div>
                              {/* Anexos */}
                              {hasAttachments && (
                                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/30">
                                  {ev.files!.map((f, i) => (
                                    <a
                                      key={i}
                                      href={f.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="group inline-flex items-center gap-2 rounded-lg border bg-background/80 px-3 py-2 text-xs font-medium hover:bg-accent transition-colors hover:text-primary"
                                    >
                                      {f.mime?.startsWith("image/") ? (
                                        <ImageIcon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary" />
                                      ) : (
                                        <Paperclip className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary" />
                                      )}
                                      <span className="truncate max-w-[180px]">
                                        {f.name}
                                      </span>
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {history.length === 0 && (
                        <p className="text-sm text-muted-foreground py-4">
                          Nenhum histórico disponível
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {tab === "ticket" && (
                  <div className="pt-4">
                    {/* Compose card */}
                    <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">

                      {/* Header: Para */}
                      <div className="px-4 py-2.5 bg-muted/30 border-b border-border/40 flex items-center gap-2 text-sm">
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
                          {/* Anexar arquivo */}
                          <label className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors" title="Anexar arquivo" onClick={(e) => e.stopPropagation()}>
                            <Paperclip className="w-4 h-4" />
                            <input type="file" multiple className="hidden" onClick={(e) => e.stopPropagation()} onChange={(e) => { e.stopPropagation(); setFiles(prev => [...prev, ...Array.from(e.target.files || [])]); }} />
                          </label>

                          {/* Divididor */}
                          <div className="h-4 w-px bg-border/60" />

                          {/* Prioritário */}
                          <label className="inline-flex items-center gap-1.5 text-xs cursor-pointer text-muted-foreground hover:text-foreground transition-colors select-none">
                            <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-colors ${priority ? "bg-amber-500 border-amber-500" : "border-muted-foreground/40"}`}
                              onClick={() => setPriority(p => !p)}>
                              {priority && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                            </div>
                            Prioritário
                          </label>

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

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atribuir Chamado a Agente</DialogTitle>
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

      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="size-5" /> Transferir Chamado
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Show who currently owns the ticket */}
            {(() => {
              const target = items.find((t) => t.id === transferTargetId);
              return target?.assumidoPorNome ? (
                <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm bg-orange-500/10 border border-orange-500/20 text-orange-700 dark:text-orange-300">
                  <UserCheck className="size-4 flex-shrink-0" />
                  <span className="text-xs font-medium">Atualmente atribuído a: <strong>{target.assumidoPorNome}</strong></span>
                </div>
              ) : null;
            })()}
            <p className="text-sm text-muted-foreground">
              Selecione o administrador para o qual deseja reatribuir este chamado. O responsável atual perderá a atribuição.
            </p>
            <div className="grid gap-2">
              <label className="text-sm font-medium">Transferir para</label>
              <Select value={transferAgent} onValueChange={setTransferAgent}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um administrador..." />
                </SelectTrigger>
                <SelectContent>
                  {agents
                    .filter((a) => {
                      // Exclude the agent currently holding the ticket (no-op transfer)
                      const target = items.find((t) => t.id === transferTargetId);
                      return a.id !== target?.assumidoPorId;
                    })
                    .map((agent) => (
                      <SelectItem key={agent.id} value={String(agent.id)}>
                        {agent.nome} ({agent.email})
                        {agent.id === currentUserId ? " — você" : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => { setTransferDialogOpen(false); setTransferAgent(""); setTransferTargetId(null); }}
              >
                Cancelar
              </Button>
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
