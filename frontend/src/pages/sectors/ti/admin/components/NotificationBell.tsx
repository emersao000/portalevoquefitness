import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, Check } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

interface Notif {
  id: number;
  titulo: string;
  mensagem?: string | null;
  lido: boolean;
}

export default function NotificationBell() {
  const [items, setItems] = useState<Notif[]>([]);
  const unread = items.filter((i) => !i.lido).length;

  useEffect(() => {
    const load = async () => {
      try {
        let r = await apiFetch("/notifications?limit=20");
        if (r.status === 404) {
          const base = (import.meta as any)?.env?.VITE_API_BASE || "/api";
          const url = `${String(base).replace(/\/?api$/, "")}/notifications?limit=20`;
          r = await fetch(url);
        }
        if (!r.ok) throw new Error("fail");
        const arr = await r.json();
        const mapped = Array.isArray(arr)
          ? arr.map((n: any) => ({
              id: n.id,
              titulo: n.titulo,
              mensagem: n.mensagem ?? null,
              lido: !!n.lido,
            }))
          : [];
        setItems(mapped);
      } catch {}
    };
    load();

    let socketCleanup: (() => void) | null = null;

    import("socket.io-client").then(({ io }) => {
      const base = (import.meta as any)?.env?.VITE_API_BASE || "/api";
      const origin = String(base).replace(/\/?api$/, "");
      // Socket.IO é sempre montado em /socket.io (fora do prefixo /api)
      const socketPath = "/socket.io";
      const socket = io(origin, {
        path: socketPath,
        // Start with polling — avoids WebSocket handshake errors when the
        // reverse-proxy / server doesn't support WebSocket upgrades.
        transports: ["polling", "websocket"],
        autoConnect: true,
        reconnectionAttempts: 3,
      });
      socket.on("notification:new", (n: any) => {
        setItems((prev) =>
          [
            {
              id: n.id,
              titulo: n.titulo,
              mensagem: n.mensagem ?? null,
              lido: !!n.lido,
            },
            ...prev,
          ].slice(0, 20),
        );
        toast({ title: n.titulo, description: n.mensagem || "" });
      });
      socketCleanup = () => socket.disconnect();
    }).catch(() => {/* socket.io unavailable — notifications work via REST only */});

    return () => { socketCleanup?.(); };
  }, []);

  const markAsRead = async (id: number) => {
    try {
      let r = await apiFetch(`/notifications/${id}/read`, { method: "PATCH" });
      if (r.status === 404) {
        const base = (import.meta as any)?.env?.VITE_API_BASE || "/api";
        const url = `${String(base).replace(/\/?api$/, "")}/notifications/${id}/read`;
        r = await fetch(url, { method: "PATCH" });
      }
      if (!r.ok) throw new Error();
      const updated = await r.json();
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, lido: updated.lido } : i)),
      );
    } catch {}
  };

  const markAll = async () => {
    const ids = items.filter((i) => !i.lido).map((i) => i.id);
    for (const id of ids) {
      // sequential to avoid spamming
      // eslint-disable-next-line no-await-in-loop
      await markAsRead(id);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="secondary"
          className="relative rounded-full"
          size="icon"
          aria-label="Notificações"
        >
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] leading-5 text-center px-1">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[320px] p-0">
        <div className="flex items-center justify-between px-3 py-2.5 border-b">
          <span className="text-sm font-semibold">Notificações</span>
          {unread > 0 && (
            <button
              onClick={markAll}
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              <Check className="size-3" /> Marcar como lidas
            </button>
          )}
        </div>
        <div className="overflow-y-auto max-h-[400px]">
          {items.length === 0 ? (
            <div className="px-3 py-6 text-sm text-center text-muted-foreground">
              Sem notificações
            </div>
          ) : (
            items.map((n) => (
              <DropdownMenuItem
                key={n.id}
                className="flex items-start gap-2 px-3 py-2.5 cursor-pointer border-b last:border-0 rounded-none"
                onClick={() => markAsRead(n.id)}
              >
                <div
                  className={`mt-1.5 flex-shrink-0 size-2 rounded-full ${n.lido ? "bg-muted" : "bg-primary"}`}
                />
                <div className="min-w-0">
                  <div className="text-sm font-medium leading-5">{n.titulo}</div>
                  {n.mensagem && (
                    <div className="text-xs text-muted-foreground leading-4 mt-0.5 line-clamp-2">
                      {n.mensagem}
                    </div>
                  )}
                </div>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
