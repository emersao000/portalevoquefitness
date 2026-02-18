import Layout from "@/components/layout/Layout";
import { sectors } from "@/data/sectors";
import { Link, useParams, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { useState, useEffect } from "react";
import { useAuthContext } from "@/lib/auth-context";
import { TIDashboard } from "@/components/ti-dashboard/TIDashboard";
import { apiFetch } from "@/lib/api";

interface Ticket {
  id: string;
  codigo: string;
  protocolo: string;
  data: string;
  problema: string;
  status: string;
}

interface Problema {
  id: number;
  nome: string;
  prioridade: string;
  requer_internet: boolean;
  tempo_resolucao_horas: number | null;
}

export default function SectorPage() {
  const { slug } = useParams<{ slug: string }>();
  const sector = sectors.find((s) => s.slug === slug);

  // Redirect BI slug to the dedicated BI portal route
  if (slug === "bi") {
    return <Navigate to="/setor/bi" replace />;
  }

  const isTI = slug === "ti";

  // Simple local tickets store
  const [tickets, setTickets] = useState<Ticket[]>([]);

  const [open, setOpen] = useState(false);
  const [, setTick] = useState(0);

  // Listen for permission updates
  useEffect(() => {
    const handler = () => {
      console.debug("[SECTOR] Permission update detected, re-rendering");
      setTick((t) => t + 1);
    };
    window.addEventListener("auth:refresh", handler as EventListener);
    window.addEventListener("user:data-updated", handler as EventListener);
    return () => {
      window.removeEventListener("auth:refresh", handler as EventListener);
      window.removeEventListener("user:data-updated", handler as EventListener);
    };
  }, []);

  const header = (
    <section className="w-full">
      <div className="brand-gradient">
        <div className="container py-10 sm:py-14">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-primary-foreground drop-shadow">
            {sector ? sector.title : "Setor"}
          </h1>
          <p className="mt-2 text-primary-foreground/90 max-w-2xl">
            {sector ? sector.description : "Setor não encontrado."}
          </p>
        </div>
      </div>
    </section>
  );

  const { user } = useAuthContext();

  const hasAccess = () => {
    if (!user) return false;
    if (user.nivel_acesso === "Administrador") return true;
    const mapa: Record<string, string> = {
      ti: "Portal de TI",
      manutencao: "Portal de Manutenção",
      bi: "Portal de BI",
      financeiro: "Portal Financeiro",
    };
    const required = mapa[slug || ""];
    if (!required) return false;
    const normalize = (s: any) =>
      typeof s === "string"
        ? s
            .normalize("NFKD")
            .replace(/\p{Diacritic}/gu, "")
            .toLowerCase()
        : s;
    const userSectors = Array.isArray(user.setores)
      ? user.setores.map(normalize)
      : [];
    const reqNorm = normalize(required);
    return userSectors.some((s) => {
      if (!s || !reqNorm) return false;
      return (
        s === reqNorm ||
        s.includes(reqNorm) ||
        reqNorm.includes(s) ||
        s.split(" ").some((tok) => reqNorm.includes(tok)) ||
        reqNorm.split(" ").some((tok) => s.includes(tok))
      );
    });
  };

  if (!isTI) {
    // Non-TI sectors: still check access
    if (!hasAccess()) {
      return (
        <Layout>
          {header}
          <section className="container py-8">
            <div className="rounded-xl border border-border/60 bg-card p-6 sm:p-8 text-center">
              <h2 className="text-lg font-semibold mb-2">Acesso negado</h2>
              <p className="text-muted-foreground mb-4">
                Você não tem permissão para acessar este setor.
              </p>
              <div className="mt-6 flex items-center gap-3 justify-center">
                <Button asChild>
                  <Link to="/">Voltar ao início</Link>
                </Button>
              </div>
            </div>
          </section>
        </Layout>
      );
    }

    return (
      <Layout>
        {header}
        <section className="container py-8">
          <div className="rounded-xl border border-border/60 bg-card p-6 sm:p-8">
            <p className="text-muted-foreground">
              Em breve adicionaremos funcionalidades específicas para este
              setor.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <Button asChild>
                <Link to="/">Voltar ao início</Link>
              </Button>
              <Button variant="secondary" asChild>
                <Link to="#setores">Ver todos os setores</Link>
              </Button>
            </div>
          </div>
        </section>
      </Layout>
    );
  }

  // Check TI sector access
  if (!hasAccess()) {
    return (
      <Layout>
        {header}
        <section className="container py-8">
          <div className="rounded-xl border border-border/60 bg-card p-6 sm:p-8 text-center">
            <h2 className="text-lg font-semibold mb-2">Acesso negado</h2>
            <p className="text-muted-foreground mb-4">
              Você não tem permissão para acessar o setor de ti.
            </p>
            <div className="mt-6 flex items-center gap-3 justify-center">
              <Button asChild>
                <Link to="/">Voltar ao início</Link>
              </Button>
            </div>
          </div>
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      {header}
      <section className="container py-8 space-y-8">
        {/* TI Dashboard */}
        <TIDashboard />

        {/* Histórico de chamados */}
        <div>
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="text-lg sm:text-xl font-semibold">
              Histórico de chamados
            </h2>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-full">Abrir novo chamado</Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle>Abrir chamado</DialogTitle>
                </DialogHeader>
                <TicketForm
                  onSubmit={(payload) => {
                    const now = new Date();
                    setTickets((prev) => {
                      const id = Math.random()
                        .toString(36)
                        .slice(2, 8)
                        .toUpperCase();
                      const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
                      const seq =
                        prev.filter((t) => t.protocolo.startsWith(`${ymd}-`))
                          .length + 1;
                      const protocolo = `${ymd}-${seq}`;
                      let maxCode = 0;
                      for (const t of prev) {
                        const m = /^EVQ-(\d{4})$/.exec(t.codigo);
                        if (m) {
                          const n = parseInt(m[1], 10);
                          if (!Number.isNaN(n) && n > maxCode) maxCode = n;
                        }
                      }
                      const nextNum = Math.max(maxCode + 1, 81);
                      const codigo = `EVQ-${String(nextNum).padStart(4, "0")}`;
                      const novo: Ticket = {
                        id,
                        codigo,
                        protocolo,
                        data: now.toISOString().slice(0, 10),
                        problema: payload.problema,
                        status: "Aberto",
                      };
                      return [novo, ...prev];
                    });
                    setOpen(false);
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border/60 bg-card">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left">
                  <th className="px-4 py-3 font-semibold">Código</th>
                  <th className="px-4 py-3 font-semibold">Protocolo</th>
                  <th className="px-4 py-3 font-semibold">Data</th>
                  <th className="px-4 py-3 font-semibold">Problema</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {tickets.length === 0 ? (
                  <tr>
                    <td
                      className="px-4 py-6 text-center text-muted-foreground"
                      colSpan={6}
                    >
                      Você ainda não abriu nenhum chamado.
                    </td>
                  </tr>
                ) : (
                  tickets.map((t) => (
                    <tr key={t.id} className="border-t border-border/60">
                      <td className="px-4 py-3">{t.codigo}</td>
                      <td className="px-4 py-3">{t.protocolo}</td>
                      <td className="px-4 py-3">
                        {new Date(t.data).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">{t.problema}</td>
                      <td className="px-4 py-3">{t.status}</td>
                      <td className="px-4 py-3">
                        <Button variant="secondary" size="sm">
                          Ver
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </Layout>
  );
}

function TicketForm({
  onSubmit,
}: {
  onSubmit: (payload: {
    nome: string;
    cargo: string;
    gerente: string;
    email: string;
    telefone: string;
    unidade: string;
    problema: string;
    visita: string;
  }) => void;
}) {
  const [form, setForm] = useState({
    nome: "",
    cargo: "Gerente",
    gerente: "",
    email: "",
    telefone: "",
    unidade: "",
    problema: "",
    visita: "",
  });

  const [problemas, setProblemas] = useState<Problema[]>([]);
  const [problemaSelecionado, setProblemaSelecionado] =
    useState<Problema | null>(null);
  const [loadingProblemas, setLoadingProblemas] = useState(true);

  useEffect(() => {
    const carregarProblemas = async () => {
      try {
        const response = await apiFetch("/problemas");
        if (!response.ok) throw new Error("Falha ao carregar problemas");
        const data = await response.json();
        setProblemas(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Erro ao carregar problemas:", error);
        setProblemas([]);
      } finally {
        setLoadingProblemas(false);
      }
    };

    carregarProblemas();
  }, []);

  const handleProblemaChange = (problemaId: string) => {
    const problema = problemas.find((p) => p.nome === problemaId);
    setForm({ ...form, problema: problemaId });
    setProblemaSelecionado(problema || null);
  };

  const formatTempo = (horas: number | null) => {
    if (!horas) return null;
    if (horas < 24) return `${horas}h`;
    const dias = horas / 24;
    return dias % 1 === 0 ? `${dias}d` : `${horas}h`;
  };

  const getPrioridadeColor = (prioridade: string) => {
    const colors: Record<string, string> = {
      Crítica: "text-red-600 dark:text-red-400",
      Alta: "text-orange-600 dark:text-orange-400",
      Normal: "text-blue-600 dark:text-blue-400",
      Baixa: "text-green-600 dark:text-green-400",
    };
    return colors[prioridade] || colors.Normal;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="nome">Nome do solicitante</Label>
        <Input
          id="nome"
          value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
          required
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="cargo">Cargo</Label>
          <Select
            value={form.cargo}
            onValueChange={(v) => setForm({ ...form, cargo: v })}
          >
            <SelectTrigger id="cargo">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Gerente">Gerente</SelectItem>
              <SelectItem value="Coordenador">Coordenador</SelectItem>
              <SelectItem value="Analista">Analista</SelectItem>
              <SelectItem value="Assistente">Assistente</SelectItem>
              <SelectItem value="Outro">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="gerente">Gerente</Label>
          <Input
            id="gerente"
            placeholder="Nome do gerente"
            value={form.gerente}
            onChange={(e) => setForm({ ...form, gerente: e.target.value })}
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="telefone">Telefone</Label>
          <Input
            id="telefone"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="11987654321"
            value={form.telefone}
            onChange={(e) => setForm({ ...form, telefone: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label>Selecione a unidade</Label>
          <Select
            value={form.unidade}
            onValueChange={(v) => setForm({ ...form, unidade: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Centro">Centro</SelectItem>
              <SelectItem value="Zona Sul">Zona Sul</SelectItem>
              <SelectItem value="Zona Norte">Zona Norte</SelectItem>
              <SelectItem value="Zona Leste">Zona Leste</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Problema Reportado</Label>
          <Select
            value={form.problema}
            onValueChange={handleProblemaChange}
            disabled={loadingProblemas}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={loadingProblemas ? "Carregando..." : "Selecione"}
              />
            </SelectTrigger>
            <SelectContent>
              {problemas.map((p) => (
                <SelectItem key={p.id} value={p.nome}>
                  {p.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {problemaSelecionado && (
          <div className="grid gap-2 mt-2 p-3 rounded-lg bg-secondary/40 border border-secondary">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Prioridade:</span>
                <span
                  className={`font-semibold text-sm ${getPrioridadeColor(problemaSelecionado.prioridade)}`}
                >
                  {problemaSelecionado.prioridade}
                </span>
              </div>
              {problemaSelecionado.tempo_resolucao_horas && (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Prazo máximo:</span>
                  <span className="font-semibold text-sm">
                    {formatTempo(problemaSelecionado.tempo_resolucao_horas)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="visita">Visita Técnica</Label>
        <Input
          id="visita"
          type="date"
          placeholder="dd/mm/aaaa"
          value={form.visita}
          onChange={(e) => setForm({ ...form, visita: e.target.value })}
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button type="submit">Salvar</Button>
      </div>
    </form>
  );
}
