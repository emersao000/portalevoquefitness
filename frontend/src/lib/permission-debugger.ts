/**
 * Permission Sync Debugger
 *
 * This module helps track and debug permission synchronization events.
 * It creates a visual dashboard in the browser console showing:
 * - Socket.IO connection status
 * - Events received and emitted
 * - API calls made
 * - State changes in auth context
 */

interface DebugEvent {
  timestamp: number;
  type: string;
  source: "socket" | "api" | "event" | "state" | "backend";
  message: string;
  data?: any;
}

class PermissionDebugger {
  private events: DebugEvent[] = [];
  private maxEvents = 50;
  private socketConnected = false;
  private socketId: string | null = null;
  private lastUserId: number | null = null;

  constructor() {
    this.setupListeners();
  }

  private setupListeners() {
    // Listen for all custom events related to auth/permissions
    window.addEventListener("auth:refresh", () => {
      this.log("event", "auth:refresh event fired");
    });

    window.addEventListener("users:changed", () => {
      this.log("event", "users:changed event fired");
    });

    window.addEventListener("user:updated", (e: Event) => {
      const evt = e as CustomEvent;
      this.log("event", "user:updated event fired", evt.detail);
    });

    // Socket.IO connection monitoring
    const monitor = setInterval(() => {
      try {
        const socket = (window as any).__APP_SOCK__;
        if (socket) {
          const newConnected = socket.connected;
          const newId = socket.id;

          if (newConnected !== this.socketConnected) {
            this.socketConnected = newConnected;
            this.log(
              "socket",
              newConnected
                ? "✓ Socket.IO connected"
                : "✗ Socket.IO disconnected",
              { id: newId },
            );
          }

          if (newId && newId !== this.socketId) {
            this.socketId = newId;
            this.log("socket", "Socket.IO ID changed", { id: newId });
          }
        }
      } catch (e) {
        // ignore
      }
    }, 1000);

    // Log Socket.IO events if they exist
    try {
      const socket = (window as any).__APP_SOCK__;
      if (socket) {
        const originalEmit = socket.emit.bind(socket);
        socket.emit = (event: string, ...args: any[]) => {
          if (event === "identify" || event === "auth:refresh") {
            this.log("socket", `Emitting: ${event}`, args[0]);
          }
          return originalEmit(event, ...args);
        };
      }
    } catch (e) {
      // ignore
    }
  }

  log(source: DebugEvent["source"], message: string, data?: any) {
    const event: DebugEvent = {
      timestamp: Date.now(),
      type: source,
      source,
      message,
      data,
    };

    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // Also log to console for immediate visibility
    const icon = this.getIcon(source);
    console.log(
      `%c${icon} [PERM-DEBUG] ${message}`,
      this.getStyle(source),
      data,
    );
  }

  private getIcon(source: DebugEvent["source"]): string {
    const icons: Record<DebugEvent["source"], string> = {
      socket: "🔌",
      api: "📡",
      event: "📢",
      state: "💾",
      backend: "⚙️",
    };
    return icons[source];
  }

  private getStyle(source: DebugEvent["source"]): string {
    const styles: Record<DebugEvent["source"], string> = {
      socket: "color: #0066ff; font-weight: bold;",
      api: "color: #00aa00; font-weight: bold;",
      event: "color: #ff6600; font-weight: bold;",
      state: "color: #6600ff; font-weight: bold;",
      backend: "color: #ff0000; font-weight: bold;",
    };
    return styles[source];
  }

  getStatus(): string {
    const socket = (window as any).__APP_SOCK__;
    const socketStatus = socket?.connected ? "🟢 Connected" : "🔴 Disconnected";
    const recentEvents = this.events.slice(-5);

    const lines = [
      "=== PERMISSION SYNC STATUS ===",
      `Socket.IO: ${socketStatus}`,
      `Recent events:`,
      ...recentEvents.map(
        (e) =>
          `  ${this.getIcon(e.source)} ${new Date(e.timestamp).toLocaleTimeString()}: ${e.message}`,
      ),
    ];

    return lines.join("\n");
  }

  printStatus() {
    console.log(this.getStatus());
  }
}

// Create global instance
export const permissionDebugger = new PermissionDebugger();

// Expose to window for easy access in console
(window as any).__PERM_DEBUG__ = permissionDebugger;
