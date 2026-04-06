import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  Volume2,
  VolumeX,
  Layout,
  Clock,
  Save,
  RefreshCw,
  AlertCircle,
} from "lucide-react";

interface NotificationSettings {
  id: number;
  chamado_enabled: boolean;
  sistema_enabled: boolean;
  alerta_enabled: boolean;
  erro_enabled: boolean;
  som_habilitado: boolean;
  som_tipo: string;
  estilo_exibicao: string;
  posicao: string;
  duracao: number;
  tamanho: string;
  mostrar_icone: boolean;
  mostrar_acao: boolean;
  criado_em: string;
  atualizado_em: string;
}

const POSICOES = [
  { value: "top-left", label: "Superior Esquerda" },
  { value: "top-right", label: "Superior Direita" },
  { value: "bottom-left", label: "Inferior Esquerda" },
  { value: "bottom-right", label: "Inferior Direita" },
];

const TAMANHOS = [
  { value: "pequeno", label: "Pequeno" },
  { value: "medio", label: "Médio" },
  { value: "grande", label: "Grande" },
];

const SONS = [
  { value: "notificacao", label: "Notificação Padrão" },
  { value: "sino", label: "Sino" },
  { value: "ding", label: "Ding" },
  { value: "pop", label: "Pop" },
];

export default function NotificationSettingsConfig() {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/notification-settings");
      console.log(
        "[NotificationSettings] GET /notification-settings:",
        res.status,
      );
      if (res.ok) {
        const data = await res.json();
        console.log("[NotificationSettings] Dados recebidos:", data);
        setSettings(data);
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error("[NotificationSettings] Erro:", res.status, errData);
        setError(`Erro ao carregar configurações (${res.status})`);
      }
    } catch (err) {
      console.error("[NotificationSettings] Exception:", err);
      setError("Erro ao conectar com o servidor");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleNotificationType = (type: keyof NotificationSettings) => {
    if (!settings) return;
    if (
      type === "chamado_enabled" ||
      type === "sistema_enabled" ||
      type === "alerta_enabled" ||
      type === "erro_enabled"
    ) {
      setSettings({
        ...settings,
        [type]: !settings[type],
      });
    }
  };

  const handleToggleSound = () => {
    if (!settings) return;
    setSettings({
      ...settings,
      som_habilitado: !settings.som_habilitado,
    });
  };

  const handleToggleIcon = () => {
    if (!settings) return;
    setSettings({
      ...settings,
      mostrar_icone: !settings.mostrar_icone,
    });
  };

  const handleToggleAction = () => {
    if (!settings) return;
    setSettings({
      ...settings,
      mostrar_acao: !settings.mostrar_acao,
    });
  };

  const handleChangePosition = (position: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      posicao: position,
    });
  };

  const handleChangeSize = (size: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      tamanho: size,
    });
  };

  const handleChangeSound = (sound: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      som_tipo: sound,
    });
  };

  const handleChangeDuration = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!settings) return;
    const value = parseInt(e.target.value) || 0;
    setSettings({
      ...settings,
      duracao: Math.max(1, Math.min(30, value)),
    });
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await apiFetch("/notification-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        setSuccessMessage("Configurações salvas com sucesso!");
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError("Erro ao salvar configurações");
      }
    } catch (err) {
      setError("Erro ao conectar com o servidor");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Tem certeza que deseja resetar para valores padrão?")) return;

    setSaving(true);
    setError(null);

    try {
      const res = await apiFetch("/notification-settings/reset", {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        setSuccessMessage("Configurações resetadas para valores padrão!");
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError("Erro ao resetar configurações");
      }
    } catch (err) {
      setError("Erro ao conectar com o servidor");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Carregando configurações...</p>
        </CardContent>
      </Card>
    );
  }

  if (!settings) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-destructive opacity-50" />
          <p className="text-muted-foreground">
            Erro ao carregar configurações
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Messages */}
      {error && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex gap-2">
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {successMessage && (
        <Card className="border-green-500/50 bg-green-500/5">
          <CardContent className="pt-6">
            <p className="text-sm text-green-700">{successMessage}</p>
          </CardContent>
        </Card>
      )}

      {/* Tipos de Notificações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Tipos de Notificação
          </CardTitle>
          <CardDescription>
            Habilite ou desabilite os tipos de notificação que deseja receber
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                key: "chamado_enabled" as const,
                label: "Chamados",
                description: "Notificações relacionadas a chamados",
              },
              {
                key: "sistema_enabled" as const,
                label: "Sistema",
                description: "Notificações do sistema",
              },
              {
                key: "alerta_enabled" as const,
                label: "Alertas",
                description: "Alertas e avisos",
              },
              {
                key: "erro_enabled" as const,
                label: "Erros",
                description: "Erros e exceções",
              },
            ].map((type) => (
              <div
                key={type.key}
                className="p-3 rounded-lg border bg-secondary/30 flex items-center justify-between cursor-pointer hover:bg-secondary/50 transition-colors"
                onClick={() => handleToggleNotificationType(type.key)}
              >
                <div>
                  <p className="font-medium text-sm">{type.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {type.description}
                  </p>
                </div>
                <div>
                  {settings[type.key] ? (
                    <Badge className="bg-green-500">Ativado</Badge>
                  ) : (
                    <Badge variant="outline">Desativado</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Configurações de Som */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {settings.som_habilitado ? (
              <Volume2 className="w-5 h-5" />
            ) : (
              <VolumeX className="w-5 h-5" />
            )}
            Som e Áudio
          </CardTitle>
          <CardDescription>
            Configure como deseja ouvir as notificações
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Sound Toggle */}
          <div
            className="p-3 rounded-lg border bg-secondary/30 flex items-center justify-between cursor-pointer hover:bg-secondary/50 transition-colors"
            onClick={handleToggleSound}
          >
            <div>
              <p className="font-medium text-sm">Som das Notificações</p>
              <p className="text-xs text-muted-foreground">
                Ativar/desativar som ao receber notificações
              </p>
            </div>
            <div>
              {settings.som_habilitado ? (
                <Badge className="bg-green-500">Ativado</Badge>
              ) : (
                <Badge variant="outline">Desativado</Badge>
              )}
            </div>
          </div>

          {/* Sound Type Selection */}
          {settings.som_habilitado && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de Som</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SONS.map((som) => (
                  <button
                    key={som.value}
                    onClick={() => handleChangeSound(som.value)}
                    className={`p-2 rounded-lg border text-sm font-medium transition-colors ${
                      settings.som_tipo === som.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary hover:bg-secondary/80"
                    }`}
                  >
                    {som.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Layout e Exibição */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layout className="w-5 h-5" />
            Layout e Exibição
          </CardTitle>
          <CardDescription>
            Configure como as notificações aparecem na tela
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Posição */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Posição na Tela</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {POSICOES.map((pos) => (
                <button
                  key={pos.value}
                  onClick={() => handleChangePosition(pos.value)}
                  className={`p-2 rounded-lg border text-xs font-medium transition-colors ${
                    settings.posicao === pos.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary hover:bg-secondary/80"
                  }`}
                >
                  {pos.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tamanho */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Tamanho</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {TAMANHOS.map((size) => (
                <button
                  key={size.value}
                  onClick={() => handleChangeSize(size.value)}
                  className={`p-2 rounded-lg border text-sm font-medium transition-colors ${
                    settings.tamanho === size.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary hover:bg-secondary/80"
                  }`}
                >
                  {size.label}
                </button>
              ))}
            </div>
          </div>

          {/* Duração */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Duração de Exibição (segundos)
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="range"
                min="1"
                max="30"
                value={settings.duracao}
                onChange={handleChangeDuration}
                className="flex-1"
              />
              <input
                type="number"
                min="1"
                max="30"
                value={settings.duracao}
                onChange={handleChangeDuration}
                className="w-16 px-2 py-1 border rounded text-sm"
              />
            </div>
          </div>

          {/* Mostrar Ícone */}
          <div
            className="p-3 rounded-lg border bg-secondary/30 flex items-center justify-between cursor-pointer hover:bg-secondary/50 transition-colors"
            onClick={handleToggleIcon}
          >
            <div>
              <p className="font-medium text-sm">Mostrar Ícone</p>
              <p className="text-xs text-muted-foreground">
                Exibir ícone na notificação
              </p>
            </div>
            <div>
              {settings.mostrar_icone ? (
                <Badge className="bg-green-500">Ativado</Badge>
              ) : (
                <Badge variant="outline">Desativado</Badge>
              )}
            </div>
          </div>

          {/* Mostrar Ação */}
          <div
            className="p-3 rounded-lg border bg-secondary/30 flex items-center justify-between cursor-pointer hover:bg-secondary/50 transition-colors"
            onClick={handleToggleAction}
          >
            <div>
              <p className="font-medium text-sm">Mostrar Ação</p>
              <p className="text-xs text-muted-foreground">
                Exibir botão de ação na notificação
              </p>
            </div>
            <div>
              {settings.mostrar_acao ? (
                <Badge className="bg-green-500">Ativado</Badge>
              ) : (
                <Badge variant="outline">Desativado</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ações */}
      <div className="flex gap-2 justify-end">
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={saving}
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Resetar Padrões
        </Button>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="w-4 h-4" />
          {saving ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </div>
    </div>
  );
}
