import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "../EmptyState";
import { Camera, Play, Maximize2, X } from "lucide-react";

export const MediasTab = ({ plantation }: { plantation: any }) => {
  const medias: any[] = Array.isArray(plantation?.medias) ? plantation.medias : [];
  const [selected, setSelected] = useState<any | null>(null);

  if (medias.length === 0) {
    return (
      <EmptyState
        icon={Camera}
        title="Aucune photo ni vidéo pour l'instant"
        description="Vos techniciens terrain publieront ici les photos et vidéos de chaque opération (défrichage, planting, entretien...)."
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {medias.map((m, i) => {
          const isVideo = m?.type === "video" || m?.media_type === "video";
          const url = typeof m?.url === "string" ? m.url : "";
          const label = m?.commentaire || m?.description || m?.operation || m?.titre || "Photo de suivi terrain";

          return (
            <Card key={m?.id || i} className="overflow-hidden rounded-2xl border bg-card shadow-sm group">
              <CardContent className="p-0">
                <button
                  type="button"
                  onClick={() => setSelected(m)}
                  className="relative block w-full aspect-square overflow-hidden text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label="Ouvrir le média"
                >
                  {isVideo ? (
                    <div className="h-full w-full bg-slate-950 flex items-center justify-center">
                      <span className="h-12 w-12 rounded-full bg-white/15 flex items-center justify-center">
                        <Play className="h-6 w-6 text-white fill-white" />
                      </span>
                    </div>
                  ) : url ? (
                    <img
                      src={url}
                      alt={label}
                      loading={i < 6 ? "eager" : "lazy"}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="h-full w-full bg-muted flex items-center justify-center">
                      <Camera className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}

                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-2.5 pt-10">
                    <div className="flex items-end justify-between gap-2">
                      <p className="text-[10px] sm:text-xs font-medium text-white truncate">{label}</p>
                      <Maximize2 className="h-3.5 w-3.5 shrink-0 text-white/80" />
                    </div>
                  </div>
                </button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/90 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelected(null)}
        >
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="absolute right-3 top-3 z-10 h-10 w-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>

          {selected?.type === "video" || selected?.media_type === "video" ? (
            <div className="max-w-4xl w-full aspect-video rounded-xl bg-black flex items-center justify-center text-white/70">
              <Play className="h-10 w-10" />
            </div>
          ) : selected?.url ? (
            <img
              src={selected.url}
              alt={selected.commentaire || selected.description || selected.operation || "Média"}
              className="max-h-[90vh] max-w-full w-auto rounded-xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          ) : null}
        </div>
      )}
    </>
  );
};
