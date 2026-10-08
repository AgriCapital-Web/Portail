import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "../EmptyState";
import { Camera, Play, Maximize2 } from "lucide-react";

export const MediasTab = ({ plantation }: { plantation: any }) => {
  const medias: any[] = plantation?.medias || [];
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
      <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-3 [column-fill:_balance]">
        {medias.map((m, i) => {
          const isVideo = m.type === "video" || m.media_type === "video";
          return (
            <Card
              key={m.id || i}
              className="mb-3 break-inside-avoid overflow-hidden rounded-2xl border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg group"
            >
              <CardContent className="p-0">
                <button
                  type="button"
                  onClick={() => setSelected(m)}
                  className="relative block w-full overflow-hidden text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  aria-label={m.commentaire || m.description || m.operation || "Ouvrir le média"}
                >
                  {isVideo ? (
                    <div className="aspect-video w-full bg-slate-950 flex items-center justify-center">
                      <span className="h-12 w-12 rounded-full bg-white/15 backdrop-blur flex items-center justify-center">
                        <Play className="h-6 w-6 text-white fill-white ml-0.5" />
                      </span>
                    </div>
                  ) : (
                    <img
                      src={m.url}
                      alt={m.commentaire || m.description || m.operation || "Photo de suivi terrain"}
                      loading={i < 4 ? "eager" : "lazy"}
                      className="block h-auto w-full object-cover transition duration-500 group-hover:scale-[1.025]"
                    />
                  )}

                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent px-3 pb-3 pt-10">
                    <div className="flex items-end justify-between gap-2">
                      <div className="min-w-0">
                        {(m.operation || m.titre) && (
                          <p className="text-xs font-semibold text-white truncate">{m.operation || m.titre}</p>
                        )}
                        {(m.commentaire || m.description) && (
                          <p className="mt-0.5 text-[10px] text-white/80 line-clamp-2">
                            {m.commentaire || m.description}
                          </p>
                        )}
                      </div>
                      <Maximize2 className="h-4 w-4 shrink-0 text-white/80 opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                  </div>
                </button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-6xl rounded-2xl p-2 sm:p-3 bg-black/95 border-white/10">
          <DialogTitle className="sr-only">
            {selected?.commentaire || selected?.description || selected?.operation || "Média"}
          </DialogTitle>
          {selected && (selected.type === "video" || selected.media_type === "video") ? (
            <div className="aspect-video w-full rounded-xl bg-black flex items-center justify-center text-white/70 text-sm">
              <div className="flex flex-col items-center gap-2">
                <Play className="h-10 w-10" />
                <span>Vidéo de suivi terrain</span>
              </div>
            </div>
          ) : (
            <img
              src={selected.url}
              alt={selected.commentaire || selected.description || selected.operation || "Photo de suivi terrain"}
              className="mx-auto max-h-[82vh] w-auto max-w-full rounded-xl object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
