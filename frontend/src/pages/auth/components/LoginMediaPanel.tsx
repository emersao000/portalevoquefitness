import { useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { apiFetch } from "@/lib/api";

type MediaKind = "image" | "video";

interface MediaItem {
  id: string | number;
  type: MediaKind;
  url?: string;
  mime?: string;
}

async function fetchLoginMedia(signal?: AbortSignal): Promise<MediaItem[]> {
  try {
    const res = await apiFetch("/login-media", { signal });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export default function LoginMediaPanel() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loadedVideos, setLoadedVideos] = useState<Set<string | number>>(
    new Set(),
  );
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "center",
    skipSnaps: false,
  });

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const videoListenersRef = useRef<Map<number, () => void>>(new Map());

  useEffect(() => {
    const controller = new AbortController();
    fetchLoginMedia(controller.signal).then((list) => {
      if (list.length > 0) {
        console.log("Media loaded:", list);
        setItems(list);
      } else {
        // Fallback: usar uma imagem padrão se nenhuma mídia estiver configurada
        setItems([
          {
            id: "placeholder",
            type: "image",
            url: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1600&h=900&fit=crop",
          },
        ]);
      }
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      const idx = emblaApi.selectedScrollSnap();
      const item = items[idx];

      // Clean up old listeners
      videoListenersRef.current.forEach((cleanup) => cleanup());
      videoListenersRef.current.clear();

      if (item?.type === "video") {
        const slides = emblaApi.slideNodes();
        const video = slides[idx]?.querySelector(
          "video",
        ) as HTMLVideoElement | null;

        if (video) {
          // Reset and play video
          video.currentTime = 0;
          const playPromise = video.play();

          if (playPromise !== undefined) {
            playPromise.catch((error) => {
              console.error("Video play failed:", error);
              // If autoplay fails, skip to next after 6 seconds
              timeoutRef.current = setTimeout(
                () => emblaApi.scrollNext(),
                6000,
              );
            });
          }

          const handleEnd = () => {
            console.log("Video ended, moving to next");
            emblaApi.scrollNext();
          };

          video.addEventListener("ended", handleEnd);
          videoListenersRef.current.set(idx, () =>
            video.removeEventListener("ended", handleEnd),
          );
        }
      } else {
        // Image: auto-advance after 6 seconds
        timeoutRef.current = setTimeout(() => emblaApi.scrollNext(), 6000);
      }
    };

    onSelect();
    emblaApi.on("select", onSelect);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      videoListenersRef.current.forEach((cleanup) => cleanup());
      videoListenersRef.current.clear();
    };
  }, [emblaApi, items]);

  const handleVideoLoaded = (itemId: string | number) => {
    setLoadedVideos((prev) => new Set(prev).add(itemId));
    console.log("Video loaded:", itemId);
  };

  const handleVideoError = (itemId: string | number, error: any) => {
    console.error("Video error for item", itemId, error);
  };

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 brand-gradient opacity-70" />
      <div className="relative h-full embla" ref={emblaRef}>
        <div className="embla__container flex h-full">
          {items.map((item) => (
            <div
              key={item.id}
              className="embla__slide min-w-0 flex-[0_0_100%] h-full relative"
            >
              {item.type === "image" ? (
                <img
                  src={item.url}
                  alt="Media"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    console.error("Image load error:", item.id);
                  }}
                />
              ) : (
                <>
                  <video
                    key={item.id}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                    preload="metadata"
                    onCanPlay={() => handleVideoLoaded(item.id)}
                    onError={(e) => handleVideoError(item.id, e)}
                    onLoadStart={() => {}}
                  >
                    <source src={item.url} type={item.mime || "video/mp4"} />
                    Your browser does not support the video tag.
                  </video>

                  {/* Loading indicator for videos */}
                  {!loadedVideos.has(item.id) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
