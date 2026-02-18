import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Trash2,
  CheckCheck,
  Check,
  Clock,
  AlertCircle,
  Search,
  RefreshCw,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Notification {
  id: number;
  tipo: string;
  titulo: string;
  mensagem?: string;
  recurso?: string;
  recurso_id?: number;
  acao?: string;
  dados?: string;
  lido: boolean;
  criado_em: string;
  lido_em?: string;
}

interface Stats {
  total: number;
  lidas: number;
  nao_lidas: number;
}

export default function NotificationsConfig() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    lidas: 0,
    nao_lidas: 0,
  });
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);
  const [selectedNotifications, setSelectedNotifications] = useState<
    Set<number>
  >(new Set());

  useEffect(() => {
    loadNotifications();
    loadStats();
  }, []);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: "200",
        unread_only: filterUnreadOnly.toString(),
      });
      const res = await apiFetch(`/notifications?${params}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error("Erro ao carregar notificações:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await apiFetch("/notifications/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Erro ao carregar estatísticas:", error);
    }
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      const res = await apiFetch(`/notifications/${id}/read`, {
        method: "PATCH",
      });
      if (res.ok) {
        loadNotifications();
        loadStats();
      }
    } catch (error) {
      console.error("Erro ao marcar como lido:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const res = await apiFetch("/notifications/read-all", {
        method: "PATCH",
      });
      if (res.ok) {
        loadNotifications();
        loadStats();
      }
    } catch (error) {
      console.error("Erro ao marcar todas como lidas:", error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Tem certeza que deseja deletar esta notificação?")) return;

    try {
      const res = await apiFetch(`/notifications/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        loadNotifications();
        loadStats();
      }
    } catch (error) {
      console.error("Erro ao deletar notificação:", error);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedNotifications.size === 0) return;
    if (
      !confirm(
        `Tem certeza que deseja deletar ${selectedNotifications.size} notificação(ões)?`,
      )
    )
      return;

    try {
      for (const id of selectedNotifications) {
        await apiFetch(`/notifications/${id}`, {
          method: "DELETE",
        });
      }
      setSelectedNotifications(new Set());
      loadNotifications();
      loadStats();
    } catch (error) {
      console.error("Erro ao deletar notificações:", error);
    }
  };

  const handleDeleteAllRead = async () => {
    if (!confirm("Tem certeza que deseja deletar TODAS as notificações lidas?"))
      return;

    try {
      const res = await apiFetch("/notifications?lido_only=true", {
        method: "DELETE",
      });
      if (res.ok) {
        loadNotifications();
        loadStats();
      }
    } catch (error) {
      console.error("Erro ao deletar notificações lidas:", error);
    }
  };

  const toggleNotificationSelection = (id: number) => {
    const newSelected = new Set(selectedNotifications);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedNotifications(newSelected);
  };

  const toggleAllSelection = () => {
    if (selectedNotifications.size === filteredNotifications.length) {
      setSelectedNotifications(new Set());
    } else {
      setSelectedNotifications(new Set(filteredNotifications.map((n) => n.id)));
    }
  };

  const filteredNotifications = notifications.filter(
    (n) =>
      n.titulo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (n.mensagem &&
        n.mensagem.toLowerCase().includes(searchQuery.toLowerCase())) ||
      n.tipo.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  const getNotificationTypeColor = (tipo: string) => {
    const typeColors: Record<string, string> = {
      chamado: "bg-blue-500/10 text-blue-700 border-blue-500/20",
      sistema: "bg-purple-500/10 text-purple-700 border-purple-500/20",
      alerta: "bg-orange-500/10 text-orange-700 border-orange-500/20",
      erro: "bg-red-500/10 text-red-700 border-red-500/20",
    };
    return (
      typeColors[tipo.toLowerCase()] ||
      "bg-gray-500/10 text-gray-700 border-gray-500/20"
    );
  };

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              Total de Notificações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Todas as notificações do sistema
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Não Lidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {stats.nao_lidas}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Aguardando leitura
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Lidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.lidas}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Já visualizadas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Gerenciar Notificações</CardTitle>
              <CardDescription>
                Visualize e gerencie todas as notificações do sistema
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                loadNotifications();
                loadStats();
              }}
              disabled={loading}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                placeholder="Buscar por título, mensagem ou tipo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              size="sm"
              variant={filterUnreadOnly ? "default" : "outline"}
              onClick={() => {
                setFilterUnreadOnly(!filterUnreadOnly);
              }}
            >
              <Clock className="w-4 h-4 mr-2" />
              {filterUnreadOnly ? "Apenas Não Lidas" : "Todas"}
            </Button>
          </div>

          {/* Action Buttons */}
          {stats.nao_lidas > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={handleMarkAllAsRead}>
                <CheckCheck className="w-4 h-4 mr-2" />
                Marcar Todas como Lidas
              </Button>
            </div>
          )}

          {selectedNotifications.size > 0 && (
            <div className="flex flex-wrap gap-2 p-3 bg-secondary/50 rounded-lg">
              <span className="text-sm font-medium my-auto">
                {selectedNotifications.size} selecionada(s)
              </span>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDeleteSelected}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Deletar Selecionadas
              </Button>
            </div>
          )}

          {stats.lidas > 0 && selectedNotifications.size === 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleDeleteAllRead}
              className="text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Deletar Todas Lidas
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Notifications List */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>
                {notifications.length === 0
                  ? "Nenhuma notificação registrada"
                  : "Nenhuma notificação encontrada com os filtros aplicados"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex items-center gap-2 px-1">
              <input
                type="checkbox"
                checked={
                  filteredNotifications.length > 0 &&
                  selectedNotifications.size === filteredNotifications.length
                }
                onChange={toggleAllSelection}
                className="w-4 h-4"
              />
              <span className="text-sm text-muted-foreground">
                {filteredNotifications.length} notificação(ões)
              </span>
            </div>

            {filteredNotifications.map((notification) => (
              <Card
                key={notification.id}
                className={`transition-all ${
                  !notification.lido
                    ? "border-yellow-500/50 bg-yellow-500/5"
                    : ""
                } ${selectedNotifications.has(notification.id) ? "border-primary bg-primary/5" : ""}`}
              >
                <CardContent className="py-4">
                  <div className="flex items-start gap-4">
                    <input
                      type="checkbox"
                      checked={selectedNotifications.has(notification.id)}
                      onChange={() =>
                        toggleNotificationSelection(notification.id)
                      }
                      className="w-4 h-4 mt-1"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className="font-semibold text-base break-words">
                          {notification.titulo}
                        </h3>
                        <Badge
                          variant="outline"
                          className={getNotificationTypeColor(
                            notification.tipo,
                          )}
                        >
                          {notification.tipo}
                        </Badge>
                        {!notification.lido && (
                          <Badge variant="default" className="bg-yellow-500">
                            Não Lida
                          </Badge>
                        )}
                      </div>

                      {notification.mensagem && (
                        <p className="text-sm text-muted-foreground mb-3 break-words">
                          {notification.mensagem}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-3">
                        {notification.acao && (
                          <span>Ação: {notification.acao}</span>
                        )}
                        {notification.recurso && (
                          <span>Recurso: {notification.recurso}</span>
                        )}
                        <span>ID: {notification.id}</span>
                        <span>{formatDate(notification.criado_em)}</span>
                        {notification.lido_em && (
                          <span className="text-green-600">
                            Lida em: {formatDate(notification.lido_em)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 flex-shrink-0">
                      {!notification.lido && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleMarkAsRead(notification.id)}
                          title="Marcar como lida"
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(notification.id)}
                        className="text-destructive"
                        title="Deletar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
