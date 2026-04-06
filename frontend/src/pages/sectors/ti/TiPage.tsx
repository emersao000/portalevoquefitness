import Layout from "@/components/layout/Layout";
import { sectors } from "@/data/sectors";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuthContext } from "@/lib/auth-context";
import {
  CheckCircle, Copy, X, Ticket, Calendar, MapPin,
  User, Phone, Mail, AlertCircle, Clock, Tag,
  FileText, Sparkles, Eye, Loader2,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { apiFetch } from "@/lib/api";

const sector = sectors.find((s) => s.slug === "ti")!;

interface Ticket {
  id: string;
  codigo: string;
  protocolo: string;
  data: string;
  problema: string;
  status: string;
  solicitante?: string;
  cargo?: string;
  email?: string;
  telefone?: string;
  unidade?: string;
  internet_item?: string | null;
  descricao?: string | null;
  prioridade?: string;
  data_abertura?: string;
}

// ── Configurações de status ───────────────────────────────────────────────────
const STATUS_CFG: Record<string, { dot: string; pill: string; label: string }> = {
  "Aberto":          { dot: "bg-blue-500",    pill: "bg-blue-50 text-blue-700 border-blue-200",       label: "Aberto" },
  "Em atendimento":  { dot: "bg-amber-500",   pill: "bg-amber-50 text-amber-700 border-amber-200",    label: "Em atendimento" },
  "Aguardando":      { dot: "bg-yellow-500",  pill: "bg-yellow-50 text-yellow-700 border-yellow-200", label: "Aguardando" },
  "Concluído":       { dot: "bg-emerald-500", pill: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Concluído" },
  "Expirado":        { dot: "bg-gray-400",    pill: "bg-gray-50 text-gray-600 border-gray-200",       label: "Expirado" },
};

const PRIO_CFG: Record<string, { icon: string; pill: string }> = {
  "Crítica": { icon: "🚨", pill: "bg-red-50 text-red-700 border-red-200" },
  "Alta":    { icon: "⚡", pill: "bg-orange-50 text-orange-700 border-orange-200" },
  "Normal":  { icon: "📋", pill: "bg-blue-50 text-blue-700 border-blue-200" },
  "Baixa":   { icon: "✅", pill: "bg-green-50 text-green-700 border-green-200" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_CFG[status] ?? STATUS_CFG["Aberto"];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${s.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

// ── Modal de detalhes do chamado ──────────────────────────────────────────────
function TicketDetailModal({
  ticket, open, onClose,
}: { ticket: Ticket | null; open: boolean; onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); } catch {}
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const fmt = (d?: string) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString("pt-BR", {
        day: "2-digit", month: "long", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch { return d; }
  };

  const prio = PRIO_CFG[ticket?.prioridade ?? "Normal"] ?? PRIO_CFG["Normal"];
  const problemaFmt = ticket?.problema === "Internet" && ticket?.internet_item
    ? `Internet — ${ticket.internet_item}` : (ticket?.problema ?? "");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-full max-w-lg p-0 gap-0 overflow-hidden rounded-2xl">
        {!ticket ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Carregando...</div>
        ) : (<>

        {/* ── Header ── */}
        <div className="relative brand-gradient px-6 pt-6 pb-5 overflow-hidden">
          {/* padrão pontilhado decorativo */}
          <div className="absolute inset-0 opacity-[0.08]"
            style={{ backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)", backgroundSize: "18px 18px" }} />

          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center flex-shrink-0">
                <Ticket className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-white/60 text-[11px] font-semibold uppercase tracking-widest mb-0.5">Detalhes do chamado</p>
                <h2 className="text-white font-bold text-xl leading-none">{ticket.codigo}</h2>
              </div>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors flex-shrink-0 mt-0.5">
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* badges */}
          <div className="relative flex flex-wrap gap-2 mt-4">
            <StatusBadge status={ticket.status} />
            {ticket.prioridade && (
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${prio.pill}`}>
                {prio.icon} {ticket.prioridade}
              </span>
            )}
          </div>
        </div>

        {/* ── Corpo ── */}
        <div className="p-5 space-y-4 max-h-[55vh] overflow-y-auto">

          {/* código + protocolo */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Código", val: ticket.codigo, key: "cod" },
              { label: "Protocolo", val: ticket.protocolo, key: "prot" },
            ].map(({ label, val, key }) => (
              <div key={key} className="rounded-xl border border-border/50 bg-muted/30 px-3 py-2.5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold mb-1">{label}</p>
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono font-bold text-sm truncate">{val}</span>
                  <button onClick={() => copy(val, key)}
                    className="flex-shrink-0 w-6 h-6 rounded-md hover:bg-muted flex items-center justify-center transition-colors">
                    {copied === key
                      ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                      : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* problema */}
          <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Problema</p>
            </div>
            <p className="font-semibold text-sm">{problemaFmt}</p>
          </div>

          {/* descrição */}
          {ticket.descricao && (
            <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Descrição</p>
              </div>
              <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">{ticket.descricao}</p>
            </div>
          )}

          {/* grid de infos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { icon: <User className="w-3.5 h-3.5" />, label: "Solicitante", val: ticket.solicitante },
              { icon: <Tag className="w-3.5 h-3.5" />, label: "Cargo", val: ticket.cargo },
              { icon: <Mail className="w-3.5 h-3.5" />, label: "E-mail", val: ticket.email },
              { icon: <Phone className="w-3.5 h-3.5" />, label: "Telefone", val: ticket.telefone },
              { icon: <MapPin className="w-3.5 h-3.5" />, label: "Unidade", val: ticket.unidade },
              { icon: <Calendar className="w-3.5 h-3.5" />, label: "Abertura", val: fmt(ticket.data_abertura || ticket.data) },
            ].filter((r) => r.val).map(({ icon, label, val }) => (
              <div key={label} className="flex items-start gap-2.5 rounded-lg border border-border/40 bg-background px-3 py-2.5">
                <span className="text-muted-foreground mt-0.5 flex-shrink-0">{icon}</span>
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground font-medium">{label}</p>
                  <p className="text-sm font-medium truncate">{val}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-4 border-t border-border/50 bg-muted/10 flex justify-end">
          <Button onClick={onClose} className="rounded-full px-8">Fechar</Button>
        </div>
        </>)}
      </DialogContent>
    </Dialog>
  );
}

// ── Modal de sucesso ──────────────────────────────────────────────────────────
function SuccessModal({
  open, onClose, lastCreated,
}: { open: boolean; onClose: () => void; lastCreated: { codigo: string; protocolo: string } | null }) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); } catch {}
    setCopied(key);
    setTimeout(() => setCopied(null), 2500);
  };

  const copyAll = () => {
    if (lastCreated)
      copy(`Código: ${lastCreated.codigo} | Protocolo: ${lastCreated.protocolo}`, "all");
  };

  if (!lastCreated) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-full max-w-sm p-0 gap-0 overflow-hidden rounded-3xl border-0 shadow-2xl">

        {/* ── Topo animado ── */}
        <div className="relative brand-gradient px-6 pt-10 pb-8 text-center overflow-hidden select-none">
          {/* círculos de fundo */}
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/5" />
          <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full bg-white/5" />
          {/* estrelinhas */}
          {[
            "top-5 left-8 w-1.5 h-1.5 opacity-40",
            "top-8 right-10 w-1 h-1 opacity-30",
            "bottom-8 left-12 w-1 h-1 opacity-25",
            "bottom-5 right-6 w-2 h-2 opacity-20",
          ].map((cls, i) => (
            <span key={i} className={`absolute rounded-full bg-white ${cls}`} />
          ))}

          {/* ícone central com ping */}
          <div className="relative inline-flex items-center justify-center mb-5">
            <span className="absolute w-20 h-20 rounded-full bg-white/10 animate-ping" style={{ animationDuration: "2.5s" }} />
            <span className="absolute w-24 h-24 rounded-full bg-white/5 animate-ping" style={{ animationDuration: "3s", animationDelay: "0.5s" }} />
            <div className="relative w-16 h-16 rounded-2xl bg-white/15 border border-white/25 backdrop-blur-sm flex items-center justify-center shadow-lg">
              <CheckCircle className="w-8 h-8 text-white" strokeWidth={1.75} />
            </div>
          </div>

          <div className="relative space-y-1.5">
            <div className="flex items-center justify-center gap-1.5 text-white/60 text-[11px] font-semibold uppercase tracking-widest">
              <Sparkles className="w-3 h-3" /> Chamado registrado <Sparkles className="w-3 h-3" />
            </div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight drop-shadow">Tudo certo!</h2>
            <p className="text-white/70 text-sm leading-relaxed">
              Guarde os dados abaixo.<br />Nossa equipe já foi notificada.
            </p>
          </div>
        </div>

        {/* ── Corpo ── */}
        <div className="bg-background px-5 pt-5 pb-2 space-y-3">
          {[
            { label: "Código", val: lastCreated.codigo, key: "codigo" },
            { label: "Protocolo", val: lastCreated.protocolo, key: "protocolo" },
          ].map(({ label, val, key }) => (
            <div key={key}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/30 hover:bg-muted/50 transition-colors px-4 py-3.5">
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-0.5">{label}</p>
                <p className="font-mono font-bold text-base tracking-wider truncate">{val}</p>
              </div>
              <button onClick={() => copy(val, key)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  copied === key
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-secondary hover:bg-muted border-border/60 text-muted-foreground hover:text-foreground"
                }`}>
                {copied === key
                  ? <><CheckCircle className="w-3.5 h-3.5" /> Copiado!</>
                  : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
              </button>
            </div>
          ))}

          <div className="flex items-start gap-2 px-1 pb-1">
            <Clock className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Acompanhe pelo e-mail informado. Em caso de urgência, entre em contato com o suporte.
            </p>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="bg-background px-5 pb-6 flex gap-2">
          <Button variant="outline" className="flex-1 rounded-2xl border-border/60 gap-1.5" onClick={copyAll}>
            {copied === "all"
              ? <><CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Copiado!</>
              : <><Copy className="w-3.5 h-3.5" /> Copiar tudo</>}
          </Button>
          <Button className="flex-1 rounded-2xl" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function TiPage() {
  const { user, isLoading: authLoading } = useAuthContext();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [lastCreated, setLastCreated] = useState<{ codigo: string; protocolo: string } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [detailTicket, setDetailTicket] = useState<Ticket | null>(null);
  const [unidades, setUnidades] = useState<{ id: number; nome: string; cidade: string }[]>([]);
  const [problemas, setProblemas] = useState<{ id: number; nome: string; prioridade: string; requer_internet: boolean }[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 5;

  // Busca chamados do usuário logado assim que o auth estiver pronto
  useEffect(() => {
    if (authLoading) return;

    if (!user?.email) {
      setLoadingTickets(false);
      return;
    }

    const mapTicket = (t: any): Ticket => ({
      id: String(t.id),
      codigo: t.codigo,
      protocolo: t.protocolo,
      data: t.data_abertura?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      problema: t.problema === "Internet" && t.internet_item ? `Internet — ${t.internet_item}` : t.problema,
      status: t.status,
      solicitante: t.solicitante,
      cargo: t.cargo,
      email: t.email,
      telefone: t.telefone,
      unidade: t.unidade,
      internet_item: t.internet_item,
      descricao: t.descricao,
      prioridade: t.prioridade,
      data_abertura: t.data_abertura,
    });

    const load = async () => {
      setLoadingTickets(true);
      try {
        // Tenta vincular retroativamente chamados antigos sem usuario_id
        // (seguro: só afeta chamados sem dono que tenham o mesmo email de login)
        await apiFetch("/chamados/meus/revindicar", { method: "POST" }).catch(() => {});

        // Busca chamados do usuário logado via session token → usuario_id
        const res = await apiFetch("/chamados?meus=true");
        if (!res.ok) return;
        const data: any[] = await res.json();
        setTickets(data.map(mapTicket));
      } catch (e) {
        console.error("Erro ao buscar tickets:", e);
      } finally {
        setLoadingTickets(false);
      }
    };
    load();
  }, [authLoading, user?.email]);

  // Carrega unidades e problemas quando o form abre
  useEffect(() => {
    if (!formOpen) return;
    apiFetch("/unidades").then((r) => r.ok ? r.json() : []).then((d) => setUnidades(Array.isArray(d) ? d : [])).catch(() => {});
    apiFetch("/problemas").then((r) => r.ok ? r.json() : []).then((d) => setProblemas(Array.isArray(d) ? d : [])).catch(() => {});
  }, [formOpen]);

  const handleCreated = (created: any) => {
    const t: Ticket = {
      id: String(created.id),
      codigo: created.codigo,
      protocolo: created.protocolo,
      data: created.data_abertura?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      problema: created.problema === "Internet" && created.internet_item
        ? `Internet — ${created.internet_item}` : created.problema,
      status: created.status,
      solicitante: created.solicitante,
      cargo: created.cargo,
      email: created.email,
      telefone: created.telefone,
      unidade: created.unidade,
      internet_item: created.internet_item,
      descricao: created.descricao,
      prioridade: created.prioridade,
      data_abertura: created.data_abertura,
    };
    setTickets((prev) => [t, ...prev]);
    setCurrentPage(1);
    setLastCreated({ codigo: created.codigo, protocolo: created.protocolo });
    setFormOpen(false);
    setSuccessOpen(true);
  };

  // Atualiza status de um chamado existente na lista sem perder os outros
  const handleStatusUpdated = (chamadoId: string, novoStatus: string) => {
    setTickets((prev) =>
      prev.map((t) => t.id === chamadoId ? { ...t, status: novoStatus } : t)
    );
  };

  return (
    <Layout>
      {/* Hero */}
      <section className="w-full">
        <div className="brand-gradient">
          <div className="container py-6 sm:py-14">
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-primary-foreground drop-shadow">
              {sector.title}
            </h1>
            <p className="mt-2 text-primary-foreground/90 text-sm sm:text-base max-w-2xl">
              {sector.description}
            </p>
          </div>
        </div>
      </section>

      {/* Conteúdo */}
      <section className="container py-4 sm:py-8">
        {/* Barra de ações */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          {user?.nivel_acesso === "Administrador" && (
            <Button asChild variant="secondary" className="rounded-full md:hidden">
              <Link to="/setor/ti/admin">Painel admin</Link>
            </Button>
          )}
          <h2 className="text-lg sm:text-xl font-semibold">Histórico de chamados</h2>
          <div className="flex items-center gap-2 ml-auto">
            {user?.nivel_acesso === "Administrador" && (
              <Button asChild className="hidden md:flex rounded-full" variant="outline">
                <Link to="/setor/ti/admin">Painel administrativo</Link>
              </Button>
            )}
            <Dialog open={formOpen} onOpenChange={setFormOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-full">Abrir novo chamado</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>Abrir chamado</DialogTitle>
                </DialogHeader>
                <TicketForm
                  problemas={problemas}
                  unidades={unidades}
                  initialNome={user?.name || ""}
                  initialEmail={user?.email || ""}
                  onSubmit={async (payload) => {
                    const fd = new FormData();
                    fd.set("solicitante", payload.nome);
                    fd.set("cargo", payload.cargo);
                    fd.set("email", payload.email);
                    fd.set("telefone", payload.telefone);
                    fd.set("unidade", payload.unidade);
                    fd.set("problema", payload.problema);
                    if (payload.internetItem) fd.set("internetItem", payload.internetItem);
                    if (payload.descricao) fd.set("descricao", payload.descricao);
                    payload.files?.forEach((f) => fd.append("files", f));
                    // Envia o e-mail do usuário logado para vincular usuario_id no banco
                    const emailLogado = user?.email || (() => {
                      try { return JSON.parse(sessionStorage.getItem("evoque-fitness-auth") || "{}").email; } catch { return null; }
                    })();
                    if (emailLogado) fd.set("autor_email", emailLogado);

                    const res = await apiFetch("/chamados/with-attachments", { method: "POST", body: fd });
                    if (!res.ok) throw new Error("Falha ao criar chamado");
                    handleCreated(await res.json());
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* ── Desktop: tabela ── */}
        <div className="hidden sm:block overflow-x-auto rounded-xl border border-border/60 bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30 text-left">
                {["Código", "Protocolo", "Data", "Problema", "Status", "Ações"].map((h) => (
                  <th key={h} className="px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loadingTickets ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" /> Carregando chamados...
                    </div>
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="space-y-2">
                      <Ticket className="w-10 h-10 mx-auto text-muted-foreground/30" />
                      <p className="text-muted-foreground text-sm">Você ainda não abriu nenhum chamado.</p>
                    </div>
                  </td>
                </tr>
              ) : tickets.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map((t) => (
                <tr key={t.id} className="border-t border-border/60 hover:bg-muted/20 transition-colors group">
                  <td className="px-4 py-3 font-mono font-bold text-primary text-xs">{t.codigo}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{t.protocolo}</td>
                  <td className="px-4 py-3 text-sm">{new Date(t.data).toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-3 text-sm max-w-[180px] truncate">{t.problema}</td>
                  <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-4 py-3">
                    <Button
                      variant="outline" size="sm"
                      className="rounded-full text-xs h-7 gap-1.5 group-hover:border-primary/40 group-hover:text-primary transition-colors"
                      onClick={() => setDetailTicket(t)}
                    >
                      <Eye className="w-3 h-3" /> Ver
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Paginação ── */}
        {!loadingTickets && tickets.length > PAGE_SIZE && (() => {
          const totalPages = Math.ceil(tickets.length / PAGE_SIZE);
          return (
            <div className="flex items-center justify-center gap-1.5 mt-4">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="h-8 w-8 rounded-lg border border-border/60 bg-card text-sm font-medium flex items-center justify-center disabled:opacity-40 hover:bg-muted/50 transition-colors"
              >
                ‹
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`h-8 w-8 rounded-lg border text-sm font-medium transition-colors ${
                    page === currentPage
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "border-border/60 bg-card hover:bg-muted/50"
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="h-8 w-8 rounded-lg border border-border/60 bg-card text-sm font-medium flex items-center justify-center disabled:opacity-40 hover:bg-muted/50 transition-colors"
              >
                ›
              </button>
            </div>
          );
        })()}

        {/* ── Mobile: cards ── */}
        <div className="sm:hidden space-y-3">
          {loadingTickets ? (
            <div className="rounded-xl border border-border/60 bg-card p-8 text-center">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
              </div>
            </div>
          ) : tickets.length === 0 ? (
            <div className="rounded-xl border border-border/60 bg-card p-10 text-center space-y-2">
              <Ticket className="w-10 h-10 mx-auto text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Nenhum chamado encontrado.</p>
            </div>
          ) : tickets.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map((t) => (
            <div key={t.id} className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono font-bold text-primary text-sm">{t.codigo}</span>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.protocolo}</p>
                </div>
                <StatusBadge status={t.status} />
              </div>
              <p className="text-sm font-medium">{t.problema}</p>
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-muted-foreground">
                  {new Date(t.data).toLocaleDateString("pt-BR")}
                </span>
                <Button
                  variant="outline" size="sm"
                  className="rounded-full text-xs h-7 gap-1.5"
                  onClick={() => setDetailTicket(t)}
                >
                  <Eye className="w-3 h-3" /> Ver detalhes
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Modais */}
      <TicketDetailModal
        ticket={detailTicket}
        open={!!detailTicket}
        onClose={() => setDetailTicket(null)}
      />
      <SuccessModal
        open={successOpen}
        onClose={() => setSuccessOpen(false)}
        lastCreated={lastCreated}
      />
    </Layout>
  );
}

// ── SearchableSelect ──────────────────────────────────────────────────────────
function SearchableSelect({ options, value, onChange, placeholder = "Selecione..." }: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, search]);

  const label = options.find((o) => o.value === value)?.label;

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch(""); }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);

  return (
    <div ref={ref} className="relative w-full">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
        <span className={label ? "" : "text-muted-foreground"}>{label || placeholder}</span>
        <ChevronDown className={`h-4 w-4 opacity-50 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute z-[200] mt-1 w-full rounded-md border border-input bg-popover shadow-lg">
          <div className="flex items-center gap-2 border-b border-input px-3 py-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input ref={inputRef} value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..." className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          </div>
          <div className="max-h-52 overflow-y-auto p-1">
            {filtered.length === 0
              ? <p className="py-3 text-center text-xs text-muted-foreground">Nenhum resultado</p>
              : filtered.map((o) => (
                <button key={o.value} type="button"
                  onClick={() => { onChange(o.value); setOpen(false); setSearch(""); }}
                  className={`flex w-full items-center rounded-sm px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground ${value === o.value ? "bg-accent/60 font-medium" : ""}`}>
                  {o.value === value && <span className="mr-2 text-primary">✓</span>}
                  {o.label}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── TicketForm ────────────────────────────────────────────────────────────────
function TicketForm(props: {
  problemas?: { id: number; nome: string; prioridade: string; requer_internet: boolean }[];
  unidades?: { id: number; nome: string; cidade: string }[];
  initialNome?: string;
  initialEmail?: string;
  onSubmit: (payload: {
    nome: string; cargo: string; email: string; telefone: string;
    unidade: string; problema: string; internetItem?: string; descricao?: string; files?: File[];
  }) => Promise<void> | void;
}) {
  const listaProblemas = Array.isArray(props.problemas) ? props.problemas : [];
  const listaUnidades = Array.isArray(props.unidades) ? props.unidades : [];
  const [form, setForm] = useState({ nome: props.initialNome || "", cargo: "", email: props.initialEmail || "", telefone: "", unidade: "", problema: "", internetItem: "", descricao: "" });
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Ref síncrona para bloquear double-submit antes do re-render do state
  const submittingRef = useRef(false);

  const selectedProblem = useMemo(() => listaProblemas.find((p) => p.nome === form.problema) ?? null, [listaProblemas, form.problema]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Guard síncrono via ref — impede disparo duplo mesmo antes do re-render
    if (submittingRef.current) return;
    if ([form.nome, form.cargo, form.email, form.telefone, form.unidade, form.problema, form.descricao].some((v) => !v.trim())) {
      alert("Preencha todos os campos obrigatórios."); return;
    }
    if (selectedProblem?.requer_internet && !form.internetItem.trim()) {
      alert("Selecione o item de Internet."); return;
    }
    submittingRef.current = true;
    setIsSubmitting(true);
    try { await props.onSubmit({ ...form, files }); }
    catch { alert("Não foi possível abrir o chamado. Tente novamente."); }
    finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const PRIO_FORM: Record<string, { bg: string; border: string; icon: string; iconBg: string; badge: string; bar: string; barW: string; title: string; msg: string }> = {
    Crítica: { bg: "bg-red-500/8", border: "border-red-500/30", icon: "🚨", iconBg: "bg-red-500/15", badge: "bg-red-500 text-white", bar: "bg-red-500", barW: "w-full", title: "Prioridade Crítica", msg: "Atendimento imediato — nossa equipe será acionada agora." },
    Alta:    { bg: "bg-orange-500/8", border: "border-orange-500/30", icon: "⚡", iconBg: "bg-orange-500/15", badge: "bg-orange-500 text-white", bar: "bg-orange-500", barW: "w-3/4", title: "Prioridade Alta", msg: "Você será atendido com urgência dentro do prazo estabelecido." },
    Normal:  { bg: "bg-blue-500/8", border: "border-blue-500/30", icon: "📋", iconBg: "bg-blue-500/15", badge: "bg-blue-500 text-white", bar: "bg-blue-500", barW: "w-2/4", title: "Prioridade Normal", msg: "Seu chamado está na fila e será tratado em breve." },
    Baixa:   { bg: "bg-green-500/8", border: "border-green-500/30", icon: "✅", iconBg: "bg-green-500/15", badge: "bg-green-500 text-white", bar: "bg-green-500", barW: "w-1/4", title: "Prioridade Baixa", msg: "Chamado registrado e será atendido conforme disponibilidade." },
  };

  const formatTempo = (h: number | null) => !h ? null : h < 24 ? `${h}h` : `${Math.round(h / 24)}d`;

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="nome">Nome do solicitante</Label>
        <Input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="cargo">Cargo</Label>
        <Select value={form.cargo} onValueChange={(v) => setForm({ ...form, cargo: v })}>
          <SelectTrigger id="cargo"><SelectValue placeholder="Selecione" /></SelectTrigger>
          <SelectContent>
            {["Coordenador", "Funcionário", "Gerente", "Gerente regional"].map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" value={form.email} readOnly className="bg-muted/40 cursor-not-allowed" title="E-mail preenchido automaticamente com sua conta" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="telefone">Telefone</Label>
          <Input id="telefone" inputMode="numeric" placeholder="11987654321" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} required />
        </div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label>Unidade</Label>
          <SearchableSelect options={listaUnidades.map((u) => ({ value: u.nome, label: u.nome }))} value={form.unidade} onChange={(v) => setForm({ ...form, unidade: v })} placeholder="Selecione a unidade" />
        </div>
        <div className="grid gap-2">
          <Label>Problema</Label>
          <Select value={form.problema} onValueChange={(v) => setForm({ ...form, problema: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {listaProblemas.map((p) => <SelectItem key={p.id} value={p.nome}>{p.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedProblem && (() => {
        const c = PRIO_FORM[selectedProblem.prioridade] ?? PRIO_FORM.Normal;
        const tempo = formatTempo((selectedProblem as any).tempo_resolucao_horas ?? null);
        return (
          <div className={`rounded-xl border ${c.border} ${c.bg} p-4 space-y-3`}>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg ${c.iconBg} flex items-center justify-center text-lg flex-shrink-0`}>{c.icon}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{c.title}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${c.badge}`}>{selectedProblem.prioridade}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{c.msg}</p>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Nível de urgência</span>
                {tempo && <span className="font-medium text-foreground">⏱ Prazo: <strong>{tempo}</strong></span>}
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
                <div className={`h-full rounded-full ${c.bar} ${c.barW} transition-all duration-500`} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground border-t border-border/30 pt-2.5">💬 Acompanhe pelo e-mail informado após a abertura do chamado.</p>
          </div>
        );
      })()}

      {selectedProblem?.requer_internet && (
        <div className="grid gap-2">
          <Label>Item de Internet</Label>
          <Select value={form.internetItem} onValueChange={(v) => setForm({ ...form, internetItem: v })}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {["Antenas", "Cabo de rede", "DVR", "Roteador/Modem", "Switch", "Wi-fi"].map((i) => (
                <SelectItem key={i} value={i}>{i}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="descricao">Descrição do problema</Label>
        <textarea id="descricao"
          className="min-h-[100px] rounded-md border border-input bg-background p-3 text-sm resize-none"
          placeholder="Descreva o que está acontecendo"
          value={form.descricao}
          onChange={(e) => setForm({ ...form, descricao: e.target.value })} required />
      </div>
      <div className="grid gap-2">
        <Label>Arquivos (opcional)</Label>
        <input type="file" multiple onChange={(e) => setFiles(Array.from(e.target.files || []))} />
      </div>
      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={isSubmitting} className="gap-2">
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {isSubmitting ? "Enviando..." : "Abrir chamado"}
        </Button>
      </div>
    </form>
  );
}
