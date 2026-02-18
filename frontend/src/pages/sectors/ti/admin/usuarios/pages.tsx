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
  Key,
  Lock,
  LogOut,
  Trash2,
  Grid3x3,
  List,
  MoreVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const [visibleUsers, setVisibleUsers] = useState(9);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const usersContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreUsersRef = useRef<HTMLDivElement>(null);

  const allSectors = useMemo(() => sectors.map((s) => s.title), []);
  const biSector = useMemo(() => sectors.find((s) => s.slug === "bi"), []);
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
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleUsers < users.length) {
          setIsLoadingMore(true);
          setTimeout(() => {
            setVisibleUsers((prev) => Math.min(prev + 9, users.length));
            setIsLoadingMore(false);
          }, 300);
        }
      },
      { threshold: 0.5 },
    );

    if (loadMoreUsersRef.current) {
      observer.observe(loadMoreUsersRef.current);
    }

    return () => observer.disconnect();
  }, [visibleUsers, users.length]);

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
      load();

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

  return (
    <div className="space-y-3">
      <div className="card-surface rounded-xl p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
          <div>
            <div className="font-semibold text-lg">Permissões</div>
            <p className="text-muted-foreground text-sm">
              Liste e gerencie os usuários cadastrados.
            </p>
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
      </div>

      <div
        ref={usersContainerRef}
        className="max-h-[calc(100vh-300px)] overflow-y-auto rounded-lg border border-border/40 p-4"
      >
        {loading && (
          <div className="text-center py-12">
            <div className="text-sm text-muted-foreground">
              Carregando usuários...
            </div>
          </div>
        )}

        {!loading && users.length === 0 && (
          <div className="text-center py-12">
            <div className="text-sm text-muted-foreground">
              Nenhum usuário encontrado.
            </div>
          </div>
        )}

        {!loading && users.length > 0 && viewMode === "grid" && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {users.slice(0, visibleUsers).map((u) => (
              <div
                key={u.id}
                className="card-surface rounded-xl border border-border/40 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="px-5 py-4 border-b border-border/40 bg-gradient-to-r from-primary/5 to-transparent flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm leading-tight">
                      {u.nome} {u.sobrenome}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {u.usuario}
                    </p>
                  </div>
                  <span className="text-xs font-medium rounded-full px-2.5 py-1 bg-primary/10 text-primary whitespace-nowrap ml-2">
                    {u.nivel_acesso}
                  </span>
                </div>

                <div className="px-5 py-4 space-y-3">
                  <div>
                    <div className="text-xs text-muted-foreground font-medium">
                      E-mail
                    </div>
                    <p className="text-sm break-all">{u.email}</p>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground font-medium">
                      Setor
                    </div>
                    <p className="text-sm">
                      {matchSectorTitle(
                        (u.setores && u.setores[0]) || u.setor,
                      ) || "—"}
                    </p>
                  </div>
                </div>

                <div className="px-5 py-3 border-t border-border/40 bg-muted/30 flex gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => openEdit(u)}
                    className="flex-1 inline-flex items-center justify-center gap-2 h-9"
                  >
                    <Edit className="h-4 w-4" />
                    <span className="hidden sm:inline">Editar</span>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-9 w-9 p-0"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => regeneratePwd(u)}>
                        <Key className="h-4 w-4 mr-2" />
                        Nova senha
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => blockUser(u)}>
                        <Lock className="h-4 w-4 mr-2" />
                        Bloquear
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={async () => {
                          if (!confirm(`Deslogar o usuário ${u.nome}?`)) return;
                          try {
                            const res = await fetch(
                              `${API_URL}/api/usuarios/${u.id}/logout`,
                              { method: "POST" },
                            );
                            if (!res.ok) throw new Error("Falha ao deslogar");
                            window.dispatchEvent(
                              new CustomEvent("users:changed"),
                            );
                            window.dispatchEvent(
                              new CustomEvent("auth:refresh"),
                            );
                            alert("Usuário deslogado com sucesso.");
                          } catch (e: any) {
                            alert(e?.message || "Erro ao deslogar usuário");
                          }
                        }}
                      >
                        <LogOut className="h-4 w-4 mr-2" />
                        Deslogar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => deleteUser(u)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && users.length > 0 && viewMode === "list" && (
          <div className="space-y-2">
            {users.slice(0, visibleUsers).map((u) => (
              <div
                key={u.id}
                className="card-surface rounded-lg border border-border/40 overflow-hidden hover:shadow-sm transition-shadow"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm">
                      {u.nome} {u.sobrenome}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {u.usuario}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:text-sm flex-1 sm:flex-none">
                    <div className="text-muted-foreground">E-mail:</div>
                    <div className="text-right truncate">{u.email}</div>
                    <div className="text-muted-foreground">Setor:</div>
                    <div className="text-right truncate">
                      {matchSectorTitle(
                        (u.setores && u.setores[0]) || u.setor,
                      ) || "—"}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-medium rounded-full px-2.5 py-1 bg-primary/10 text-primary whitespace-nowrap">
                      {u.nivel_acesso}
                    </span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => openEdit(u)}
                      className="h-8 px-3"
                    >
                      <Edit className="h-3.5 w-3.5 mr-1.5" />
                      Editar
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-8 w-8 p-0"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => regeneratePwd(u)}>
                          <Key className="h-4 w-4 mr-2" />
                          Nova senha
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => blockUser(u)}>
                          <Lock className="h-4 w-4 mr-2" />
                          Bloquear
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={async () => {
                            if (!confirm(`Deslogar o usuário ${u.nome}?`))
                              return;
                            try {
                              const res = await fetch(
                                `${API_URL}/api/usuarios/${u.id}/logout`,
                                { method: "POST" },
                              );
                              if (!res.ok) throw new Error("Falha ao deslogar");
                              window.dispatchEvent(
                                new CustomEvent("users:changed"),
                              );
                              window.dispatchEvent(
                                new CustomEvent("auth:refresh"),
                              );
                              alert("Usuário deslogado com sucesso.");
                            } catch (e: any) {
                              alert(e?.message || "Erro ao deslogar usuário");
                            }
                          }}
                        >
                          <LogOut className="h-4 w-4 mr-2" />
                          Deslogar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => deleteUser(u)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && users.length > 0 && (
          <div ref={loadMoreUsersRef} className="flex justify-center py-8 mt-4">
            {isLoadingMore && (
              <div className="text-sm text-muted-foreground">
                Carregando mais usuários...
              </div>
            )}
            {visibleUsers >= users.length && (
              <div className="text-xs text-muted-foreground">Fim da lista</div>
            )}
          </div>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
            <DialogDescription>Atualize os dados e salve.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Nome</Label>
                <Input
                  value={editNome}
                  onChange={(e) => setEditNome(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Sobrenome</Label>
                <Input
                  value={editSobrenome}
                  onChange={(e) => setEditSobrenome(e.target.value)}
                />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Usuário</Label>
                <Input
                  value={editUsuario}
                  onChange={(e) => setEditUsuario(e.target.value)}
                />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Nível de acesso</Label>
                <Select value={editNivel} onValueChange={setEditNivel}>
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
                <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md p-2 mb-2">
                  ℹ️ As permissões marcadas abaixo são as permissões atuais do
                  usuário
                </div>
                <div className="rounded-md border border-border/60 p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  {allSectors.map((s) => (
                    <label key={s} className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border bg-background"
                        checked={editSetores.some((selected) =>
                          isSectorMatch(selected, s),
                        )}
                        onChange={() => toggleEditSector(s)}
                      />
                      <span>{s}</span>
                    </label>
                  ))}
                </div>
                {isEditBiSelected && biSubcategories.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs font-medium text-muted-foreground mb-2">
                      Dashboards do Portal de bi
                    </div>
                    <div className="rounded-md border border-border/40 p-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm bg-muted/30">
                      {biSubcategories.map((sub: any) => (
                        <label
                          key={sub.dashboard_id}
                          className="flex items-start gap-3"
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-border bg-background"
                            checked={editBiSubcategories.includes(
                              sub.dashboard_id,
                            )}
                            onChange={() =>
                              toggleEditBiSubcategory(sub.dashboard_id)
                            }
                          />
                          <div>
                            <div className="font-medium">{sub.title}</div>
                            <div className="text-xs text-muted-foreground">
                              ID: {sub.dashboard_id}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border"
                checked={editForceReset}
                onChange={(e) => setEditForceReset(e.target.checked)}
              />
              Solicitar alteração de senha no próximo acesso
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditing(null)}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={saveEdit}>
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!pwdDialog.user}
        onOpenChange={(o) => !o && setPwdDialog({ user: null, pwd: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova senha gerada</DialogTitle>
            <DialogDescription>
              Guarde a senha com segurança. Ela será exibida apenas uma vez.
            </DialogDescription>
          </DialogHeader>
          {pwdDialog.pwd && (
            <div className="flex items-center gap-3">
              <div className="font-mono text-lg tracking-widest px-3 py-2 rounded-md bg-muted select-all">
                {pwdDialog.pwd}
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  navigator.clipboard?.writeText(pwdDialog.pwd || "")
                }
                className="inline-flex items-center gap-2"
              >
                <Copy className="h-4 w-4" /> Copiar
              </Button>
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

export function Grupos() {
  return (
    <div className="card-surface rounded-xl p-4 text-sm">
      <div className="font-semibold mb-2">Grupos de Usuários</div>
      <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
        <li>Administradores</li>
        <li>Agentes N1</li>
        <li>Agentes N2</li>
        <li>Gestores</li>
      </ul>
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

export function Auth0Usuarios() {
  const [users, setUsers] = useState<Auth0User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");

  useEffect(() => {
    loadAuth0Users();
  }, []);

  const loadAuth0Users = async (search = "") => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (search) {
        params.append("search", search);
      }

      // Use relative URL to leverage Vite proxy
      const url = `/api/auth/users?${params}`;
      console.log("[DEBUG] URL sendo chamada:", url);
      console.log("[DEBUG] Full URL:", window.location.origin + url);

      const response = await fetch(url);
      console.log("[DEBUG] Response status:", response.status);
      console.log("[DEBUG] Response headers:", response.headers);

      if (!response.ok) {
        throw new Error("Falha ao carregar usuários do Auth0");
      }
      const data = await response.json();
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar usuários");
      console.error("Erro ao carregar usuários do Auth0:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    loadAuth0Users(term);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("pt-BR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  return (
    <div className="space-y-3">
      <div className="card-surface rounded-xl p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <div className="font-semibold text-lg">Usuários (Auth0)</div>
            <p className="text-muted-foreground text-sm">
              Usuários cadastrados no Auth0.
            </p>
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

        <div className="flex gap-2">
          <Input
            placeholder="Pesquisar por email ou nome..."
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
            className="flex-1"
          />
        </div>
      </div>

      <div className="rounded-lg border border-border/40 p-4">
        {loading && (
          <div className="text-center py-12">
            <div className="text-sm text-muted-foreground">
              Carregando usuários do Auth0...
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {!loading && !error && users.length === 0 && (
          <div className="text-center py-12">
            <div className="text-sm text-muted-foreground">
              Nenhum usuário encontrado.
            </div>
          </div>
        )}

        {!loading && !error && users.length > 0 && viewMode === "grid" && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {users.map((user) => (
              <div
                key={user.user_id}
                className="card-surface rounded-xl border border-border/40 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="px-5 py-4 border-b border-border/40 bg-gradient-to-r from-primary/5 to-transparent">
                  <h3 className="font-semibold text-sm leading-tight">
                    {user.name || `${user.given_name} ${user.family_name}`.trim() || "—"}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {user.email}
                  </p>
                </div>

                <div className="px-5 py-4 space-y-3">
                  <div>
                    <div className="text-xs text-muted-foreground font-medium">
                      Status
                    </div>
                    <p className="text-sm">
                      {user.email_verified ? (
                        <span className="inline-flex items-center gap-1 text-green-600">
                          ✓ Verificado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-yellow-600">
                          ⚠ Não verificado
                        </span>
                      )}
                    </p>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground font-medium">
                      Criado em
                    </div>
                    <p className="text-sm">{formatDate(user.created_at)}</p>
                  </div>
                  {user.last_login && (
                    <div>
                      <div className="text-xs text-muted-foreground font-medium">
                        Último acesso
                      </div>
                      <p className="text-sm">{formatDate(user.last_login)}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && !error && users.length > 0 && viewMode === "list" && (
          <div className="space-y-2">
            {users.map((user) => (
              <div
                key={user.user_id}
                className="card-surface rounded-lg border border-border/40 overflow-hidden hover:shadow-sm transition-shadow"
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm">
                      {user.name || `${user.given_name} ${user.family_name}`.trim() || "—"}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {user.email}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:text-sm flex-1 sm:flex-none">
                    <div className="text-muted-foreground">Status:</div>
                    <div className="text-right">
                      {user.email_verified ? (
                        <span className="text-green-600">✓ Verificado</span>
                      ) : (
                        <span className="text-yellow-600">⚠ Não verificado</span>
                      )}
                    </div>
                    <div className="text-muted-foreground">Criado em:</div>
                    <div className="text-right">{formatDate(user.created_at)}</div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {user.last_login && (
                      <span className="text-xs font-medium rounded-full px-2.5 py-1 bg-primary/10 text-primary whitespace-nowrap">
                        Último acesso: {formatDate(user.last_login)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
