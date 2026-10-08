import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "../EmptyState";
import { FileBarChart2, Camera, Play, Maximize2 } from "lucide-react";
import { useState } from "react";

export const RapportsTab = ({ plantation }: { plantation: any }) => {
  const rapports: any[] = Array.isArray(plantation?.rapports_visites)
    ? plantation.rapports_visites
    : Array.isArray(plantation?.rapports) ? plantation.rapports : [];
  const [selected, setSelected] = useState<any | null>(null);

  if (rapports.length === 0) {
    return <EmptyState icon={FileBarChart2} title="Aucun rapport publié pour l'instant" description="Les rapports terrain validés par AgriCapital apparaîtront ici." />;
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        {rapports.map((r, i) => {
          const medias = Array.isArray(r?.medias) ? r.medias : [];
          return (
            <Card key={r?.id || i} className="rounded-2xl overflow-hidden border border-[#DDE5E0] bg-card shadow-sm h-full">
              <CardContent className="p-3 sm:p-4 space-y-3 h-full flex flex-col">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-gold/10 flex items-center justify-center shrink-0">
                    <FileBarChart2 className="h-4 w-4 sm:h-5 sm:w-5 text-gold-dark" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-[#26362E]">{r?.titre || "Rapport terrain"}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[9px]">Validé</Badge>
                      {r?.date_visite && <span className="text-[10px] text-[#5F6D65]">{new Date(r.date_visite).toLocaleDateString("fr-FR")}</span>}
                    </div>
                  </div>
                </div>

                {r?.etat_plantation && (
                  <div className="rounded-xl bg-[#F5F7F6] border border-[#E2E9E5] p-3">
                    <p className="text-[10px] uppercase text-[#5F6D65] font-medium mb-1">État de la plantation</p>
                    <p className="text-sm font-medium text-[#26362E]">{r.etat_plantation}</p>
                  </div>
                )}

                {r?.contenu && (
                  <div>
                    <p className="text-[10px] uppercase text-muted-foreground mb-1">Message de l'équipe technique</p>
                    <p className="text-sm leading-relaxed text-[#35463E]">{r.contenu}</p>
                  </div>
                )}

                {medias.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {medias.map((m: any, mi: number) => {
                      const isVideo = m?.media_type === "video" || m?.type === "video";
                      return (
                        <button
                          key={m?.id || mi}
                          type="button"
                          onClick={() => setSelected(m)}
                          className="relative aspect-square overflow-hidden rounded-xl border bg-muted group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                          {m?.url && isVideo ? (
                            <div className="h-full w-full bg-black flex items-center justify-center">
                              <Play className="h-7 w-7 text-white fill-white" />
                            </div>
                          ) : m?.url ? (
                            <img src={m.url} alt={m.description || "Photo terrain"} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading={mi < 6 ? "eager" : "lazy"} />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center"><Camera className="h-6 w-6 text-muted-foreground" /></div>
                          )}
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-6">
                            <div className="flex justify-between items-end gap-1">
                              <span className="text-[9px] text-white truncate">{m?.description || m?.nom_fichier || "Média terrain"}</span>
                              <Maximize2 className="h-3 w-3 text-white/80 shrink-0" />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {r?.prochaine_intervention && (
                  <p className="text-xs text-[#5F6D65] mt-auto">Prochaine intervention prévue : {new Date(r.prochaine_intervention).toLocaleDateString("fr-FR")}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selected && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/90 p-3 sm:p-6" role="dialog" aria-modal="true" onClick={() => setSelected(null)}>
          <button type="button" onClick={() => setSelected(null)} className="absolute right-3 top-3 h-10 w-10 rounded-full bg-white/10 text-white flex items-center justify-center" aria-label="Fermer">×</button>
          {selected?.url && (selected?.media_type === "video" || selected?.type === "video") ? (
            <video src={selected.url} controls className="max-h-[90vh] max-w-full rounded-xl" onClick={(e) => e.stopPropagation()} />
          ) : selected?.url ? (
            <img src={selected.url} alt={selected.description || "Média terrain"} className="max-h-[90vh] max-w-full rounded-xl object-contain" onClick={(e) => e.stopPropagation()} />
          ) : null}
        </div>
      )}
    </>
  );
};
