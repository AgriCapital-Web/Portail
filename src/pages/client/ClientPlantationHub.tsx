import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import PortalNotificationCenter from "@/components/client/PortalNotificationCenter";
import { canShowPayments } from "@/utils/portalRoles";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, LayoutGrid, ListChecks, Sprout, Camera, FileText, MapPin, FileBarChart2, MessageSquare } from "lucide-react";
import logoWhiteBg from "@/assets/logo-white-bg.png";
import { PlantationSelector } from "@/components/plantation/PlantationSelector";
import { OverviewTab } from "@/components/plantation/tabs/OverviewTab";
import { ProgressionTab } from "@/components/plantation/tabs/ProgressionTab";
import { TechniqueTab } from "@/components/plantation/tabs/TechniqueTab";
import { MediasTab } from "@/components/plantation/tabs/MediasTab";
import { DocumentsTab } from "@/components/plantation/tabs/DocumentsTab";
import { MapTab } from "@/components/plantation/tabs/MapTab";
import { RapportsTab } from "@/components/plantation/tabs/RapportsTab";
import { MessagerieTab } from "@/components/plantation/tabs/MessagerieTab";
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
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") === "messagerie" ? "messagerie" : "overview");
  useEffect(() => { if (initialPlantationId) setSelectedId(initialPlantationId); }, [initialPlantationId]);
  useEffect(() => { if (searchParams.get("tab") === "messagerie") setActiveTab("messagerie"); }, [searchParams]);
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
    <div className="portal-shell min-h-screen flex flex-col" >
      <header className="portal-header px-4 py-4" >
        <div className="container mx-auto w-full max-w-[1400px]">
          <div className="flex items-center justify-between gap-2 mb-3">
            <Button variant="ghost" size="icon" onClick={onBack} className="text-primary-foreground hover:bg-primary-foreground/15 h-9 w-9">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="bg-card rounded-lg p-1"><img src={logoWhiteBg} alt="AgriCapital" className="h-9 object-contain" /></div>
            <PortalNotificationCenter compact />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs uppercase text-primary-foreground/60 tracking-wider">Ma Plantation</p>
              <h1 className="text-lg font-bold text-primary-foreground break-words">{plantation?.nom_plantation || plantation?.id_unique || "—"}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap"><Badge className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground text-xs">{formuleLabel}</Badge>{isPalmTerroir && <span className="text-xs text-primary-foreground/70">Encadrement & suivi après mise en terre</span>}</div>
            </div>
            <div className="w-full sm:w-64 sm:shrink-0">
              <PlantationSelector plantations={plantations} selectedId={selectedId} onChange={(id) => { setSelectedId(id); onPlantationChange?.(id); }} />
            </div>
          </div>
        </div>
      </header>

      <main className="plantation-content client-page-content flex-1 container mx-auto px-3 sm:px-4 lg:px-8 w-full max-w-[1400px] py-4 lg:py-6 min-h-[calc(100svh-150px)]">
        {isPalmTerroir && canShowPayments(client) && <div className="mb-4 rounded-2xl border border-primary/15 bg-primary/5 p-4 text-sm text-muted-foreground"><strong className="text-primary">PalmTerroir :</strong> après la mise en terre, les travaux réguliers d’entretien et les intrants restent à la charge du client. AgriCapital assure l’encadrement, les recommandations et le suivi technique.</div>}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full min-h-[520px]">
          <TabsList className="w-full flex overflow-x-auto hide-scrollbar h-auto p-1 bg-card backdrop-blur rounded-xl mb-4 justify-start lg:justify-center">
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="flex-shrink-0 gap-2 px-3 py-3 text-sm data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <t.icon className="h-4 w-4" />
                <span className="inline">{t.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview" className="min-h-[500px]"><OverviewTab plantation={plantation} client={client} /></TabsContent>
          <TabsContent value="progression" className="min-h-[500px]"><ProgressionTab plantation={plantation} client={client} /></TabsContent>
          <TabsContent value="technique" className="min-h-[500px]"><TechniqueTab plantation={plantation} /></TabsContent>
          <TabsContent value="medias" className="min-h-[500px]"><MediasTab plantation={plantation} /></TabsContent>
          <TabsContent value="documents" className="min-h-[500px]"><DocumentsTab plantation={plantation} client={client} /></TabsContent>
          <TabsContent value="carte" className="min-h-[500px]"><MapTab plantation={plantation} /></TabsContent>
          <TabsContent value="rapports" className="min-h-[500px]"><RapportsTab plantation={plantation} /></TabsContent>
          <TabsContent value="messagerie" className="min-h-[500px]"><MessagerieTab client={client} plantation={plantation} /></TabsContent>
        </Tabs>
      </main>

      <footer className="border-t bg-card py-3">
        <p className="text-xs text-muted-foreground text-center">© {new Date().getFullYear()} AgriCapital · client.agricapital.ci</p>
      </footer>
    </div>
  );
};

export default ClientPlantationHub;
