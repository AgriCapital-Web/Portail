import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "../EmptyState";
import { MapPin, ExternalLink } from "lucide-react";

export const MapTab = ({ plantation }: { plantation: any }) => {
  const rawLat = plantation?.latitude ?? plantation?.localisation_gps_lat;
  const rawLng = plantation?.longitude ?? plantation?.localisation_gps_lng;
  const lat = Number(rawLat);
  const lng = Number(rawLng);

  if (rawLat == null || rawLng == null || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return <EmptyState icon={MapPin} title="Coordonnées GPS non renseignées" description="Dès que votre technicien aura relevé les coordonnées GPS depuis le terrain, la carte s'affichera ici." />;
  }

  const bbox = `${Number(lng) - 0.005},${Number(lat) - 0.005},${Number(lng) + 0.005},${Number(lat) + 0.005}`;
  const osmUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
  const gmapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

  return (
    <div className="space-y-3">
      <Card className="overflow-hidden rounded-2xl">
        <CardContent className="p-0">
          <iframe
            src={osmUrl}
            className="w-full h-[380px] border-0"
            title="Localisation plantation"
            loading="lazy"
          />
        </CardContent>
      </Card>
      <Card className="rounded-2xl">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase text-muted-foreground">Coordonnées GPS</p>
            <p className="text-sm font-mono font-bold">{Number(lat).toFixed(6)}, {Number(lng).toFixed(6)}</p>
            {plantation?.village_nom && <p className="text-xs text-muted-foreground">{plantation.village_nom}</p>}
          </div>
          <Button asChild className="btn-brand shrink-0">
            <a href={gmapsUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" /> Google Maps
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
