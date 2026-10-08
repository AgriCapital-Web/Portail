import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "../EmptyState";
import { MapPin, ExternalLink, LocateFixed } from "lucide-react";
import { CircleMarker, MapContainer, Popup, TileLayer, ZoomControl, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const MapViewportFix = () => {
  const map = useMap();

  useEffect(() => {
    const timer = window.setTimeout(() => map.invalidateSize(), 80);
    return () => window.clearTimeout(timer);
  }, [map]);

  return null;
};

export const MapTab = ({ plantation }: { plantation: any }) => {
  const lat = Number(plantation?.latitude ?? plantation?.localisation_gps_lat);
  const lng = Number(plantation?.longitude ?? plantation?.localisation_gps_lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return (
      <EmptyState
        icon={MapPin}
        title="Coordonnées GPS non renseignées"
        description="Dès que votre technicien aura relevé les coordonnées GPS depuis le terrain, la carte s'affichera ici."
      />
    );
  }

  const gmapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

  return (
    <div className="space-y-3">
      <Card className="overflow-hidden rounded-2xl border shadow-sm">
        <CardContent className="p-0">
          <div className="relative h-[320px] sm:h-[400px] lg:h-[460px] w-full">
            <MapContainer
              center={[lat, lng]}
              zoom={15}
              minZoom={5}
              maxZoom={19}
              scrollWheelZoom
              zoomControl={false}
              className="h-full w-full z-0"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <ZoomControl position="topright" />
              <MapViewportFix />
              <CircleMarker
                center={[lat, lng]}
                radius={10}
                pathOptions={{
                  color: "#ffffff",
                  weight: 3,
                  fillColor: "#00643C",
                  fillOpacity: 0.95,
                }}
              >
                <Popup>
                  <div className="min-w-[180px]">
                    <p className="font-semibold text-sm">
                      {plantation?.nom_plantation || plantation?.nom || "Plantation AgriCapital"}
                    </p>
                    {plantation?.village_nom && (
                      <p className="mt-1 text-xs text-slate-600">{plantation.village_nom}</p>
                    )}
                    <p className="mt-1 text-xs font-mono text-slate-500">
                      {lat.toFixed(6)}, {lng.toFixed(6)}
                    </p>
                  </div>
                </Popup>
              </CircleMarker>
            </MapContainer>

            <div className="absolute left-3 top-3 z-[1000] rounded-xl bg-white/95 px-3 py-2 shadow-md backdrop-blur">
              <div className="flex items-center gap-2">
                <LocateFixed className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Localisation</p>
                  <p className="text-xs font-semibold text-foreground">
                    {plantation?.village_nom || plantation?.localite || "Parcelle"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Coordonnées GPS</p>
            <p className="text-sm font-mono font-bold">{lat.toFixed(6)}, {lng.toFixed(6)}</p>
            {plantation?.village_nom && (
              <p className="text-xs text-muted-foreground">{plantation.village_nom}</p>
            )}
          </div>
          <Button asChild className="btn-brand shrink-0 w-full sm:w-auto">
            <a href={gmapsUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" /> Ouvrir dans Google Maps
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
