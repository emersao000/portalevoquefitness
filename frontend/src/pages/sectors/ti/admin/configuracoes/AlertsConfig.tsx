import { useEffect, useState, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  X,
  AlertCircle,
  AlertTriangle,
  Info,
  Flame,
  Image as ImageIcon,
  Calendar,
  Trash2,
  Plus,
  Sparkles,
  Monitor,
  Eye,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ALERT_PAGES, groupPagesByCategory } from "@/config/alert-pages";
import AlertViewersModal from "@/components/alerts/AlertViewersModal";

type MediaItem = { id: number | string; url?: string; type?: string };

const severityConfig = {
  low: {
    icon: Info,
    label: "Baixa",
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    badge: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  },
  medium: {
    icon: AlertCircle,
    label: "Média",
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/20",
    badge: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  },
  high: {
    icon: AlertTriangle,
    label: "Alta",
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
    badge: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  },
  critical: {
    icon: Flame,
    label: "Crítica",
    color: "text-red-500",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
    badge: "bg-red-500/10 text-red-500 border-red-500/20",
  },
};

export default function AlertsConfig() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<keyof typeof severityConfig>("low");
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [imagemFile, setImagemFile] = useState<File | null>(null);
  const [imagemPreview, setImagemPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewersModalOpen, setViewersModalOpen] = useState(false);
  const [selectedAlertForViewers, setSelectedAlertForViewers] = useState<
    any | null
  >(null);

  const loadMedia = async () => {
    const res = await apiFetch("/login-media");
    if (!res.ok) return;
    const data = await res.json();
    setMediaList(Array.isArray(data) ? data : []);
  };

  const loadAlerts = async () => {
    const res = await apiFetch("/alerts");
    if (!res.ok) return;
    const data = await res.json();
    setAlerts(Array.isArray(data) ? data : []);
  };

  const handleImagemChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImagemFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setImagemPreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const limparImagem = () => {
    setImagemFile(null);
    setImagemPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    loadMedia();
    loadAlerts();
  }, []);

  const create = async () => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("message", message);
      formData.append("description", description);
      formData.append("severity", severity);
      formData.append("show_on_home", String(selectedPages.includes("home")));

      // Enviar páginas como JSON string
      if (selectedPages.length > 0) {
        formData.append("pages", JSON.stringify(selectedPages));
      } else {
        formData.append("pages", JSON.stringify([]));
      }

      if (imagemFile) {
        formData.append("imagem", imagemFile);
      }

      const res = await apiFetch("/alerts", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const error = await res.text();
        console.error("Erro ao criar alerta:", error);
        alert("Falha ao criar alerta: " + error);
      } else {
        setTitle("");
        setMessage("");
        setDescription("");
        setSeverity("low");
        setSelectedPages([]);
        limparImagem();
        await loadAlerts();
      }
    } catch (error) {
      console.error("Erro:", error);
      alert("Erro ao criar alerta");
    } finally {
      setLoading(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Tem certeza que deseja remover este alerta?")) return;
    const res = await apiFetch(`/alerts/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Falha ao remover");
      return;
    }
    await loadAlerts();
  };

  const openViewersModal = (alert: any) => {
    setSelectedAlertForViewers(alert);
    setViewersModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10">
          <Sparkles className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold tracking-tight">
            Alertas do Sistema
          </h2>
          <p className="text-muted-foreground mt-1">
            Crie e gerencie mensagens que serão exibidas na página inicial para
            todos os usuários
          </p>
        </div>
      </div>

      {/* Formulário de Criação */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Criar Novo Alerta
          </CardTitle>
          <CardDescription>
            Preencha as informações abaixo para criar um novo alerta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Título */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              Título
              <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder="Ex: Manutenção programada"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-base"
            />
          </div>

          {/* Mensagem */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              Mensagem
              <span className="text-destructive">*</span>
            </label>
            <textarea
              placeholder="Ex: O sistema estará em manutenção das 22h às 23h..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full min-h-[100px] px-3 py-2 rounded-md border bg-background text-base resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Severidade */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Nível de Severidade</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(
                Object.keys(severityConfig) as Array<
                  keyof typeof severityConfig
                >
              ).map((sev) => {
                const config = severityConfig[sev];
                const Icon = config.icon;
                const isActive = severity === sev;

                return (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => setSeverity(sev)}
                    className={`
                      relative p-4 rounded-lg border-2 transition-all
                      ${
                        isActive
                          ? `${config.bg} ${config.border} shadow-lg scale-105`
                          : "border-border hover:border-muted-foreground/30"
                      }
                    `}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Icon
                        className={`w-6 h-6 ${isActive ? config.color : "text-muted-foreground"}`}
                      />
                      <span
                        className={`text-sm font-medium ${isActive ? config.color : "text-muted-foreground"}`}
                      >
                        {config.label}
                      </span>
                    </div>
                    {isActive && (
                      <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-current animate-pulse" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Descrição (opcional) */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Descrição (opcional)
            </label>
            <textarea
              placeholder="Ex: Informações adicionais sobre o alerta..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full min-h-[80px] px-3 py-2 rounded-md border bg-background text-base resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Seleção de Páginas */}
          <div className="space-y-3">
            <label className="text-sm font-medium flex items-center gap-2">
              <Monitor className="w-4 h-4" />
              Exibir em que páginas?
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto p-3 border rounded-lg bg-muted/20">
              {Object.entries(groupPagesByCategory()).map(
                ([category, pages]) => (
                  <div key={category} className="space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {category}
                    </h4>
                    <div className="space-y-2 pl-2 border-l-2 border-muted-foreground/20">
                      {pages.map((page) => (
                        <label
                          key={page.id}
                          className="flex items-center gap-3 p-2 rounded-md hover:bg-accent transition-colors cursor-pointer group"
                        >
                          <input
                            type="checkbox"
                            checked={selectedPages.includes(page.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPages([...selectedPages, page.id]);
                              } else {
                                setSelectedPages(
                                  selectedPages.filter((p) => p !== page.id),
                                );
                              }
                            }}
                            className="w-4 h-4 rounded border-muted-foreground/30 accent-primary"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium group-hover:text-foreground text-muted-foreground">
                              {page.label}
                            </p>
                            <p className="text-xs text-muted-foreground/60">
                              {page.path}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ),
              )}
            </div>
            {selectedPages.length > 0 && (
              <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-sm font-medium text-primary">
                  {selectedPages.length}{" "}
                  {selectedPages.length === 1 ? "página" : "páginas"}{" "}
                  selecionada
                  {selectedPages.length !== 1 ? "s" : ""}
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedPages.map((pageId) => {
                    const page =
                      ALERT_PAGES[pageId as keyof typeof ALERT_PAGES];
                    return page ? (
                      <Badge key={pageId} variant="secondary">
                        {page.label}
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedPages(
                              selectedPages.filter((p) => p !== pageId),
                            )
                          }
                          className="ml-2 hover:opacity-70"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Upload de Imagem */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              Imagem do alerta (opcional)
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImagemChange}
              className="hidden"
            />

            {!imagemPreview ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full p-8 rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors group"
              >
                <div className="flex flex-col items-center gap-2 text-muted-foreground group-hover:text-primary transition-colors">
                  <ImageIcon className="w-8 h-8" />
                  <span className="text-sm font-medium">
                    Clique para escolher uma imagem
                  </span>
                  <span className="text-xs">PNG, JPG ou WEBP até 5MB</span>
                </div>
              </button>
            ) : (
              <div className="relative group rounded-lg overflow-hidden border-2 border-border">
                <img
                  src={imagemPreview}
                  alt="Preview"
                  className="w-full h-64 object-cover"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImageIcon className="w-4 h-4 mr-2" />
                    Alterar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={limparImagem}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Remover
                  </Button>
                </div>
                {imagemFile && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm p-2 text-xs text-white">
                    {imagemFile.name} • {(imagemFile.size / 1024).toFixed(0)} KB
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Botão de Criar */}
          <Button
            onClick={create}
            disabled={loading || !title || !message}
            className="w-full h-12 text-base font-medium"
            size="lg"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                Criando alerta...
              </>
            ) : (
              <>
                <Plus className="w-5 h-5 mr-2" />
                Criar Alerta
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Lista de Alertas */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">Alertas Ativos</h3>
          <Badge variant="secondary" className="text-sm">
            {alerts.length} {alerts.length === 1 ? "alerta" : "alertas"}
          </Badge>
        </div>

        {alerts.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12">
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <AlertCircle className="w-12 h-12 opacity-20" />
                <p className="text-sm font-medium">
                  Nenhum alerta criado ainda
                </p>
                <p className="text-xs">Crie seu primeiro alerta acima</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {alerts.map((alert) => {
              const config =
                severityConfig[alert.severity as keyof typeof severityConfig] ||
                severityConfig.low;
              const Icon = config.icon;

              return (
                <Card
                  key={alert.id}
                  className={`border-l-4 ${config.border} hover:shadow-lg transition-shadow`}
                >
                  <CardContent className="p-6">
                    <div className="flex gap-4">
                      {/* Ícone de Severidade */}
                      <div
                        className={`flex-shrink-0 w-12 h-12 rounded-lg ${config.bg} flex items-center justify-center`}
                      >
                        <Icon className={`w-6 h-6 ${config.color}`} />
                      </div>

                      {/* Conteúdo */}
                      <div className="flex-1 min-w-0 space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h4 className="font-semibold text-lg">
                              {alert.title}
                            </h4>
                            <p className="text-muted-foreground mt-1">
                              {alert.message}
                            </p>
                            {alert.description && (
                              <p className="text-sm text-muted-foreground/70 mt-2 italic">
                                {alert.description}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => remove(alert.id)}
                            className="hover:bg-destructive/10 hover:text-destructive flex-shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>

                        {/* Imagem */}
                        {alert.imagem_blob && (
                          <div className="rounded-lg overflow-hidden border max-w-md">
                            <img
                              src={`data:${alert.imagem_mime_type || "image/jpeg"};base64,${alert.imagem_blob}`}
                              alt="Alerta"
                              className="w-full h-48 object-cover"
                            />
                          </div>
                        )}

                        {/* Páginas onde é exibido */}
                        {alert.pages && alert.pages.length > 0 && (
                          <div className="pt-2 border-t">
                            <p className="text-xs font-medium text-muted-foreground mb-2">
                              Exibido em:
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {alert.pages.map((pageId: string) => {
                                const page =
                                  ALERT_PAGES[
                                    pageId as keyof typeof ALERT_PAGES
                                  ];
                                return page ? (
                                  <Badge key={pageId} variant="outline">
                                    {page.label}
                                  </Badge>
                                ) : null;
                              })}
                            </div>
                          </div>
                        )}

                        {/* Usuários que visualizaram */}
                        {alert.usuarios_visualizaram &&
                          alert.usuarios_visualizaram.length > 0 && (
                            <div className="pt-2 border-t">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-medium text-muted-foreground">
                                  Visualizado por{" "}
                                  {alert.usuarios_visualizaram.length}{" "}
                                  {alert.usuarios_visualizaram.length === 1
                                    ? "usuário"
                                    : "usuários"}
                                </p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openViewersModal(alert)}
                                  className="h-7 text-xs"
                                >
                                  <Eye className="w-3 h-3 mr-1" />
                                  Ver lista
                                </Button>
                              </div>
                            </div>
                          )}

                        {/* Footer */}
                        <div className="flex items-center gap-3 pt-2 border-t">
                          <Badge variant="outline" className={config.badge}>
                            {config.label}
                          </Badge>
                          {alert.created_at && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              {new Date(alert.created_at).toLocaleDateString(
                                "pt-BR",
                                {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Viewers Modal */}
      {selectedAlertForViewers && (
        <AlertViewersModal
          alertId={selectedAlertForViewers.id}
          alertTitle={selectedAlertForViewers.title}
          open={viewersModalOpen}
          onOpenChange={setViewersModalOpen}
        />
      )}
    </div>
  );
}
