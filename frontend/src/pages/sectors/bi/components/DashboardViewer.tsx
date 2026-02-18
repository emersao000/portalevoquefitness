import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  models,
  factories,
  service,
  Report,
  IReportEmbedConfiguration,
} from "powerbi-client";
import { Dashboard } from "../hooks/useDashboards";
import { apiFetch } from "@/lib/api";
import confetti from "canvas-confetti";
import {
  Activity,
  AlertCircle,
  ChevronDown,
  Clock,
  Database,
  Layers,
  Loader2,
  Lock,
  Maximize2,
  Minimize2,
  Play,
  RefreshCw,
  Shield,
  Sparkles,
  Loader,
} from "lucide-react";

interface DashboardViewerProps {
  dashboard: Dashboard;
  onError?: (error: string) => void;
  onSuccess?: () => void;
}

export default function DashboardViewer({
  dashboard,
  onError,
  onSuccess,
}: DashboardViewerProps) {
  // Estados da UI
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<string>("initial");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Referências críticas
  const containerRef = useRef<HTMLDivElement | null>(null);
  const embedContainerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const successOverlayRef = useRef<HTMLDivElement | null>(null);
  const powerBiReport = useRef<Report | null>(null);
  const powerBiService = useRef<service.Service | null>(null);

  // Controle de ciclo de vida
  const embedCycleToken = useRef<string>("");
  const lastEmbedReportId = useRef<string>("");
  const isEmbedding = useRef<boolean>(false);
  const embedQueue = useRef<(() => Promise<void>)[]>([]);
  const cleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cache e contadores
  const tokenCache = useRef<{
    [key: string]: { token: string; embedUrl: string; expires: number };
  }>({});
  const retryCount = useRef<number>(0);
  const MAX_RETRIES = 2;
  const RETRY_DELAY = 1000;

  // Logger melhorado
  const logger = useCallback(
    (
      message: string,
      type: "info" | "success" | "error" | "warn" | "debug" = "info",
    ) => {
      const ts = Date.now();
      const prefix = `[PowerBI ${new Date().toLocaleTimeString()}]`;
      if (type === "error") console.error(prefix, message);
      else if (type === "warn") console.warn(prefix, message);
      else console.log(prefix, message);
      return ts;
    },
    [],
  );

  /**
   * Trigger de confetti para sucesso
   */
  const triggerConfetti = useCallback(() => {
    if (!canvasRef.current || !embedContainerRef.current) return;

    const canvas = canvasRef.current;
    const containerRect = embedContainerRef.current.getBoundingClientRect();

    canvas.width = containerRect.width;
    canvas.height = containerRect.height;

    const duration = 2000;
    const animationEnd = Date.now() + duration;

    const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA502", "#FF1744"];
    const randomInRange = (min: number, max: number) =>
      Math.random() * (max - min) + min;

    const animate = () => {
      const timeLeft = animationEnd - Date.now();
      if (timeLeft <= 0) {
        if (successOverlayRef.current) {
          successOverlayRef.current.style.opacity = "0";
          setTimeout(() => {
            if (successOverlayRef.current) {
              successOverlayRef.current.style.display = "none";
            }
          }, 300);
        }
        return;
      }

      const progress = 1 - timeLeft / duration;
      const particleCount = Math.max(0, 50 * (1 - progress));

      confetti({
        particleCount,
        angle: randomInRange(60, 120),
        spread: randomInRange(40, 80),
        origin: { x: randomInRange(0.2, 0.8), y: 1 },
        velocity: randomInRange(8, 20),
        decay: randomInRange(0.85, 0.95),
        scalar: randomInRange(0.5, 1),
        canvas,
        shapes: ["square"],
        colors,
        gravity: 1,
        drift: randomInRange(-0.5, 0.5),
      });

      requestAnimationFrame(animate);
    };

    if (successOverlayRef.current) {
      successOverlayRef.current.style.display = "flex";
      successOverlayRef.current.style.opacity = "1";
    }

    animate();
  }, []);

  /**
   * Garante que o serviço PowerBI está inicializado
   */
  const ensureService = useCallback(() => {
    if (!powerBiService.current) {
      powerBiService.current = new service.Service(
        factories.hpmFactory,
        factories.wpmpFactory,
        factories.routerFactory,
      );
      logger("PowerBI Service inicializado", "debug");
    }
    return powerBiService.current;
  }, [logger]);

  /**
   * Limpa container com segurança total
   */
  const cleanupContainer = useCallback(
    async (cycleToken: string): Promise<void> => {
      if (embedCycleToken.current !== cycleToken) {
        logger("Cleanup cancelado - ciclo diferente", "debug");
        return;
      }

      const container = embedContainerRef.current;
      if (!container) return;

      try {
        const svc = ensureService();

        if (powerBiReport.current) {
          try {
            powerBiReport.current.off("loaded");
            powerBiReport.current.off("rendered");
            powerBiReport.current.off("error");
          } catch (e) {
            // Ignora erros ao remover listeners
          }
        }

        await new Promise((resolve) => requestAnimationFrame(resolve));

        const existingEmbed = svc.get(container);
        if (existingEmbed) {
          logger("Resetando embed existente", "debug");
          svc.reset(container);
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        powerBiReport.current = null;
        logger("Container limpo com sucesso", "debug");
      } catch (e) {
        logger(
          `Erro durante cleanup: ${e instanceof Error ? e.message : String(e)}`,
          "warn",
        );
      }
    },
    [ensureService, logger],
  );

  /**
   * Valida e normaliza a URL de embed
   */
  const validateEmbedUrl = useCallback(
    (url: string): boolean => {
      try {
        if (!url || typeof url !== "string") {
          logger("URL vazia ou inválida", "error");
          return false;
        }

        const trimmed = url.trim();

        if (!trimmed.startsWith("https://")) {
          logger("URL sem HTTPS", "error");
          return false;
        }

        const urlObj = new URL(trimmed);

        const validHosts = ["app.powerbi.com", "powerbi.com"];
        const isValidHost = validHosts.some(
          (host) =>
            urlObj.hostname === host || urlObj.hostname.endsWith(`.${host}`),
        );

        if (!isValidHost) {
          logger(`Host inválido: ${urlObj.hostname}`, "warn");
        }

        logger("URL validada com sucesso", "debug");
        return true;
      } catch (e) {
        logger(
          `Erro ao validar URL: ${e instanceof Error ? e.message : String(e)}`,
          "error",
        );
        return false;
      }
    },
    [logger],
  );

  /**
   * Busca token com cache inteligente
   */
  const fetchEmbedToken = useCallback(
    async (
      cycleToken: string,
    ): Promise<{ token: string; embedUrl: string } | null> => {
      const cacheKey = `${dashboard.report_id}:${dashboard.dataset_id}`;
      const cached = tokenCache.current[cacheKey];

      if (cached && cached.expires > Date.now()) {
        logger("Usando token do cache", "debug");
        return { token: cached.token, embedUrl: cached.embedUrl };
      }

      try {
        logger("Buscando novo token de embed...", "info");

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const response = await apiFetch(
          `/powerbi/embed-token/${dashboard.report_id}?datasetId=${dashboard.dataset_id}`,
          { signal: controller.signal },
        );

        clearTimeout(timeout);

        if (embedCycleToken.current !== cycleToken) {
          logger("Fetch cancelado - ciclo mudou", "debug");
          return null;
        }

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          throw new Error(
            `HTTP ${response.status}: ${errorText || response.statusText}`,
          );
        }

        const data = await response.json();

        if (!data || !data.token || !data.embedUrl) {
          throw new Error("Resposta incompleta do servidor");
        }

        const expiresIn = data.expiresInMs || 3600000;
        const expires = Date.now() + expiresIn - 300000;
        tokenCache.current[cacheKey] = {
          token: data.token,
          embedUrl: data.embedUrl,
          expires,
        };

        logger("Token obtido com sucesso", "success");
        return { token: data.token, embedUrl: data.embedUrl };
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
          logger("Request de token cancelada (timeout)", "error");
        } else {
          logger(
            `Erro ao buscar token: ${e instanceof Error ? e.message : String(e)}`,
            "error",
          );
        }
        return null;
      }
    },
    [dashboard.dataset_id, dashboard.report_id, logger],
  );

  /**
   * Retry com delay progressivo
   */
  const handleRetry = useCallback(() => {
    retryCount.current++;
    const delay = RETRY_DELAY * retryCount.current;

    logger(`Aguardando ${delay}ms antes do retry...`, "info");

    setTimeout(() => {
      embedReport();
    }, delay);
  }, []);

  /**
   * Processo principal de embed com proteção contra race conditions
   */
  const embedReport = useCallback(async (): Promise<void> => {
    const cycleToken = `${Date.now()}-${Math.random()}`;
    embedCycleToken.current = cycleToken;

    if (isEmbedding.current) {
      logger("Embed já em andamento, adicionando à fila", "debug");
      embedQueue.current.push(async () => {
        if (embedCycleToken.current === cycleToken) {
          await embedReport();
        }
      });
      return;
    }

    isEmbedding.current = true;
    setIsLoading(true);
    setIsReady(false);
    setError(null);

    try {
      logger(
        `Iniciando embed: ${dashboard.title} (ciclo: ${cycleToken.slice(0, 8)})`,
        "info",
      );

      // Fase 1: Preparação
      setLoadingPhase("preparing");
      setLoadingProgress(10);

      if (
        lastEmbedReportId.current &&
        lastEmbedReportId.current !== dashboard.report_id
      ) {
        await cleanupContainer(cycleToken);
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      if (embedCycleToken.current !== cycleToken) {
        logger("Embed cancelado - novo ciclo iniciado", "debug");
        return;
      }

      // Fase 2: Autenticação
      setLoadingPhase("authenticating");
      setLoadingProgress(25);

      const tokenData = await fetchEmbedToken(cycleToken);
      if (!tokenData) {
        throw new Error("Falha ao obter token de embed");
      }

      if (embedCycleToken.current !== cycleToken) {
        logger("Embed cancelado após obter token", "debug");
        return;
      }

      // Fase 3: Validação
      setLoadingPhase("validating");
      setLoadingProgress(40);

      if (!validateEmbedUrl(tokenData.embedUrl)) {
        throw new Error("URL de embed inválida");
      }

      const embedContainer = embedContainerRef.current;
      if (!embedContainer) {
        throw new Error("Container de embed não encontrado");
      }

      // Fase 4: Configuração
      setLoadingPhase("configuring");
      setLoadingProgress(55);

      const embedConfig: IReportEmbedConfiguration = {
        type: "report",
        id: dashboard.report_id,
        embedUrl: tokenData.embedUrl,
        accessToken: tokenData.token,
        tokenType: models.TokenType.Embed,
        permissions: models.Permissions.All,
        settings: {
          filterPaneEnabled: true,
          navContentPaneEnabled: true,
          bars: {
            statusBar: {
              visible: true,
            },
          },
          layoutType: models.LayoutType.Custom,
          customLayout: {
            displayOption: models.DisplayOption.FitToWidth,
          },
          background: models.BackgroundType.Default,
          localeSettings: {
            language: "pt-BR",
            formatLocale: "pt-BR",
          },
        },
      };

      // Fase 5: Renderização
      setLoadingPhase("rendering");
      setLoadingProgress(70);

      embedContainer.style.display = "block";
      embedContainer.style.visibility = "visible";
      embedContainer.style.position = "relative";
      embedContainer.style.width = "100%";
      embedContainer.style.height = "100%";
      embedContainer.style.overflow = "visible";

      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
      }

      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
      }

      const svc = ensureService();

      svc.reset(embedContainer);
      await new Promise((resolve) => setTimeout(resolve, 100));

      logger("[PowerBI] Embed config:", "debug");
      const report = svc.embed(embedContainer, embedConfig) as Report;

      powerBiReport.current = report;
      lastEmbedReportId.current = dashboard.report_id;

      let isRendered = false;
      const renderTimeout = setTimeout(() => {
        if (!isRendered && embedCycleToken.current === cycleToken) {
          logger("Timeout de renderização - tentando retry", "warn");
          handleRetry();
        }
      }, 30000);

      report.on("loaded", () => {
        if (embedCycleToken.current !== cycleToken) return;
        logger("[PowerBI] Loaded ✅", "success");
        setLoadingProgress(85);
        setLoadingPhase("finalizing");

        // Safety timeout: if "rendered" event doesn't fire within 2 seconds after loaded
        safetyTimeoutRef.current = setTimeout(() => {
          if (embedCycleToken.current === cycleToken && !isRendered) {
            logger(
              "[PowerBI] Forcing loading completion after loaded event timeout",
              "warn",
            );
            isRendered = true;
            clearTimeout(renderTimeout);
            setLoadingProgress(100);
            setTimeout(() => {
              if (embedCycleToken.current === cycleToken) {
                setIsLoading(false);
                setIsReady(true);
                setError(null);
                retryCount.current = 0;
                if (onSuccess) onSuccess();
              }
            }, 300);
          }
        }, 2000);
      });

      report.on("rendered", () => {
        if (embedCycleToken.current !== cycleToken) return;

        isRendered = true;
        clearTimeout(renderTimeout);

        // Limpar o safety timeout quando renderizado
        if (safetyTimeoutRef.current) {
          clearTimeout(safetyTimeoutRef.current);
          safetyTimeoutRef.current = null;
        }

        logger("[PowerBI] Rendered 🎉", "success");
        setLoadingProgress(100);

        setTimeout(() => {
          if (embedCycleToken.current === cycleToken) {
            setIsLoading(false);
            setIsReady(true);
            setError(null);
            retryCount.current = 0;
            triggerConfetti();
            if (onSuccess) onSuccess();
          }
        }, 300);
      });

      report.on("error", (event: any) => {
        if (embedCycleToken.current !== cycleToken) return;

        clearTimeout(renderTimeout);
        if (safetyTimeoutRef.current) {
          clearTimeout(safetyTimeoutRef.current);
          safetyTimeoutRef.current = null;
        }

        const errorMessage =
          event?.detail?.message || event?.message || "Erro desconhecido";

        logger(`[PowerBI] Error: ${errorMessage}`, "error");

        if (retryCount.current < MAX_RETRIES) {
          logger(`Tentativa ${retryCount.current + 1}/${MAX_RETRIES}`, "warn");
          handleRetry();
        } else {
          setError(errorMessage);
          setIsLoading(false);
          if (onError) onError(errorMessage);
        }
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger(`[PowerBI] Embed failed: ${errorMessage}`, "error");

      if (embedCycleToken.current === cycleToken) {
        if (retryCount.current < MAX_RETRIES) {
          handleRetry();
        } else {
          setError(errorMessage);
          setIsLoading(false);
          setIsReady(false);
          if (onError) onError(errorMessage);
        }
      }
    } finally {
      isEmbedding.current = false;

      if (embedQueue.current.length > 0) {
        const nextEmbed = embedQueue.current.shift();
        if (nextEmbed) {
          setTimeout(nextEmbed, 100);
        }
      }
    }
  }, [
    dashboard,
    cleanupContainer,
    fetchEmbedToken,
    validateEmbedUrl,
    ensureService,
    logger,
    triggerConfetti,
    onSuccess,
    onError,
    handleRetry,
  ]);

  /**
   * Effect principal - detecta mudança de dashboard
   * CORRIGIDO: Removidas dependências que causavam loop
   */
  useEffect(() => {
    if (dashboard.report_id !== lastEmbedReportId.current) {
      logger(`Dashboard alterado: ${dashboard.title}`, "info");
      retryCount.current = 0;

      const timeoutId = setTimeout(() => {
        embedReport();
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [dashboard.report_id]); // ✅ APENAS dashboard.report_id

  /**
   * Cleanup no unmount
   */
  useEffect(() => {
    return () => {
      const cycleToken = embedCycleToken.current;
      embedCycleToken.current = "";

      (async () => {
        await cleanupContainer(cycleToken);
      })();

      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
      }

      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
      }
    };
  }, [cleanupContainer]);

  /**
   * Gerenciamento de fullscreen
   */
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(
        Boolean(
          document.fullscreenElement ||
          (document as any).webkitFullscreenElement ||
          (document as any).mozFullScreenElement,
        ),
      );
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange,
      );
      document.removeEventListener(
        "mozfullscreenchange",
        handleFullscreenChange,
      );
    };
  }, []);

  const toggleFullscreen = async () => {
    const doc: any = document;
    const isFull =
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement;

    try {
      if (!isFull && containerRef.current) {
        const el: any = containerRef.current;
        if (el.requestFullscreen) await el.requestFullscreen();
        else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
        else if (el.mozRequestFullScreen) await el.mozRequestFullScreen();
      } else {
        if (doc.exitFullscreen) await doc.exitFullscreen();
        else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
        else if (doc.mozCancelFullScreen) await doc.mozCancelFullScreen();
      }
    } catch (error) {
      logger(`Erro ao alternar fullscreen: ${error}`, "error");
    }
  };

  const formatTimestamp = (ts: number) => {
    return new Date(ts).toLocaleTimeString("pt-BR", { hour12: false });
  };

  const getPhaseIcon = () => {
    const icons = {
      preparing: <Loader2 className="animate-spin" />,
      authenticating: <Lock />,
      validating: <Shield />,
      configuring: <Layers />,
      rendering: <Activity />,
      finalizing: <Sparkles />,
    };
    return icons[loadingPhase as keyof typeof icons] || <Database />;
  };

  const getPhaseText = () => {
    const texts = {
      preparing: "Preparando ambiente...",
      authenticating: "Autenticando...",
      validating: "Validando configurações...",
      configuring: "Configurando dashboard...",
      rendering: "Renderizando visualizações...",
      finalizing: "Finalizando carregamento...",
    };
    return texts[loadingPhase as keyof typeof texts] || "Iniciando...";
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="bi-dashboard-header px-4 py-2 border-b bg-white flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-gray-900">
            {dashboard.title}
          </h1>
          <p className="text-xs text-gray-600">{dashboard.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            aria-label={
              isFullscreen ? "Sair da tela cheia" : "Entrar em tela cheia"
            }
            onClick={toggleFullscreen}
            className="bi-control-button"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 bi-viewer-outer" ref={containerRef}>
        {isLoading && !isReady && (
          <div className="bi-loading-overlay">
            <div className="flex flex-col items-center gap-3">
              <Loader className="w-6 h-6 animate-spin text-primary" />
              <p className="text-sm text-gray-600">
                {loadingPhase === "authenticating"
                  ? "Logando..."
                  : getPhaseText()}
              </p>
              <div className="w-32 bg-gray-200 h-1.5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${loadingProgress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {error && !isLoading && (
          <div className="bi-loading-overlay">
            <div className="flex flex-col items-center gap-3">
              <div className="text-4xl">⚠️</div>
              <p className="text-sm text-red-600">{error}</p>
              <button
                onClick={() => {
                  retryCount.current = 0;
                  embedReport();
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        )}

        <div
          className="bi-embed-card"
          ref={embedContainerRef}
          style={{
            width: "100%",
            height: "100%",
            display: error ? "none" : "block",
            position: "relative",
            overflow: "visible",
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              pointerEvents: "none",
              zIndex: 999,
            }}
          />

          <div
            ref={successOverlayRef}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              display: "none",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              pointerEvents: "none",
              transition: "opacity 0.3s ease-out",
              opacity: 0,
            }}
          >
            <div
              style={{
                fontSize: "48px",
                fontWeight: "bold",
                color: "rgba(0, 0, 0, 0.7)",
                textShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
              }}
            >
              Sucesso!
            </div>
          </div>
        </div>

        {isFullscreen && (
          <button
            onClick={toggleFullscreen}
            className="bi-fullscreen-toggle"
            aria-label="Sair da tela cheia"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}