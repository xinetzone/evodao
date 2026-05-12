// EvoDao — Image Output component (terminal-themed)
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, DownloadCloud, Loader, AlertCircle, ImageIcon } from "lucide-react";
import { GeneratedImage } from "@/hooks/useAIImage";
import { cn } from "@/lib/utils";

interface ImageOutputProps {
  images: GeneratedImage[];
  isLoading: boolean;
  isSubmitting: boolean;
  isPolling: boolean;
  error: string | null;
  taskId: string | null;
  onDownload: (index: number) => Promise<void>;
  onDownloadAll: () => Promise<void>;
}

export function ImageOutput({
  images,
  isLoading,
  isSubmitting,
  isPolling,
  error,
  taskId,
  onDownload,
  onDownloadAll,
}: ImageOutputProps) {
  const { t } = useTranslation();
  const [downloadingIndex, setDownloadingIndex] = useState<number | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);

  const handleDownload = async (index: number) => {
    setDownloadingIndex(index);
    try { await onDownload(index); } finally { setDownloadingIndex(null); }
  };

  const handleDownloadAll = async () => {
    setDownloadingAll(true);
    try { await onDownloadAll(); } finally { setDownloadingAll(false); }
  };

  if (!isLoading && !error && images.length === 0) return null;

  return (
    <div className="animate-fade-in rounded border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-card/80">
        <ImageIcon className="w-3.5 h-3.5 text-primary/70" />
        <span className="text-[10px] font-bold tracking-widest text-primary/70 uppercase">
          {t("imageGen.title")}
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-[9px] text-muted-foreground/50 tracking-widest font-mono">
          <span className="px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary/60">
            GPT IMAGE 2
          </span>
          {taskId && (
            <span className="truncate max-w-[120px]" title={taskId}>
              {t("imageGen.taskId")}: {taskId.slice(0, 12)}…
            </span>
          )}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Loading */}
        {isLoading && (
          <div className="flex items-center gap-3 py-2">
            {isSubmitting ? (
              <>
                <Loader className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />
                <span className="text-xs text-primary/70 tracking-wider">
                  {t("imageGen.submitting")}
                </span>
              </>
            ) : isPolling ? (
              <>
                <div className="flex gap-1 shrink-0">
                  {[0, 150, 300].map((delay) => (
                    <span
                      key={delay}
                      className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </div>
                <span className="text-xs text-primary/70 tracking-wider">
                  {t("imageGen.generating")}
                </span>
              </>
            ) : null}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 px-4 py-3 rounded border border-destructive/40 bg-destructive/10">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-destructive/80">{error}</p>
          </div>
        )}

        {/* Images grid */}
        {images.length > 0 && (
          <div className="space-y-3">
            {/* Batch download */}
            {images.length > 1 && (
              <div className="flex justify-end">
                <button
                  onClick={handleDownloadAll}
                  disabled={downloadingAll}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold tracking-widest rounded border transition-all",
                    downloadingAll
                      ? "border-primary/20 text-primary/40 cursor-not-allowed"
                      : "border-primary/30 text-primary/60 hover:border-primary hover:text-primary hover:bg-primary/5"
                  )}
                >
                  {downloadingAll
                    ? <Loader className="w-3 h-3 animate-spin" />
                    : <DownloadCloud className="w-3 h-3" />}
                  {t("imageGen.downloadAll", { count: images.length })}
                </button>
              </div>
            )}

            <div className={cn(
              "grid gap-3",
              images.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"
            )}>
              {images.map((img, index) => (
                <div
                  key={index}
                  className="group relative rounded overflow-hidden border border-border/60 bg-background"
                >
                  <img
                    src={img.url}
                    alt={`${t("imageGen.imageAlt")} ${index + 1}`}
                    className="w-full object-cover"
                    crossOrigin="anonymous"
                  />
                  {/* Download overlay */}
                  <div className="absolute inset-0 bg-background/0 group-hover:bg-background/30 transition-all duration-200" />
                  <button
                    onClick={() => handleDownload(index)}
                    disabled={downloadingIndex === index}
                    className={cn(
                      "absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 text-[9px] font-bold tracking-widest rounded border transition-all",
                      "opacity-0 group-hover:opacity-100",
                      downloadingIndex === index
                        ? "border-primary/20 text-primary/40 bg-background/80 cursor-not-allowed"
                        : "border-primary/50 text-primary bg-background/90 hover:bg-background"
                    )}
                  >
                    {downloadingIndex === index
                      ? <Loader className="w-2.5 h-2.5 animate-spin" />
                      : <Download className="w-2.5 h-2.5" />}
                    {t("imageGen.download")}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
