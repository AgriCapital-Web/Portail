import { lazy, Suspense, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, LayoutGrid, ListChecks, Sprout, Camera, FileText, MapPin, FileBarChart2, MessageSquare } from "lucide-react";
import logoWhiteBg from "@/assets/logo-white-bg.png";
import { PlantationSelector } from "@/components/plantation/PlantationSelector";
const OverviewTab = lazy(() => import("@/components/plantation/tabs/OverviewTab").then((m) => ({ default: m.OverviewTab })));
const ProgressionTab = lazy(() => import("@/components/plantation/tabs/ProgressionTab").then((m) => ({ default: m.ProgressionTab })));
const TechniqueTab = lazy(() => import("@/components/plantation/tabs/TechniqueTab").then((m) => ({ default: m.TechniqueTab })));
const MediasTab = lazy(() => import("@/components/plantation/tabs/MediasTab").then((m) => ({ default: m.MediasTab })));
const DocumentsTab = lazy(() => import("@/components/plantation/tabs/DocumentsTab").then((m) => ({ default: m.DocumentsTab })));
const MapTab = lazy(() => import("@/components/plantation/tabs/MapTab").then((m) => ({ default: m.MapTab })));
const RapportsTab = lazy(() => import("@/components/plantation/tabs/RapportsTab").then((m) => ({ default: m.RapportsTab })));
const MessagerieTab = lazy(() => import("@/components/plantation/tabs/MessagerieTab").then((m) => ({ default: m.MessagerieTab })));
import { ProductionTab } from "@/components/plantation/tabs/ProductionTab";
import { IntrantsTab } from "@/components/plantation/tabs/IntrantsTab";
import { RevenusTab } from "@/components/plantation/tabs/RevenusTab";

interface Props {
  client: any;
  plantations: any[];
  initialPlantationId?: string;
  onPlantationChange?: (id: string) => void;
  onBack: () => void;
}

const ClientPlantationHub = ({ client, plantations, initialPlantationId, onPlantationChange, onBack }: Props) => {
  const initialId = initialPlantationId && plantations.some((p) => p.id === initialPlantationId)
    ? initialPlantationId
    : plantations[plantations.length - 1]?.id || plantations[0]?.id;
  const [selectedId, setSelectedId] = useState<string>(initialId);
  const plantation = useMemo(() => plantations.find((p) => p.id === selectedId) || plantations[0], [plantations, selectedId]);
  const isPalmTerroir = String(client?.formule_code || "").startsWith("PALMTERROIR");
  const formuleLabel = client?.formule_nom || client?.formule_code || client?.famille_offre || client?.offres?.nom || "Formule";

  const baseTabs = [
    { value: "overview", icon: LayoutGrid, label: "Vue" },
    { value: "progression", icon: ListChecks, label: "Progression" },
    { value: "technique", icon: Sprout, label: "Technique" },
    { value: "medias", icon: Camera, label: "Médias" },
    { value: "documents", icon: FileText, label: "Documents" },
    { value: "carte", icon: MapPin, label: "Carte" },
    { value: "rapports", icon: FileBarChart2, label: "Rapports" },
    { value: "messagerie", icon: MessageSquare, label: "Messagerie" },
  ];
  const tabs = baseTabs;

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f7f4] text-[#24352D]">
      <header className="px-4 pt-4 pb-3 sticky top-0 z-50 shadow-[0_2px_14px_rgba(0,0,0,0.12)]" style={{ background: "linear-gradient(180deg, #00643C 0%, #004d2e 100%)" }}>
        <div className="container mx-auto w-full max-w-[1400px]">
          <div className="flex items-center justify-between gap-2 mb-3">
            <Button variant="ghost" size="icon" onClick={onBack} className="text-white hover:bg-white/15 h-9 w-9">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="bg-white rounded-lg p-1"><img src={logoWhiteBg} alt="AgriCapital" className="h-9 object-contain" /></div>
            <div className="w-9" />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs uppercase text-white/70 tracking-wider">Ma Plantation</p>
              <h1 className="text-xl sm:text-2xl font-bold text-white break-words leading-snug">{plantation?.nom_plantation || plantation?.id_unique || "—"}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap"><Badge className="bg-white/10 border-white/20 text-white text-[9px]">{formuleLabel}</Badge>{isPalmTerroir && <span className="text-xs text-white/80">Encadrement & suivi après mise en terre</span>}</div>
            </div>
            <div className="w-full sm:w-56 min-w-0 sm:shrink-0">
              <PlantationSelector plantations={plantations} selectedId={selectedId} onChange={(id) => { setSelectedId(id); onPlantationChange?.(id); }} />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-3 sm:px-4 lg:px-8 w-full max-w-[1400px] py-4 lg:py-6 min-h-[calc(100svh-150px)]">
        {isPalmTerroir && <div className="mb-4 rounded-2xl border border-[#B9D8C8] bg-white p-4 sm:p-5 text-base leading-relaxed text-[#405149] shadow-sm"><strong className="text-[#00643C]">PalmTerroir :</strong> après la mise en terre, les travaux réguliers d’entretien et les intrants restent à la charge du client. AgriCapital assure l’encadrement, les recommandations et le suivi technique.</div>}
        <Tabs defaultValue="overview" className="w-full min-h-[520px]">
          <TabsList className="w-full flex overflow-x-auto no-scrollbar h-auto p-1.5 bg-white border border-[#D9E2DD] shadow-sm backdrop-blur rounded-xl mb-4 justify-start gap-1">
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="flex-shrink-0 gap-2 px-3 py-2 text-sm font-medium text-[#52615A] hover:text-[#24352D] data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-sm">
                <t.icon className="h-3.5 w-3.5" />
                <span>{t.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview" className="min-h-[500px]"><Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Chargement de la vue d’ensemble…</div>}><OverviewTab plantation={plantation} client={client} /></Suspense></TabsContent>
          <TabsContent value="progression" className="min-h-[500px]"><Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Chargement de la progression…</div>}><ProgressionTab plantation={plantation} client={client} /></Suspense></TabsContent>
          <TabsContent value="technique" className="min-h-[500px]"><Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Chargement du suivi technique…</div>}><TechniqueTab plantation={plantation} /></Suspense></TabsContent>
          <TabsContent value="medias" className="min-h-[500px]"><Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Chargement des photos…</div>}><MediasTab plantation={plantation} /></Suspense></TabsContent>
          <TabsContent value="documents" className="min-h-[500px]"><Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Chargement des documents…</div>}><DocumentsTab plantation={plantation} client={client} /></Suspense></TabsContent>
          <TabsContent value="carte" className="min-h-[500px]"><Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Chargement de la carte…</div>}><MapTab plantation={plantation} /></Suspense></TabsContent>
          <TabsContent value="rapports" className="min-h-[500px]"><Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Chargement des rapports…</div>}><RapportsTab plantation={plantation} /></Suspense></TabsContent>
          <TabsContent value="messagerie" className="min-h-[500px]"><Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Chargement de la messagerie…</div>}><MessagerieTab client={client} plantation={plantation} /></Suspense></TabsContent>
        </Tabs>
      </main>

      <footer className="border-t bg-card py-3">
        <p className="text-[10px] text-muted-foreground text-center">© {new Date().getFullYear()} AgriCapital · client.agricapital.ci</p>
      </footer>
    </div>
  );
};

export default ClientPlantationHub;
