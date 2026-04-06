import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";

interface MediaItem {
  id: string | number;
  type: "image" | "video" | "message";
  url?: string;
  title?: string;
  description?: string;
  alt?: string;
  mime?: string;
}

export default function LoginMediaConfig() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const load = async () => {
    const res = await apiFetch("/login-media");
    if (!res.ok) return;
    const data = (await res.json()) as MediaItem[];
    setItems(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    load();
  }, []);

  const onPick = () => inputRef.current?.click();

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await apiFetch("/login-media/upload", {
          method: "POST",
          body: fd,
        });
        if (!res.ok) {
          // eslint-disable-next-line no-alert
          alert("Falha ao enviar arquivo");
          break;
        }
      }
      await load();
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onDelete = async (id: string | number) => {
    if (!confirm("Remover este item?")) return;
    const res = await apiFetch(`/login-media/${id}`, { method: "DELETE" });
    if (!res.ok) {
      // eslint-disable-next-line no-alert
      alert("Falha ao remover");
      return;
    }
    await load();
  };

  return (
    <div className="card-surface rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="font-semibold">Mídia do Painel de Login</div>
          <p className="text-sm text-muted-foreground">
            Envie imagens ou vídeos que serão exibidos no painel esquerdo da
            tela de login.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={onUpload}
          />
          <Button
            onClick={onPick}
            disabled={isUploading}
            className="h-9 rounded-md"
          >
            {isUploading ? "Enviando..." : "Adicionar mídia"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((it) => (
          <div
            key={it.id}
            className="border rounded-lg overflow-hidden bg-background"
          >
            <div className="aspect-square w-full bg-muted/40 flex items-center justify-center">
              {it.type === "image" && it.url ? (
                <img
                  src={it.url}
                  alt={it.alt || it.title || "Imagem"}
                  className="w-full h-full object-cover"
                />
              ) : it.type === "video" && it.url ? (
                <video
                  className="w-full h-full object-cover"
                  muted
                  controls
                  preload="metadata"
                >
                  <source src={it.url} type={it.mime || "video/mp4"} />
                </video>
              ) : (
                <div className="p-4 text-sm text-muted-foreground">
                  {it.title || "Mensagem"}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between p-2">
              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                {it.type}
              </div>
              <button
                onClick={() => onDelete(it.id)}
                className="text-xs px-2 py-1 rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Remover
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 ? (
          <div className="col-span-full text-sm text-muted-foreground">
            Nenhuma mídia enviada ainda.
          </div>
        ) : null}
      </div>
    </div>
  );
}
