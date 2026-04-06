import { useEffect, useMemo, useState, useRef } from "react";
import { usuariosMock } from "../mock";
import { sectors, loadBISubcategories } from "@/data/sectors";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Copy,
  Edit,
  Edit2,
  Key,
  Lock,
  LogOut,
  Trash2,
  Grid3x3,
  List,
  Search,
  MoreVertical,
  Plus,
  Users,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiFetch } from "@/lib/api";

// Backend API URL - usar URL relativa para aproveitar proxy do Vite
const API_URL = "";

const normalize = (s: string) => {
  try {
    return s
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\u00a0/g, " ")
      .trim();
  } catch {
    return s;
  }
};

const matchSectorTitle = (value: string | null | undefined) => {
  if (!value) return null;
  const n = normalize(String(value));
  const found = sectors.find((sec) => normalize(sec.title) === n);
  return found ? found.title : value;
};

/**
 * Compare two sector names by normalizing them.
 * This ensures "Portal Financeiro", "portal financeiro", "portal de financeiro" etc. are all treated the same.
 */
const isSectorMatch = (sector1: string, sector2: string): boolean => {
  return normalize(sector1) === normalize(sector2);
};

export function CriarUsuario() {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [level, setLevel] = useState("Funcionário");
  const [selSectors, setSelSectors] = useState<string[]>([]);
  const [selBiSubcategories, setSelBiSubcategories] = useState<string>("");
  const [forceReset, setForceReset] = useState(true);

  const [emailTaken, setEmailTaken] = useState<boolean | null>(null);
  const [usernameTaken, setUsernameTaken] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  const [generatedPassword, setGeneratedPassword] = useState<string | null>(
    null,
  );
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdUser, setCreatedUser] = useState<{
    usuario: string;
    senha: string;
    nome: string;
  } | null>(null);
  const [biSubcategories, setBiSubcategories] = useState<string[]>([]);

  const allSectors = useMemo(() => sectors.map((s) => s.title), []);
  const biSector = useMemo(() => sectors.find((s) => s.slug === "bi"), []);
  const isBiSelected = selSectors.some((s) => isSectorMatch(s, "Portal de BI"));

  useEffect(() => {
    loadBISubcategories().then(setBiSubcategories);
  }, []);

  const generateUsername = () => {
    const base = (first + "." + last).trim().toLowerCase().replace(/\s+/g, ".");
    const safe = base || email.split("@")[0] || "usuario";
    setUsername(safe.normalize("NFD").replace(/[^\w.]+/g, ""));
  };

  const toggleSector = (name: string) => {
    // Store the original sector title name
    setSelSectors((prev) => {
      const isCurrentlySelected = prev.some((s) => isSectorMatch(s, name));
      if (isCurrentlySelected) {
        // Remove: filter out all sectors that match this name (normalized)
        return prev.filter((s) => !isSectorMatch(s, name));
      } else {
        // Add: add the correct canonical name
        return [...prev, name];
      }
    });
    if (
      isSectorMatch(name, "Portal de BI") &&
      !selSectors.some((s) => isSectorMatch(s, "Portal de BI"))
    ) {
      setSelBiSubcategories("");
    }
  };

  const setBiSubcategory = (subcategory: string) => {
    setSelBiSubcategories(subcategory);
  };

  const checkAvailability = async (
    type: "email" | "username",
    value: string,
  ) => {
    if (!value) return;
    try {
      setChecking(true);
      const q =
        type === "email"
          ? `email=${encodeURIComponent(value)}`
          : `username=${encodeURIComponent(value)}`;
      const res = await fetch(`${API_URL}/api/usuarios/check-availability?${q}`);
      if (!res.ok) return;
      const data = await res.json();
      if (type === "email") setEmailTaken(!!data.email_exists);
      else setUsernameTaken(!!data.usuario_exists);
    } finally {
      setChecking(false);
    }
  };

  const strengthScore = (
    pwd: string | null,
  ): { score: number; label: string; color: string } => {
    if (!pwd) return { score: 0, label: "", color: "bg-muted" };
    let score = 0;
    const hasLower = /[a-z]/.test(pwd);
    const hasUpper = /[A-Z]/.test(pwd);
    const hasDigit = /\d/.test(pwd);
    if (pwd.length >= 6) score += 1;
    if (hasLower) score += 1;
    if (hasUpper) score += 1;
    if (hasDigit) score += 1;
    const label = score <= 2 ? "Fraca" : score === 3 ? "Média" : "Forte";
    const color =
      score <= 2
        ? "bg-red-500"
        : score === 3
          ? "bg-yellow-500"
          : "bg-green-600";
    return { score, label, color };
  };

  const fetchPassword = async () => {
    const res = await fetch(`${API_URL}/api/usuarios/generate-password`);
    if (!res.ok) throw new Error("Falha ao gerar senha");
    const data = await res.json();
    setGeneratedPassword(data.senha);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    await checkAvailability("email", email);
    await checkAvailability("username", username);
    if (emailTaken || usernameTaken) {
      alert("E-mail ou usuário já cadastrado.");
      return;
    }
    if (!generatedPassword) {
      alert("Clique em 'Gerar senha' antes de salvar.");
      return;
    }

    // Validação: se tem setor BI, deve ter selecionado um dashboard
    const hasBiSector = selSectors.some((s) =>
      isSectorMatch(s, "Portal de BI"),
    );
    if (hasBiSector && !selBiSubcategories) {
      alert(
        "⚠️ Você selecionou o setor Portal de BI mas não escolheu um dashboard. Por favor, selecione um dashboard ou desmarque o setor BI.",
      );
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/usuarios`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: first,
          sobrenome: last,
          usuario: username,
          email,
          senha: generatedPassword,
          nivel_acesso: level,
          setores: selSectors.length ? selSectors : null,
          bi_subcategories: selBiSubcategories ? [selBiSubcategories] : [],
          alterar_senha_primeiro_acesso: forceReset,
        }),
      });
      if (!res.ok) {
        const t = await res.json().catch(() => ({}) as any);
        const detail =
          (t && (t.detail || t.message)) || "Falha ao criar usuário";
        throw new Error(detail);
      }
      const created = await res.json();
      setCreatedUser({
        usuario: created.usuario,
        senha: created.senha,
        nome: `${created.nome} ${created.sobrenome}`,
      });
      setShowSuccess(true);
      // Notify other parts of the UI that users changed
      window.dispatchEvent(new CustomEvent("users:changed"));

      setFirst("");
      setLast("");
      setEmail("");
      setUsername("");
      setLevel("Funcionário");
      setSelSectors([]);
      setSelBiSubcategories("");
      setForceReset(true);
      setEmailTaken(null);
      setUsernameTaken(null);
      setGeneratedPassword(null);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Não foi possível criar o usuário.");
    }
  };

  return (
    <div className="card-surface rounded-xl p-4 sm:p-6">
      <div className="text-xl font-semibold mb-2">Formulário de cadastro</div>
      <form onSubmit={submit} className="grid gap-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="first">Nome</Label>
            <Input
              id="first"
              placeholder="Digite o nome"
              value={first}
              onChange={(e) => setFirst(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="last">Sobrenome</Label>
            <Input
              id="last"
              placeholder="Digite o sobrenome"
              value={last}
              onChange={(e) => setLast(e.target.value)}
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="Digite o e-mail"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailTaken(null);
              }}
              onBlur={() => checkAvailability("email", email)}
            />
            {emailTaken && (
              <div className="text-xs text-destructive">
                E-mail já cadastrado
              </div>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="username">Nome de usuário</Label>
            <div className="flex gap-2">
              <Input
                id="username"
                placeholder="Digite o nome de usuário"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setUsernameTaken(null);
                }}
                onBlur={() => checkAvailability("username", username)}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={generateUsername}
              >
                Gerar
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              Digite manualmente ou clique no botão para gerar automaticamente
            </div>
            {usernameTaken && (
              <div className="text-xs text-destructive">
                Usuário já cadastrado
              </div>
            )}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Nível de acesso</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um nível" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Coordenador">Coordenador</SelectItem>
                <SelectItem value="Gestor">Gestor</SelectItem>
                <SelectItem value="Funcionário">Funcionário</SelectItem>
                <SelectItem value="Gerente">Gerente</SelectItem>
                <SelectItem value="Gerente regional">
                  Gerente regional
                </SelectItem>
                <SelectItem value="Agente de suporte">
                  Agente de suporte
                </SelectItem>
                <SelectItem value="Administrador">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Setor(es)</Label>
            <div className="rounded-md border border-border/60 p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {allSectors.map((s) => (
                <label key={s} className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border bg-background"
                    checked={selSectors.some((selected) =>
                      isSectorMatch(selected, s),
                    )}
                    onChange={() => toggleSector(s)}
                  />
                  {s}
                </label>
              ))}
            </div>
            {isBiSelected && biSubcategories.length > 0 && (
              <div className="mt-3">
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  Selecione um dashboard do Portal de bi
                </div>
                <div className="rounded-md border border-border/40 p-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm bg-muted/30">
                  {biSubcategories.map((sub: any) => (
                    <label
                      key={sub.dashboard_id}
                      className="flex items-start gap-3 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="bi-dashboard-create"
                        value={sub.dashboard_id}
                        checked={selBiSubcategories === sub.dashboard_id}
                        onChange={() => setBiSubcategory(sub.dashboard_id)}
                        className="h-4 w-4 rounded-full border-border bg-background"
                      />
                      <div>
                        <div className="font-medium">{sub.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {sub.category_name}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-2">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border"
              checked={forceReset}
              onChange={(e) => setForceReset(e.target.checked)}
            />
            Solicitar alteração de senha no primeiro acesso
          </label>

          <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-3">
            <Button type="button" variant="secondary" onClick={fetchPassword}>
              Gerar senha
            </Button>
            {generatedPassword && (
              <div className="flex-1 flex items-center gap-3">
                <div className="font-mono text-base tracking-widest px-3 py-2 rounded-md bg-muted select-all">
                  {generatedPassword}
                </div>
                {(() => {
                  const s = strengthScore(generatedPassword);
                  const width = Math.min(100, (s.score / 4) * 100);
                  return (
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 rounded bg-muted overflow-hidden">
                        <div
                          className={`${s.color} h-full`}
                          style={{ width: `${width}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {s.label}
                      </span>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="submit"
            disabled={!!emailTaken || !!usernameTaken || checking}
          >
            Salvar
          </Button>
        </div>
      </form>

      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Usuário criado com sucesso</DialogTitle>
            <DialogDescription>
              Guarde as credenciais abaixo com segurança. Elas serão exibidas
              apenas uma vez.
            </DialogDescription>
          </DialogHeader>
          {createdUser && (
            <div className="space-y-3">
              <div className="text-sm">
                Usuário:{" "}
                <span className="font-medium">{createdUser.usuario}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="font-mono text-lg tracking-widest px-3 py-2 rounded-md bg-muted select-all">
                  {createdUser.senha}
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const text = `Usuário: ${createdUser.usuario}\nSenha provisória: ${createdUser.senha}\n\nInstruções: acesse o sistema com estas credenciais e altere sua senha no primeiro acesso.`;
                    navigator.clipboard?.writeText(text);
                  }}
                  className="inline-flex items-center gap-2"
                >
                  <Copy className="h-4 w-4" /> Copiar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                No primeiro acesso, será solicitado que a senha seja alterada.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function Bloqueios() {
  type ApiUser = {
    id: number;
    nome: string;
    sobrenome: string;
    usuario: string;
    email: string;
    nivel_acesso: string;
    setor: string | null;
    setores?: string[] | null;
    bloqueado?: boolean;
  };
  const [blocked, setBlocked] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch(`${API_URL}/api/usuarios/blocked`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("fail"))))
      .then((data: ApiUser[]) => setBlocked(Array.isArray(data) ? data : []))
      .catch(() => setBlocked([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const onChanged = () => load();
    window.addEventListener("users:changed", onChanged as EventListener);
    return () =>
      window.removeEventListener("users:changed", onChanged as EventListener);
  }, []);

  const unblock = async (id: number) => {
    const res = await fetch(`${API_URL}/api/usuarios/${id}/unblock`, { method: "POST" });
    if (res.ok) {
      // notify other parts of the UI
      window.dispatchEvent(new CustomEvent("users:changed"));
      load();
    }
  };

  return (
    <div className="space-y-3">
      <div className="card-surface rounded-xl p-4">
        <div className="font-semibold mb-2">Usuários bloqueados</div>
        {loading && (
          <div className="text-sm text-muted-foreground">Carregando...</div>
        )}
        {!loading && blocked.length === 0 && (
          <div className="text-sm text-muted-foreground">Nenhum bloqueio.</div>
        )}
      </div>

      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {blocked.map((u) => (
          <div
            key={u.id}
            className="rounded-xl border border-border/60 bg-card overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-border/60 bg-muted/30 flex items-center justify-between">
              <div className="font-semibold">
                {u.nome} {u.sobrenome}
              </div>
              <span className="text-xs rounded-full px-2 py-0.5 bg-secondary">
                {u.nivel_acesso}
              </span>
            </div>
            <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div className="text-muted-foreground">Usuário</div>
              <div className="text-right">{u.usuario}</div>
              <div className="text-muted-foreground">E-mail</div>
              <div className="text-right">{u.email}</div>
            </div>
            <div className="px-4 pb-4 flex gap-2 justify-end">
              <Button type="button" onClick={() => unblock(u.id)}>
                Desbloquear
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Permissoes() {
  type ApiUser = {
    id: number;
    nome: string;
    sobrenome: string;
    usuario: string;
    email: string;
    nivel_acesso: string;
    setor: string | null;
    setores?: string[] | null;
    bloqueado?: boolean;
  };
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<ApiUser | null>(null);
  const [pwdDialog, setPwdDialog] = useState<{
    user: ApiUser | null;
    pwd: string | null;
  }>({ user: null, pwd: null });

  const [editNome, setEditNome] = useState("");
  const [editSobrenome, setEditSobrenome] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editUsuario, setEditUsuario] = useState("");
  const [editNivel, setEditNivel] = useState("Funcionário");
  const [editSetores, setEditSetores] = useState<string[]>([]);
  const [editBiSubcategories, setEditBiSubcategories] = useState<string[]>([]);
  const [editForceReset, setEditForceReset] = useState<boolean>(false);
  const [biSubcategories, setBiSubcategories] = useState<string[]>([]);

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [permSearch, setPermSearch] = useState("");
  const [visibleUsers, setVisibleUsers] = useState(9);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const usersContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreUsersRef = useRef<HTMLDivElement>(null);

  const allSectors = useMemo(() => sectors.map((s) => s.title), []);
  const biSector = useMemo(() => sectors.find((s) => s.slug === "bi"), []);
  const filteredUsers = useMemo(() => {
    const q = permSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      `${u.nome} ${u.sobrenome} ${u.email} ${u.usuario}`.toLowerCase().includes(q)
    );
  }, [users, permSearch]);
  const isEditBiSelected = editSetores.some((s) =>
    isSectorMatch(s, "Portal de BI"),
  );

  const toggleEditSector = (name: string) => {
    // Store the original sector title name
    setEditSetores((prev) => {
      const isCurrentlySelected = prev.some((s) => isSectorMatch(s, name));
      if (isCurrentlySelected) {
        // Remove: filter out all sectors that match this name (normalized)
        const newSetores = prev.filter((s) => !isSectorMatch(s, name));
        console.log(
          "[CHECKBOX] ❌ Desmarcado:",
          name,
          "| Setores agora:",
          newSetores,
        );
        return newSetores;
      } else {
        // Add: add the correct canonical name
        const newSetores = [...prev, name];
        console.log(
          "[CHECKBOX] ✅ Marcado:",
          name,
          "| Setores agora:",
          newSetores,
        );
        return newSetores;
      }
    });
    if (
      isSectorMatch(name, "Portal de BI") &&
      !editSetores.some((s) => isSectorMatch(s, "Portal de BI"))
    ) {
      setEditBiSubcategories([]);
    }
  };

  const toggleEditBiSubcategory = (subcategory: string) => {
    setEditBiSubcategories((prev) =>
      prev.includes(subcategory)
        ? prev.filter((s) => s !== subcategory)
        : [...prev, subcategory],
    );
  };

  const load = () => {
    setLoading(true);
    console.log("[ADMIN] 📋 Recarregando lista de usuários...");
    fetch(`${API_URL}/api/usuarios`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("fail"))))
      .then((data: ApiUser[]) => {
        if (Array.isArray(data)) {
          console.log(
            "[ADMIN] ✅ Lista carregada com",
            data.length,
            "usuários",
          );
          // Log the setores for the first user with permissions (for debugging)
          const usersWithSetores = data.filter(
            (u) => u.setores && u.setores.length > 0,
          );
          if (usersWithSetores.length > 0) {
            console.log(
              "[ADMIN] ℹ️  Exemplo de usuário com setores:",
              usersWithSetores[0],
            );
          }
          setUsers(data.filter((u) => !u.bloqueado));
        }
      })
      .catch((err) => {
        console.error("[ADMIN] ❌ Erro ao carregar usuários:", err);
        setUsers([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBISubcategories().then(setBiSubcategories);
  }, []);

  useEffect(() => {
    load();
    const onChanged = () => load();
    window.addEventListener("users:changed", onChanged as EventListener);
    return () =>
      window.removeEventListener("users:changed", onChanged as EventListener);
  }, []);

  useEffect(() => {
    const sentinel = loadMoreUsersRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setUsers((currentUsers) => {
            setVisibleUsers((currentVisible) => {
              if (currentVisible < currentUsers.length) {
                setIsLoadingMore(true);
                setTimeout(() => {
                  setVisibleUsers((prev) => Math.min(prev + 9, currentUsers.length));
                  setIsLoadingMore(false);
                }, 200);
              }
              return currentVisible;
            });
            return currentUsers;
          });
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  });

  useEffect(() => {
    setVisibleUsers(9);
    setIsLoadingMore(false);
  }, [viewMode]);

  const openEdit = async (u: ApiUser) => {
    // Fetch fresh user data to ensure we have the latest permissions from database
    try {
      console.log(
        "[MODAL] 🔄 Abrindo edição - buscando dados atualizados do usuário ID:",
        u.id,
        "Usuario:",
        u.usuario,
      );
      const res = await fetch(`${API_URL}/api/usuarios/${u.id}`);
      console.log("[MODAL] 📡 Resposta da API - Status:", res.status);

      if (res.ok) {
        const freshUser = await res.json();
        console.log("[MODAL] ✅ Dados atualizados recebidos do servidor");
        console.log("[MODAL] 📊 Dados do usuario:", {
          id: freshUser.id,
          usuario: freshUser.usuario,
          setores: freshUser.setores,
          setor: freshUser.setor,
          bi_subcategories: freshUser.bi_subcategories,
        });

        setEditing(freshUser);
        setEditNome(freshUser.nome);
        setEditSobrenome(freshUser.sobrenome);
        setEditEmail(freshUser.email);
        setEditUsuario(freshUser.usuario);
        setEditNivel(freshUser.nivel_acesso);

        // Backend now returns setores with canonical titles (e.g., "Portal de TI")
        // Just use them directly
        if (
          freshUser.setores &&
          Array.isArray(freshUser.setores) &&
          freshUser.setores.length > 0
        ) {
          console.log(
            "[MODAL] ✅ Permissões ENCONTRADAS no servidor:",
            freshUser.setores,
          );
          setEditSetores(freshUser.setores.map((x: string) => String(x)));
        } else if (freshUser.setor) {
          console.log(
            "[MODAL] ⚠️  Usando setor único do servidor:",
            freshUser.setor,
          );
          setEditSetores([freshUser.setor]);
        } else {
          console.log(
            "[MODAL] ⚠️  NENHUMA PERMISSÃO NO SERVIDOR - Array vazio",
          );
          setEditSetores([]);
        }

        setEditBiSubcategories(freshUser.bi_subcategories || []);
        setEditForceReset(false);
        return;
      } else {
        console.error("[MODAL] ❌ Erro na resposta - Status:", res.status);
      }
    } catch (err) {
      console.error("[MODAL] ❌ Erro ao buscar dados atualizados:", err);
    }

    // Fallback: use data already in memory if fetch fails
    console.log("[MODAL] ⚠️  Usando dados em memória como fallback");
    setEditing(u);
    setEditNome(u.nome);
    setEditSobrenome(u.sobrenome);
    setEditEmail(u.email);
    setEditUsuario(u.usuario);
    setEditNivel(u.nivel_acesso);

    if (u.setores && Array.isArray(u.setores) && u.setores.length > 0) {
      console.log("[MODAL] Permissões em memória:", u.setores);
      setEditSetores(u.setores.map((x) => String(x)));
    } else if (u.setor) {
      console.log("[MODAL] Setor em memória:", u.setor);
      setEditSetores([u.setor]);
    } else {
      console.log("[MODAL] Nenhuma permissão em memória");
      setEditSetores([]);
    }

    setEditBiSubcategories((u as any).bi_subcategories || []);
    setEditForceReset(false);
  };

  const saveEdit = async () => {
    if (!editing) return;

    // Validação: se tem setor BI, deve ter pelo menos um dashboard selecionado
    const hasBiSector = editSetores.some((s) =>
      isSectorMatch(s, "Portal de BI"),
    );
    if (
      hasBiSector &&
      (!editBiSubcategories || editBiSubcategories.length === 0)
    ) {
      alert(
        "⚠️ Você selecionou o setor Portal de BI mas não escolheu nenhum dashboard. Por favor, selecione pelo menos um dashboard ou desmarque o setor BI.",
      );
      return;
    }

    const payload = {
      nome: editNome,
      sobrenome: editSobrenome,
      email: editEmail,
      usuario: editUsuario,
      nivel_acesso: editNivel,
      setores: editSetores,
      bi_subcategories: editBiSubcategories,
      alterar_senha_primeiro_acesso: editForceReset,
    };

    console.log(
      "[ADMIN] 📝 Salvando usuário ID",
      editing.id,
      "Usuario:",
      editing.usuario,
    );
    console.log("[ADMIN] 📝 Setores a salvar:", editSetores);
    console.log(
      "[ADMIN] 📝 Payload completo:",
      JSON.stringify(payload, null, 2),
    );

    const res = await fetch(`${API_URL}/api/usuarios/${editing.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    console.log("[ADMIN] 📡 Response status:", res.status);

    if (res.ok) {
      const responseData = await res.json();
      console.log("[ADMIN] ✅ User updated successfully");
      console.log(
        "[ADMIN] ✅ Setores retornados do servidor:",
        responseData.setores,
      );
      console.log("[ADMIN] ✅ Setor único retornado:", responseData.setor);

      // Verify that setores were actually saved
      if (!responseData.setores || responseData.setores.length === 0) {
        console.error(
          "[ADMIN] ⚠️  PROBLEMA DETECTADO: Servidor retornou setores vazio!",
        );
        console.error(
          "[ADMIN] Payload que foi enviado:",
          JSON.stringify(payload, null, 2),
        );
      }

      console.log(
        "[ADMIN] ✅ Full response:",
        JSON.stringify(responseData, null, 2),
      );
      setEditing(null);
      // Atualiza o usuário na lista localmente sem recarregar tudo
      setUsers((prev) => prev.map((u) => u.id === responseData.id ? { ...u, ...responseData } : u));

      // Dispatch events IMMEDIATELY - don't wait
      console.log("[ADMIN] 🔔 Dispatching events for user", editing.id);

      // Event 1: Notify all parts that users changed
      window.dispatchEvent(new CustomEvent("users:changed"));

      // Event 2: Tell useAuth to refresh immediately (this triggers API call)
      window.dispatchEvent(new CustomEvent("auth:refresh"));

      // Event 3: More specific event with updated user info (for future use)
      window.dispatchEvent(
        new CustomEvent("user:updated", {
          detail: { user_id: editing.id, type: "permissions_changed" },
        }),
      );

      console.log("[ADMIN] ✓ All events dispatched for user", editing.id);
    } else {
      const t = await res.json().catch(() => ({}) as any);
      console.error("[ADMIN] Save failed with status", res.status, "error:", t);
      alert((t && (t.detail || t.message)) || "Falha ao salvar");
    }
  };

  const regeneratePwd = async (u: ApiUser) => {
    const res = await fetch(`${API_URL}/api/usuarios/${u.id}/generate-password`, {
      method: "POST",
    });
    if (!res.ok) {
      alert("Falha ao gerar senha");
      return;
    }
    const data = await res.json();
    setPwdDialog({ user: u, pwd: data.senha });
    // Notify user list that user was updated (alterar_senha_primeiro_acesso set on server)
    window.dispatchEvent(new CustomEvent("users:changed"));
  };

  const blockUser = async (u: ApiUser) => {
    const res = await fetch(`${API_URL}/api/usuarios/${u.id}/block`, { method: "POST" });
    if (res.ok) {
      // remove locally and notify blocked list
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      window.dispatchEvent(new CustomEvent("users:changed"));
    }
  };

  const deleteUser = async (u: ApiUser) => {
    if (!confirm(`Excluir o usuário ${u.nome}?`)) return;
    const res = await fetch(`${API_URL}/api/usuarios/${u.id}`, { method: "DELETE" });
    if (res.ok) {
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      window.dispatchEvent(new CustomEvent("users:changed"));
    }
  };

  // Helper: gera cor de avatar baseada no nome
  const avatarColor = (name: string) => {
    const colors = [
      "from-violet-500 to-purple-600",
      "from-blue-500 to-cyan-600",
      "from-emerald-500 to-teal-600",
      "from-orange-500 to-amber-600",
      "from-rose-500 to-pink-600",
      "from-indigo-500 to-blue-600",
      "from-fuchsia-500 to-violet-600",
      "from-cyan-500 to-sky-600",
    ];
    const idx = name.charCodeAt(0) % colors.length;
    return colors[idx];
  };

  // Helper: cor badge de nível de acesso
  const nivelBadgeStyle = (nivel: string) => {
    const n = nivel?.toLowerCase() || "";
    if (n === "administrador") return "bg-red-500/15 text-red-400 border-red-500/20";
    if (n === "gerente" || n === "gerente regional") return "bg-amber-500/15 text-amber-400 border-amber-500/20";
    if (n === "gestor" || n === "coordenador") return "bg-blue-500/15 text-blue-400 border-blue-500/20";
    if (n === "agente de suporte") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
    return "bg-slate-500/15 text-slate-400 border-slate-500/20";
  };

  // Helper: iniciais do avatar
  const getInitials = (nome: string, sobrenome: string) => {
    const a = (nome || "").trim()[0] || "";
    const b = (sobrenome || "").trim()[0] || "";
    return (a + b).toUpperCase() || "?";
  };

  const UserActionsDropdown = ({ u }: { u: ApiUser }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors">
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => regeneratePwd(u)}>
          <Key className="h-4 w-4 mr-2" /> Nova senha
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => blockUser(u)}>
          <Lock className="h-4 w-4 mr-2" /> Bloquear
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={async () => {
            if (!confirm(`Deslogar o usuário ${u.nome}?`)) return;
            try {
              const res = await fetch(`${API_URL}/api/usuarios/${u.id}/logout`, { method: "POST" });
              if (!res.ok) throw new Error("Falha ao deslogar");
              window.dispatchEvent(new CustomEvent("users:changed"));
              window.dispatchEvent(new CustomEvent("auth:refresh"));
              alert("Usuário deslogado com sucesso.");
            } catch (e: any) {
              alert(e?.message || "Erro ao deslogar usuário");
            }
          }}
        >
          <LogOut className="h-4 w-4 mr-2" /> Deslogar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => deleteUser(u)} className="text-destructive">
          <Trash2 className="h-4 w-4 mr-2" /> Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-1">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Permissões</h2>
          <p className="text-sm text-muted-foreground">
            {users.length > 0 ? `${filteredUsers.length} de ${users.length} usuário${users.length !== 1 ? "s" : ""}` : "Gerencie os usuários cadastrados"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Campo de busca */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              value={permSearch}
              onChange={(e) => { setPermSearch(e.target.value); setVisibleUsers(9); }}
              placeholder="Buscar usuário..."
              className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {permSearch && (
              <button onClick={() => { setPermSearch(""); setVisibleUsers(9); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {/* Toggle view */}
          <div className="flex items-center gap-1.5 bg-muted/50 border border-border/40 rounded-lg p-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === "grid" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Grid3x3 className="h-3.5 w-3.5" /> Grade
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <List className="h-3.5 w-3.5" /> Lista
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div ref={usersContainerRef} className="max-h-[calc(100vh-280px)] overflow-y-auto rounded-xl">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Carregando usuários...</p>
          </div>
        )}

        {!loading && users.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-1">
              <Edit className="h-5 w-5 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium">Nenhum usuário encontrado</p>
            <p className="text-xs text-muted-foreground">Crie um novo usuário na aba "Criar usuário"</p>
          </div>
        )}

        {/* GRID VIEW */}
        {!loading && filteredUsers.length > 0 && viewMode === "grid" && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredUsers.slice(0, visibleUsers).map((u) => {
              const initials = getInitials(u.nome, u.sobrenome);
              const gradient = avatarColor(u.nome);
              const setorLabel = matchSectorTitle((u.setores && u.setores[0]) || u.setor);
              const extraSetores = (u.setores?.length || 0) - 1;
              return (
                <div
                  key={u.id}
                  className="group relative rounded-2xl border border-border/50 bg-card overflow-hidden hover:border-primary/30 hover:shadow-lg hover:shadow-black/10 transition-all duration-200"
                >
                  {/* Top accent line */}
                  <div className={`h-0.5 w-full bg-gradient-to-r ${gradient} opacity-60`} />

                  <div className="p-5">
                    {/* Header: avatar + role + menu */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-md`}>
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm leading-tight truncate max-w-[140px]">
                            {u.nome} {u.sobrenome}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[140px]">
                            @{u.usuario}
                          </p>
                        </div>
                      </div>
                      <UserActionsDropdown u={u} />
                    </div>

                    {/* Info rows */}
                    <div className="space-y-2.5 mb-4">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground w-4 flex-shrink-0">✉</span>
                        <span className="truncate text-foreground/80">{u.email}</span>
                      </div>
                      {setorLabel && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
                            {setorLabel}
                          </span>
                          {extraSetores > 0 && (
                            <span className="inline-flex items-center rounded-md bg-muted/60 border border-border/40 px-2 py-0.5 text-xs text-muted-foreground">
                              +{extraSetores} setor{extraSetores > 1 ? "es" : ""}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Footer: role badge + edit */}
                    <div className="flex items-center justify-between pt-3 border-t border-border/40">
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${nivelBadgeStyle(u.nivel_acesso)}`}>
                        {u.nivel_acesso}
                      </span>
                      <button
                        onClick={() => openEdit(u)}
                        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors px-2.5 py-1.5 rounded-lg hover:bg-primary/10"
                      >
                        <Edit className="h-3.5 w-3.5" /> Editar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* LIST VIEW */}
        {!loading && filteredUsers.length > 0 && viewMode === "list" && (
          <div className="space-y-1.5">
            {filteredUsers.slice(0, visibleUsers).map((u) => {
              const initials = getInitials(u.nome, u.sobrenome);
              const gradient = avatarColor(u.nome);
              const setorLabel = matchSectorTitle((u.setores && u.setores[0]) || u.setor);
              return (
                <div
                  key={u.id}
                  className="group flex items-center gap-4 px-4 py-3.5 rounded-xl border border-border/40 bg-card hover:border-primary/25 hover:bg-card/80 transition-all duration-150"
                >
                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold text-xs flex-shrink-0`}>
                    {initials}
                  </div>

                  {/* Name + username */}
                  <div className="min-w-0 w-40 flex-shrink-0">
                    <p className="font-medium text-sm truncate">{u.nome} {u.sobrenome}</p>
                    <p className="text-xs text-muted-foreground truncate">@{u.usuario}</p>
                  </div>

                  {/* Email */}
                  <div className="hidden md:block flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>

                  {/* Setor */}
                  <div className="hidden lg:flex items-center gap-1.5 flex-shrink-0">
                    {setorLabel ? (
                      <span className="inline-flex items-center rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
                        {setorLabel}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/40">—</span>
                    )}
                  </div>

                  {/* Role badge */}
                  <div className="flex-shrink-0">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${nivelBadgeStyle(u.nivel_acesso)}`}>
                      {u.nivel_acesso}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEdit(u)}
                      className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors px-2.5 py-1.5 rounded-lg hover:bg-primary/10"
                    >
                      <Edit className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Editar</span>
                    </button>
                    <UserActionsDropdown u={u} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Infinite scroll sentinel */}
        {!loading && users.length > 0 && (
          <div ref={loadMoreUsersRef} className="flex justify-center py-6 mt-2">
            {isLoadingMore && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                Carregando mais...
              </div>
            )}
            {!isLoadingMore && visibleUsers >= filteredUsers.length && filteredUsers.length > 9 && (
              <p className="text-xs text-muted-foreground/50">
                Todos os {users.length} usuários exibidos
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── EDIT MODAL ─────────────────────────────────────────── */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="w-full max-w-2xl p-0 gap-0 flex flex-col max-h-[95vh] sm:max-h-[90vh]">
          {/* Modal header — fixo, cor laranja do layout */}
          {editing && (
            <div className="relative bg-gradient-to-br from-orange-500 to-amber-600 p-6 pb-10 flex-shrink-0">
              {/* Background pattern */}
              <div className="absolute inset-0 opacity-10"
                style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "24px 24px" }}
              />
              <div className="relative flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-bold text-2xl border border-white/30 shadow-xl">
                  {getInitials(editNome || editing.nome, editSobrenome || editing.sobrenome)}
                </div>
                <div>
                  <DialogTitle className="text-white text-xl font-bold leading-tight">
                    {editing.nome} {editing.sobrenome}
                  </DialogTitle>
                  <p className="text-white/75 text-sm mt-0.5">@{editing.usuario}</p>
                </div>
              </div>
            </div>
          )}

          {/* Modal body — scrollável */}
          <div className="overflow-y-auto flex-1 px-6 pt-0 pb-6 -mt-6 relative">
            <div className="bg-card rounded-2xl border border-border/50 shadow-lg overflow-hidden">

              {/* Seção: Dados pessoais */}
              <div className="px-5 py-4 border-b border-border/40">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">Dados pessoais</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Nome</Label>
                    <Input value={editNome} onChange={(e) => setEditNome(e.target.value)} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Sobrenome</Label>
                    <Input value={editSobrenome} onChange={(e) => setEditSobrenome(e.target.value)} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">E-mail</Label>
                    <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Usuário</Label>
                    <Input value={editUsuario} onChange={(e) => setEditUsuario(e.target.value)} className="h-9" />
                  </div>
                </div>
              </div>

              {/* Seção: Acesso */}
              <div className="px-5 py-4 border-b border-border/40">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">Nível de acesso</p>
                <Select value={editNivel} onValueChange={setEditNivel}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione um nível" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Coordenador">Coordenador</SelectItem>
                    <SelectItem value="Gestor">Gestor</SelectItem>
                    <SelectItem value="Funcionário">Funcionário</SelectItem>
                    <SelectItem value="Gerente">Gerente</SelectItem>
                    <SelectItem value="Gerente regional">Gerente regional</SelectItem>
                    <SelectItem value="Agente de suporte">Agente de suporte</SelectItem>
                    <SelectItem value="Administrador">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Seção: Portais */}
              <div className="px-5 py-4 border-b border-border/40">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Portais / Setores</p>
                  <span className="text-xs text-muted-foreground bg-muted/50 border border-border/40 rounded-full px-2 py-0.5">
                    {editSetores.length} selecionado{editSetores.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {allSectors.map((s) => {
                    const checked = editSetores.some((sel) => isSectorMatch(sel, s));
                    return (
                      <label
                        key={s}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-all text-sm ${
                          checked
                            ? "border-primary/40 bg-primary/8 text-foreground"
                            : "border-border/40 hover:border-border/70 hover:bg-muted/30 text-muted-foreground"
                        }`}
                      >
                        <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all flex-shrink-0 ${
                          checked ? "bg-primary border-primary" : "border-border/60 bg-background"
                        }`}>
                          {checked && (
                            <svg className="w-2.5 h-2.5 text-primary-foreground" fill="none" viewBox="0 0 12 12">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={() => toggleEditSector(s)}
                        />
                        <span className="truncate font-medium">{s}</span>
                      </label>
                    );
                  })}
                </div>

                {/* Dashboards BI */}
                {isEditBiSelected && biSubcategories.length > 0 && (
                  <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">
                      Dashboards do Portal de BI
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {biSubcategories.map((sub: any) => {
                        const biChecked = editBiSubcategories.includes(sub.dashboard_id);
                        return (
                          <label key={sub.dashboard_id} className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-all text-sm ${
                            biChecked ? "border-primary/40 bg-primary/10" : "border-border/40 hover:border-border/70 hover:bg-muted/30"
                          }`}>
                            <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all flex-shrink-0 mt-0.5 ${
                              biChecked ? "bg-primary border-primary" : "border-border/60 bg-background"
                            }`}>
                              {biChecked && (
                                <svg className="w-2.5 h-2.5 text-primary-foreground" fill="none" viewBox="0 0 12 12">
                                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </div>
                            <input type="checkbox" className="sr-only" checked={biChecked} onChange={() => toggleEditBiSubcategory(sub.dashboard_id)} />
                            <div>
                              <p className="font-medium text-xs leading-tight">{sub.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{sub.category_name}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Seção: Segurança + ações */}
              <div className="px-5 py-4">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div
                    onClick={() => setEditForceReset(!editForceReset)}
                    className={`relative w-9 h-5 rounded-full border transition-all flex-shrink-0 ${
                      editForceReset ? "bg-primary border-primary" : "bg-muted border-border/60"
                    }`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${
                      editForceReset ? "left-4" : "left-0.5"
                    }`} />
                  </div>
                  <input type="checkbox" className="sr-only" checked={editForceReset} onChange={(e) => setEditForceReset(e.target.checked)} />
                  <div>
                    <p className="text-sm font-medium">Forçar redefinição de senha</p>
                    <p className="text-xs text-muted-foreground">O usuário deverá alterar a senha no próximo acesso</p>
                  </div>
                </label>

                <div className="flex gap-2 mt-5">
                  <Button type="button" variant="secondary" onClick={() => setEditing(null)} className="flex-1">
                    Cancelar
                  </Button>
                  <Button type="button" onClick={saveEdit} className="flex-1">
                    Salvar alterações
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── PWD DIALOG ─────────────────────────────────────────── */}
      <Dialog open={!!pwdDialog.user} onOpenChange={(o) => !o && setPwdDialog({ user: null, pwd: null })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova senha gerada</DialogTitle>
            <DialogDescription>Guarde com segurança — exibida apenas uma vez.</DialogDescription>
          </DialogHeader>
          {pwdDialog.pwd && (
            <div className="mt-2">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/50 border border-border/40">
                <code className="font-mono text-lg tracking-widest flex-1 select-all text-foreground">
                  {pwdDialog.pwd}
                </code>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => navigator.clipboard?.writeText(pwdDialog.pwd || "")}
                  className="flex-shrink-0"
                >
                  <Copy className="h-4 w-4 mr-1.5" /> Copiar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function Agentes() {
  const agentes = usuariosMock.filter((u) => u.perfil === "Agente");
  return (
    <div className="card-surface rounded-xl p-4 text-sm">
      <div className="font-semibold mb-2">Agentes de Suporte</div>
      <ul className="space-y-2">
        {agentes.map((a) => (
          <li key={a.id}>
            {a.nome} — {a.email}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Grupo {
  id: number;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  data_criacao: string | null;
  total_membros: number;
}

interface Membro {
  id: number;
  user_id: number;
  nome: string;
  sobrenome: string;
  email: string;
  usuario: string;
  nivel_acesso: string;
  adicionado_em: string | null;
}

interface ApiUser {
  id: number;
  nome: string;
  sobrenome: string;
  usuario: string;
  email: string;
  nivel_acesso: string;
}

// ── Helpers visuais ───────────────────────────────────────────────────────────

const GRUPO_GRADIENTS = [
  "from-violet-500 to-purple-600",
  "from-blue-500 to-cyan-600",
  "from-emerald-500 to-teal-600",
  "from-orange-500 to-amber-600",
  "from-rose-500 to-pink-600",
  "from-indigo-500 to-blue-600",
  "from-fuchsia-500 to-violet-600",
  "from-cyan-500 to-sky-600",
  "from-lime-500 to-green-600",
  "from-red-500 to-rose-600",
];

function grupoGradient(nome: string) {
  return GRUPO_GRADIENTS[nome.charCodeAt(0) % GRUPO_GRADIENTS.length];
}

function userInitials(nome: string, sobrenome: string) {
  return ((nome?.[0] || "") + (sobrenome?.[0] || "")).toUpperCase() || "?";
}

function nivelColor(nivel: string) {
  const n = nivel?.toLowerCase() || "";
  if (n === "administrador") return "bg-red-500/15 text-red-400 border-red-500/20";
  if (n.includes("gerente")) return "bg-amber-500/15 text-amber-400 border-amber-500/20";
  if (n === "gestor" || n === "coordenador") return "bg-blue-500/15 text-blue-400 border-blue-500/20";
  if (n === "agente de suporte") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
  return "bg-slate-500/15 text-slate-400 border-slate-500/20";
}

// ── Modal: Membros do grupo ───────────────────────────────────────────────────

function MembrosModal({
  grupo,
  onClose,
}: {
  grupo: Grupo;
  onClose: () => void;
}) {
  const [membros, setMembros] = useState<Membro[]>([]);
  const [allUsers, setAllUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const gradient = grupoGradient(grupo.nome);

  const loadMembros = () => {
    apiFetch(`/grupos/${grupo.id}/membros`)
      .then(async (r) => {
        if (!r.ok) {
          const err = await r.text();
          console.error(`[GRUPOS] Erro ao buscar membros (${r.status}):`, err);
          return Promise.reject(new Error(err));
        }
        return r.json();
      })
      .then((data) => {
        console.log(`[GRUPOS] Membros recebidos:`, data);
        Array.isArray(data) && setMembros(data);
      })
      .catch((e) => {
        console.error("[GRUPOS] Falha ao carregar membros:", e);
        setMembros([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadMembros();
    fetch("/api/usuarios")
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => Array.isArray(data) && setAllUsers(data))
      .catch(() => setAllUsers([]));
  }, []);

  const handleRemove = async (userId: number) => {
    if (!confirm("Remover este usuário do grupo?")) return;
    await apiFetch(`/grupos/${grupo.id}/membros/${userId}`, { method: "DELETE" });
    loadMembros();
  };

  const handleAdd = async (userId: number) => {
    setAdding(true);
    try {
      const res = await apiFetch(`/grupos/${grupo.id}/membros`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.detail || "Erro ao adicionar");
        return;
      }
      loadMembros();
      setSearch("");
    } finally {
      setAdding(false);
    }
  };

  const membroIds = new Set(membros.map((m) => m.user_id));
  const filtered = allUsers.filter((u) => {
    if (u.bloqueado) return false;
    if (membroIds.has(u.id)) return false;
    const q = search.toLowerCase();
    return (
      !q ||
      u.nome.toLowerCase().includes(q) ||
      u.sobrenome.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.usuario.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh] overflow-hidden">

        {/* Header colorido */}
        <div className={`relative bg-gradient-to-br ${gradient} p-6 flex-shrink-0`}>
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "20px 20px" }}
          />
          <div className="relative flex items-start justify-between">
            <div>
              <h2 className="text-white font-bold text-lg leading-tight">{grupo.nome}</h2>
              {grupo.descricao && (
                <p className="text-white/70 text-xs mt-1">{grupo.descricao}</p>
              )}
              <p className="text-white/60 text-xs mt-2">
                {membros.length} membro{membros.length !== 1 ? "s" : ""}
              </p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors flex-shrink-0">
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* Lista de membros */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : membros.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              Nenhum membro neste grupo ainda.
            </div>
          ) : (
            membros.map((m) => {
              const grad = grupoGradient(m.nome || "?");
              return (
                <div key={m.user_id} className="flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-muted/20 hover:bg-muted/40 transition-colors group">
                  <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${grad} flex items-center justify-center text-white font-bold text-xs flex-shrink-0`}>
                    {userInitials(m.nome, m.sobrenome)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{m.nome} {m.sobrenome}</p>
                    <p className="text-xs text-muted-foreground truncate">@{m.usuario}</p>
                  </div>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium flex-shrink-0 ${nivelColor(m.nivel_acesso)}`}>
                    {m.nivel_acesso}
                  </span>
                  <button
                    onClick={() => handleRemove(m.user_id)}
                    className="p-1.5 rounded-lg hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                    title="Remover do grupo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Painel de adicionar */}
        {showAddPanel && (
          <div className="border-t border-border/40 p-4 space-y-3 flex-shrink-0 bg-muted/10">
            <input
              autoFocus
              className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Buscar usuário por nome, e-mail ou @usuário..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="max-h-44 overflow-y-auto space-y-1.5">
              {filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {search ? "Nenhum usuário encontrado" : "Todos os usuários já estão no grupo"}
                </p>
              ) : (
                filtered.map((u) => {
                  const grad = grupoGradient(u.nome || "?");
                  return (
                    <button
                      key={u.id}
                      onClick={() => handleAdd(u.id)}
                      disabled={adding}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-border/30 hover:border-primary/40 hover:bg-primary/5 transition-all text-left disabled:opacity-50"
                    >
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${grad} flex items-center justify-center text-white font-bold text-xs flex-shrink-0`}>
                        {userInitials(u.nome, u.sobrenome)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{u.nome} {u.sobrenome}</p>
                        <p className="text-xs text-muted-foreground truncate">@{u.usuario}</p>
                      </div>
                      <Plus className="w-4 h-4 text-primary flex-shrink-0" />
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-border/40 p-4 flex gap-2 flex-shrink-0">
          <button
            onClick={() => { setShowAddPanel((v) => !v); setSearch(""); }}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border border-primary/40 text-primary text-sm font-medium hover:bg-primary/5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {showAddPanel ? "Fechar busca" : "Adicionar usuário"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: Criar / Editar grupo ───────────────────────────────────────────────

function GrupoFormModal({
  grupo,
  onClose,
  onSaved,
}: {
  grupo?: Grupo;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!grupo;
  const [nome, setNome] = useState(grupo?.nome || "");
  const [descricao, setDescricao] = useState(grupo?.descricao || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!nome.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = isEdit
        ? await apiFetch(`/grupos/${grupo!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome: nome.trim(), descricao: descricao.trim() || null }),
          })
        : await apiFetch("/grupos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nome: nome.trim(), descricao: descricao.trim() || null }),
          });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || "Erro ao salvar grupo");
      }
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.message || "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  const previewGradient = nome ? grupoGradient(nome) : "from-slate-400 to-slate-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Preview header */}
        <div className={`relative bg-gradient-to-br ${previewGradient} p-6`}>
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)", backgroundSize: "20px 20px" }}
          />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-white/60 text-xs uppercase tracking-widest mb-1">
                {isEdit ? "Editar grupo" : "Novo grupo"}
              </p>
              <h2 className="text-white font-bold text-lg leading-tight">
                {nome || "Nome do grupo"}
              </h2>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Nome do grupo *</label>
            <input
              autoFocus
              className="w-full rounded-lg border border-border/60 bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Ex: Suporte N1, Gestores, TI..."
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Descrição <span className="text-muted-foreground/50">(opcional)</span></label>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-border/60 bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              placeholder="Descreva o propósito deste grupo..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 border border-destructive/20 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} disabled={saving} className="flex-1 py-2.5 rounded-lg border border-border/60 text-sm font-medium hover:bg-muted/40 transition-colors disabled:opacity-50">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving || !nome.trim()} className={`flex-1 py-2.5 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 bg-gradient-to-r ${previewGradient} hover:opacity-90`}>
              {saving ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar grupo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Card do Grupo ─────────────────────────────────────────────────────────────

function GrupoCard({
  grupo,
  onEdit,
  onDelete,
  onOpenMembros,
}: {
  grupo: Grupo;
  onEdit: () => void;
  onDelete: () => void;
  onOpenMembros: () => void;
}) {
  const gradient = grupoGradient(grupo.nome);
  const initials = grupo.nome.slice(0, 2).toUpperCase();

  return (
    <div className="group relative rounded-2xl border border-border/50 bg-card overflow-hidden hover:border-primary/30 hover:shadow-xl hover:shadow-black/10 transition-all duration-200">
      {/* Topo colorido */}
      <div className={`h-1.5 w-full bg-gradient-to-r ${gradient}`} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold text-base shadow-md`}>
              {initials}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm leading-tight truncate max-w-[160px]">{grupo.nome}</h3>
              {grupo.descricao && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[160px]">{grupo.descricao}</p>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors opacity-0 group-hover:opacity-100">
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={onEdit}>
                <Edit2 className="h-4 w-4 mr-2" /> Editar grupo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" /> Excluir grupo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-2 pt-3 border-t border-border/40">
          <div className="flex -space-x-1.5">
            {Array.from({ length: Math.min(grupo.total_membros, 4) }).map((_, i) => (
              <div
                key={i}
                className={`w-6 h-6 rounded-full bg-gradient-to-br ${GRUPO_GRADIENTS[(i + grupo.nome.charCodeAt(0)) % GRUPO_GRADIENTS.length]} border-2 border-card flex items-center justify-center text-white text-[9px] font-bold`}
              >
                {String.fromCharCode(65 + i)}
              </div>
            ))}
            {grupo.total_membros === 0 && (
              <div className="w-6 h-6 rounded-full bg-muted border-2 border-card flex items-center justify-center">
                <Users className="w-3 h-3 text-muted-foreground" />
              </div>
            )}
          </div>
          <span className="text-xs text-muted-foreground flex-1">
            {grupo.total_membros} membro{grupo.total_membros !== 1 ? "s" : ""}
          </span>
          <button
            onClick={onOpenMembros}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-gradient-to-r ${gradient} hover:opacity-90 transition-opacity shadow-sm`}
          >
            <Users className="w-3 h-3" /> Gerenciar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal: Grupos ──────────────────────────────────────────────

export function Grupos() {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editando, setEditando] = useState<Grupo | null>(null);
  const [membrosGrupo, setMembrosGrupo] = useState<Grupo | null>(null);

  const load = () => {
    setLoading(true);
    apiFetch("/grupos")
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => Array.isArray(data) && setGrupos(data))
      .catch(() => setGrupos([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (g: Grupo) => {
    if (!confirm(`Excluir o grupo "${g.nome}"? Todos os membros serão removidos.`)) return;
    await apiFetch(`/grupos/${g.id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-1">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Grupos de Usuários</h2>
          <p className="text-sm text-muted-foreground">
            {grupos.length > 0
              ? `${grupos.length} grupo${grupos.length !== 1 ? "s" : ""} criado${grupos.length !== 1 ? "s" : ""}`
              : "Organize usuários em grupos para facilitar a gestão"}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> Novo grupo
        </button>
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Carregando grupos...</p>
        </div>
      ) : grupos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
            <Users className="w-7 h-7 text-muted-foreground/40" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">Nenhum grupo criado</p>
            <p className="text-xs text-muted-foreground mt-1">Clique em "Novo grupo" para começar</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> Criar primeiro grupo
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {grupos.map((g) => (
            <GrupoCard
              key={g.id}
              grupo={g}
              onEdit={() => setEditando(g)}
              onDelete={() => handleDelete(g)}
              onOpenMembros={() => setMembrosGrupo(g)}
            />
          ))}
        </div>
      )}

      {/* Modais */}
      {showCreate && (
        <GrupoFormModal onClose={() => setShowCreate(false)} onSaved={load} />
      )}
      {editando && (
        <GrupoFormModal grupo={editando} onClose={() => setEditando(null)} onSaved={load} />
      )}
      {membrosGrupo && (
        <MembrosModal grupo={membrosGrupo} onClose={() => { setMembrosGrupo(null); load(); }} />
      )}
    </div>
  );
}

interface Auth0User {
  user_id: string;
  email: string;
  name: string;
  given_name: string;
  family_name: string;
  email_verified: boolean;
  created_at: string;
  last_login: string | null;
}

const PAGE_SIZE = 12;

export function Auth0Usuarios() {
  const [allUsers, setAllUsers] = useState<Auth0User[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const sentinelRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(value);
    }, 400);
  };

  // Reset visible count when search or view changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [debouncedSearch, viewMode]);

  // Fetch users when debounced search changes
  useEffect(() => {
    const loadAuth0Users = async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        if (debouncedSearch) params.append("search", debouncedSearch);
        const response = await fetch(`/api/auth/users?${params}`);
        if (!response.ok) throw new Error("Falha ao carregar usuários do Auth0");
        const data = await response.json();
        setAllUsers(data.users || []);
      } catch (err: any) {
        setError(err.message || "Erro ao carregar usuários");
        console.error("Erro ao carregar usuários do Auth0:", err);
      } finally {
        setLoading(false);
      }
    };
    loadAuth0Users();
  }, [debouncedSearch]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < allUsers.length) {
          setLoadingMore(true);
          setTimeout(() => {
            setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, allUsers.length));
            setLoadingMore(false);
          }, 200);
        }
      },
      { threshold: 0.5 },
    );
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [visibleCount, allUsers.length]);

  const visibleUsers = allUsers.slice(0, visibleCount);

  const formatDate = (dateString: string) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("pt-BR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  // Helpers reutilizados do padrão Permissoes
  const auth0AvatarColor = (name: string) => {
    const colors = [
      "from-violet-500 to-purple-600",
      "from-blue-500 to-cyan-600",
      "from-emerald-500 to-teal-600",
      "from-orange-500 to-amber-600",
      "from-rose-500 to-pink-600",
      "from-indigo-500 to-blue-600",
      "from-fuchsia-500 to-violet-600",
      "from-cyan-500 to-sky-600",
    ];
    return colors[(name || "?").charCodeAt(0) % colors.length];
  };

  const auth0Initials = (user: Auth0User) => {
    const fullName = user.name || `${user.given_name || ""} ${user.family_name || ""}`.trim() || user.email || "?";
    const parts = fullName.trim().split(" ").filter(Boolean);
    const a = parts[0]?.[0] || "";
    const b = parts[1]?.[0] || "";
    return (a + b).toUpperCase() || fullName[0]?.toUpperCase() || "?";
  };

  const auth0DisplayName = (user: Auth0User) =>
    user.name || `${user.given_name || ""} ${user.family_name || ""}`.trim() || user.email || "—";

  return (
    <div className="space-y-4">
      {/* Header bar — igual ao de Permissões */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-1">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Usuários (Auth0)</h2>
          <p className="text-sm text-muted-foreground">
            {allUsers.length > 0
              ? `${allUsers.length} usuário${allUsers.length !== 1 ? "s" : ""} encontrado${allUsers.length !== 1 ? "s" : ""}`
              : "Usuários cadastrados no Auth0"}
          </p>
        </div>
        <div className="flex items-center gap-1.5 bg-muted/50 border border-border/40 rounded-lg p-1">
          <button
            onClick={() => setViewMode("grid")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === "grid" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Grid3x3 className="h-3.5 w-3.5" /> Grade
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <List className="h-3.5 w-3.5" /> Lista
          </button>
        </div>
      </div>

      {/* Search */}
      <Input
        placeholder="Pesquisar por nome ou e-mail..."
        value={searchTerm}
        onChange={(e) => handleSearchChange(e.target.value)}
        className="w-full"
      />

      {/* Content */}
      <div className="max-h-[calc(100vh-280px)] overflow-y-auto rounded-xl">

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Carregando usuários do Auth0...</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-5 text-center">
            <p className="text-sm text-destructive font-medium">{error}</p>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && allUsers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-1">
              <List className="h-5 w-5 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium">Nenhum usuário encontrado</p>
            <p className="text-xs text-muted-foreground">
              {debouncedSearch ? `Sem resultados para "${debouncedSearch}"` : "Nenhum usuário cadastrado no Auth0"}
            </p>
          </div>
        )}

        {/* GRID VIEW */}
        {!loading && !error && visibleUsers.length > 0 && viewMode === "grid" && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleUsers.map((user) => {
              const initials = auth0Initials(user);
              const gradient = auth0AvatarColor(auth0DisplayName(user));
              return (
                <div
                  key={user.user_id}
                  className="group relative rounded-2xl border border-border/50 bg-card overflow-hidden hover:border-primary/30 hover:shadow-lg hover:shadow-black/10 transition-all duration-200"
                >
                  {/* Top accent line */}
                  <div className={`h-0.5 w-full bg-gradient-to-r ${gradient} opacity-60`} />

                  <div className="p-5">
                    {/* Header: avatar + status */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-md`}>
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm leading-tight truncate max-w-[150px]">
                            {auth0DisplayName(user)}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[150px]">
                            {user.email}
                          </p>
                        </div>
                      </div>
                      {/* Verified badge */}
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium flex-shrink-0 ${
                        user.email_verified
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                          : "bg-amber-500/15 text-amber-400 border-amber-500/20"
                      }`}>
                        {user.email_verified ? "✓ Verificado" : "⚠ Pendente"}
                      </span>
                    </div>

                    {/* Info rows */}
                    <div className="space-y-2 pt-3 border-t border-border/40">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Criado em</span>
                        <span className="font-medium">{formatDate(user.created_at)}</span>
                      </div>
                      {user.last_login && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Último acesso</span>
                          <span className="font-medium">{formatDate(user.last_login)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* LIST VIEW */}
        {!loading && !error && visibleUsers.length > 0 && viewMode === "list" && (
          <div className="space-y-1.5">
            {visibleUsers.map((user) => {
              const initials = auth0Initials(user);
              const gradient = auth0AvatarColor(auth0DisplayName(user));
              return (
                <div
                  key={user.user_id}
                  className="group flex items-center gap-4 px-4 py-3.5 rounded-xl border border-border/40 bg-card hover:border-primary/25 hover:bg-card/80 transition-all duration-150"
                >
                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold text-xs flex-shrink-0`}>
                    {initials}
                  </div>

                  {/* Name + email */}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{auth0DisplayName(user)}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>

                  {/* Criado em */}
                  <div className="hidden md:block flex-shrink-0 text-right">
                    <p className="text-xs text-muted-foreground">Criado em</p>
                    <p className="text-xs font-medium">{formatDate(user.created_at)}</p>
                  </div>

                  {/* Último acesso */}
                  {user.last_login && (
                    <div className="hidden lg:block flex-shrink-0 text-right">
                      <p className="text-xs text-muted-foreground">Último acesso</p>
                      <p className="text-xs font-medium">{formatDate(user.last_login)}</p>
                    </div>
                  )}

                  {/* Status badge */}
                  <div className="flex-shrink-0">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                      user.email_verified
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                        : "bg-amber-500/15 text-amber-400 border-amber-500/20"
                    }`}>
                      {user.email_verified ? "✓ Verificado" : "⚠ Pendente"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Infinite scroll sentinel */}
        {!loading && !error && allUsers.length > 0 && (
          <div ref={sentinelRef} className="flex justify-center py-6 mt-2">
            {loadingMore && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                Carregando mais...
              </div>
            )}
            {!loadingMore && visibleCount >= allUsers.length && allUsers.length > PAGE_SIZE && (
              <p className="text-xs text-muted-foreground/50">
                Todos os {allUsers.length} usuários exibidos
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
