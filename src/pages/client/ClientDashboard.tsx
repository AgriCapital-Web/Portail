import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, CheckCircle, CreditCard, LogOut, MapPin, Phone, RefreshCw, Sprout, UserRound } from "lucide-react";
import logoWhiteBg from "@/assets/logo-white-bg.png";
import { formatCFA } from "@/utils/pricing";
import { canShowPayments, portalRoleLabel } from "@/utils/portalRoles";
import AccessCodePanel from "@/components/client/AccessCodePanel";
import PortalNotificationCenter from "@/components/client/PortalNotificationCenter";
import { TransactionStatusWidget } from "@/components/client/TransactionStatusWidget";
import { MessagerieTab } from "@/components/plantation/tabs/MessagerieTab";
import { DocumentsTab } from "@/components/plantation/tabs/DocumentsTab";

interface Props {
  client: any;
  plantations: any[];
  paiements: any[];
  syncStatus?: string;
  lastSync?: Date | null;
  onPayment: (options?: { prefillAmount?: number; prefillType?: "arriere" | "solde_paiement_initial" }) => void;
  onPlantationHub: (id?: string) => void;
  onLogout: () => void;
}
const displayDate = (value: any) => {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.toLocaleDateString("fr-FR") : "—";
};
const initials = (name: string) => (name || "AC").split(" ").map((part) => part[0]).join("").slice(0, 2);

export default function ClientDashboard({ client: initialClient, plantations: initialPlantations, paiements: initialPaiements, syncStatus, lastSync, onPayment, onPlantationHub, onLogout }: Props) {
  const { toast } = useToast();
  const [client, setClient] = useState(initialClient);
  const [plantations, setPlantations] = useState(initialPlantations);
  const [paiements, setPaiements] = useState(initialPaiements);
  const [refreshing, setRefreshing] = useState(false);
  const [showAccessSaved, setShowAccessSaved] = useState(false);
  useEffect(() => { setClient(initialClient); setPlantations(initialPlantations); setPaiements(initialPaiements); }, [initialClient, initialPlantations, initialPaiements]);
  useEffect(() => {
    if (sessionStorage.getItem("agri_access_code_saved") === "1") {
      sessionStorage.removeItem("agri_access_code_saved"); setShowAccessSaved(true);
    }
  }, []);
  const isDemo = client?.demo === true;
  const financial = canShowPayments(client);
  const state = client?.paiement_etat;
  const arrears = Number(state?.mensualite?.montant_arriere || 0);
  const initialBalance = Number(state?.paiement_initial?.solde || 0);
  const parcelles: any[] = client?.parcelles || (client?.parcelle ? [client.parcelle] : []);
  const attributions: any[] = client?.attributions || [];
  const hectares = plantations.length ? plantations.reduce((total, row) => total + Number(row.superficie_ha || 0), 0) : Number(client?.total_hectares || parcelles.reduce((total, row) => total + Number(row.surface_totale_ha || 0), 0));
  const steps: any[] = client?.technique_progression || [];
  const completed = steps.filter((step) => step.statut === "termine").length;
  const paymentAvailable = Boolean(state && (initialBalance > 0 || Number(state?.mensualite?.montant || 0) > 0));
  const handleRefresh = useCallback(async () => {
    if (isDemo) return;
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("client-portal-data", { body: { access_token: sessionStorage.getItem("agri_portal_access_token") } });
      if (error || !data?.success) throw new Error(data?.error || "Actualisation indisponible.");
      setClient(data.client); setPlantations(data.plantations || []); setPaiements(data.paiements || []);
      sessionStorage.setItem("agri_client", JSON.stringify(data.client));
      sessionStorage.setItem("agri_plantations", JSON.stringify(data.plantations || []));
      sessionStorage.setItem("agri_paiements", JSON.stringify(data.paiements || []));
      toast({ title: "Données actualisées" });
    } catch { toast({ variant: "destructive", title: "Actualisation impossible", description: "Vos dernières données restent affichées." }); }
    finally { setRefreshing(false); }
  }, [isDemo, toast]);

  return <div className="portal-shell min-h-screen flex flex-col">
    <header className="portal-header px-4 py-4">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
        <div className="portal-logo rounded-md p-1"><img src={logoWhiteBg} alt="AgriCapital" className="h-9 sm:h-11 max-w-[150px] object-contain" /></div>
        <div className="flex shrink-0 items-center gap-1">
          <PortalNotificationCenter compact />
          <AccessCodePanel telephone={client?.telephone} email={client?.email} account={client?.id_unique || client?.telephone} />
          {!isDemo && <Button variant="ghost" size="icon" title="Actualiser" aria-label="Actualiser" onClick={handleRefresh} disabled={refreshing} className="text-primary-foreground hover:bg-primary-foreground/10"><RefreshCw className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} /></Button>}
          <Button variant="ghost" size="icon" title="Déconnexion" aria-label="Déconnexion" onClick={onLogout} className="text-primary-foreground hover:bg-primary-foreground/10"><LogOut className="h-5 w-5" /></Button>
        </div>
      </div>
    </header>
    <main className="client-page-content mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:py-8 space-y-8">
      <section className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-primary/10 border border-primary/20">
            {client?.photo_profil_url ? <img src={client.photo_profil_url} alt={client.nom_complet} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-2xl font-bold text-primary">{initials(client?.nom_complet)}</div>}
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground mb-1">Mon espace AgriCapital</p>
            <h1 className="text-xl sm:text-2xl font-bold break-words">{client?.nom_complet || "—"}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2"><Badge variant="secondary">{portalRoleLabel(client)}</Badge>{client?.offres?.nom && <Badge variant="outline">{client.offres.nom}</Badge>}{isDemo && <Badge variant="outline">Démonstration</Badge>}</div>
            <p className="mt-2 text-xs text-muted-foreground break-all">{client?.id_unique || ""}</p>
          </div>
        </div>
        {!isDemo && <p className={`text-xs ${syncStatus === "error" || syncStatus === "offline" ? "text-destructive" : "text-muted-foreground"}`}>{syncStatus === "error" ? "Actualisation indisponible" : syncStatus === "offline" ? "Hors ligne · Dernières données affichées" : lastSync ? `Actualisé à ${lastSync.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : "Synchronisation en cours"}</p>}
      </section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[{ icon: Sprout, value: plantations.length, label: "Plantations" }, { icon: MapPin, value: hectares.toLocaleString("fr-FR"), label: "Hectares" }, { icon: CheckCircle, value: plantations.reduce((total, row) => total + Number(row.superficie_activee || 0), 0).toLocaleString("fr-FR"), label: "Hectares actifs" }, { icon: UserRound, value: parcelles.length, label: "Parcelles" }].map((stat) => <div key={stat.label} className="rounded-lg border bg-card p-4 sm:p-5"><stat.icon className="h-5 w-5 text-primary mb-3" /><p className="text-2xl font-bold break-words">{stat.value}</p><p className="mt-1 text-sm text-muted-foreground">{stat.label}</p></div>)}
      </section>

      {financial && <section className="border-y border-border py-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><p className="text-sm text-muted-foreground">Mes règlements</p><h2 className="text-xl font-bold mt-1">Situation de paiement</h2></div>
          {paymentAvailable && <Button className="gap-2 w-full sm:w-auto h-auto min-h-11 whitespace-normal" onClick={() => onPayment(arrears > 0 ? { prefillAmount: arrears, prefillType: "arriere" } : initialBalance > 0 ? { prefillAmount: initialBalance, prefillType: "solde_paiement_initial" } : undefined)}><CreditCard className="h-4 w-4 shrink-0" />{arrears > 0 ? "Rattraper mon arriéré" : initialBalance > 0 ? "Régler le paiement initial" : "Effectuer un paiement"}</Button>}
        </div>
        {state ? <div className="grid grid-cols-2 lg:grid-cols-4 gap-5"><div><p className="text-sm text-muted-foreground">Solde initial</p><p className="text-lg font-bold mt-1 break-words">{formatCFA(initialBalance)}</p></div><div><p className="text-sm text-muted-foreground">Montant arriéré</p><p className={`text-lg font-bold mt-1 break-words ${arrears > 0 ? "text-destructive" : "text-primary"}`}>{formatCFA(arrears)}</p></div><div><p className="text-sm text-muted-foreground">Jours de retard</p><p className="text-lg font-bold mt-1">{Number(state.mensualite?.jours_retard || 0)}</p></div><div><p className="text-sm text-muted-foreground">Mensualité</p><p className="text-lg font-bold mt-1 break-words">{formatCFA(Number(state.mensualite?.montant || 0))}</p></div></div> : <p className="text-sm text-muted-foreground">Situation financière indisponible pour le moment.</p>}
        {client?.paiement_personnalise?.actif && <div className="space-y-2"><p className="font-semibold">Conditions de règlement personnalisées</p><div className="flex flex-wrap gap-x-8 gap-y-2 text-sm"><p>Mensualités : {client.paiement_personnalise.mensualite?.active ? `${formatCFA(Number(client.paiement_personnalise.mensualite.montant || 0))} × ${client.paiement_personnalise.mensualite.nombre}` : "Aucune"}</p><p>Début : {displayDate(client.paiement_personnalise.mensualite?.date_debut)}</p></div></div>}
      </section>}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">Mes plantations</h2>{steps.length > 0 && <span className="text-sm text-muted-foreground">{completed}/{steps.length} étapes terminées</span>}</div>
        {steps.length > 0 && <Progress value={completed / steps.length * 100} className="h-2" />}
        {plantations.length ? <div className="grid gap-4 md:grid-cols-2">{plantations.map((plantation) => <article key={plantation.id} className="rounded-lg overflow-hidden border bg-card">
          {plantation.medias?.find((media: any) => media.type !== "video" && media.url)?.url && <img src={plantation.medias.find((media: any) => media.type !== "video" && media.url).url} alt={plantation.nom_plantation || "Plantation"} className="w-full aspect-[16/7] object-cover" />}
          <div className="p-4 sm:p-5 space-y-4"><div><p className="text-xs text-muted-foreground mb-1">{plantation.id_unique}</p><h3 className="text-lg font-bold break-words">{plantation.nom_plantation || plantation.nom || "Plantation"}</h3><p className="text-sm text-muted-foreground mt-2 break-words">{Number(plantation.superficie_ha || 0).toLocaleString("fr-FR")} ha{(plantation.village_nom || plantation.village || plantation.localite) && ` · ${plantation.village_nom || plantation.village || plantation.localite}`}</p></div><Button variant="outline" className="w-full justify-between" onClick={() => onPlantationHub(plantation.id)}>Voir ma plantation<ArrowRight className="h-4 w-4" /></Button></div>
        </article>)}</div> : <p className="text-sm text-muted-foreground py-4">Aucune plantation rattachée pour le moment.</p>}
      </section>

      {!financial && parcelles.length > 0 && <section className="space-y-4"><h2 className="text-xl font-bold">Mes parcelles</h2><div className="grid gap-3 md:grid-cols-2">{parcelles.map((parcelle) => <article key={parcelle.id} className="border rounded-lg bg-card p-4"><p className="font-semibold break-words">{parcelle.nom || parcelle.id_unique || "Parcelle"}</p><p className="text-sm text-muted-foreground mt-2">{Number(parcelle.surface_totale_ha || 0).toLocaleString("fr-FR")} ha{typeof parcelle.village === "string" ? ` · ${parcelle.village}` : ""}</p></article>)}</div></section>}
      {!financial && attributions.length > 0 && <section className="space-y-4"><h2 className="text-xl font-bold">Mes attributions</h2><div className="grid gap-3 md:grid-cols-2">{attributions.map((row) => <article key={row.id} className="border rounded-lg bg-card p-4"><p className="font-semibold">{Number(row.surface_attribuee_ha || 0).toLocaleString("fr-FR")} ha</p>{row.statut && <p className="text-sm text-muted-foreground mt-1">{row.statut}</p>}</article>)}</div></section>}
      {!plantations.length && <><section className="space-y-4"><h2 className="text-xl font-bold">Mes documents</h2><DocumentsTab client={client} plantation={null} /></section><MessagerieTab client={client} /></>}
      {financial && paiements.length > 0 && <section className="space-y-4"><h2 className="text-xl font-bold">Dernières transactions</h2><TransactionStatusWidget paiements={paiements} limit={5} /></section>}
      {(client?.commercial || client?.portal_config?.contact_telephone) && <section className="border-t pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        {client?.commercial && <div className="flex items-center gap-3"><div className="h-12 w-12 rounded-lg overflow-hidden bg-primary/10 shrink-0">{client.commercial.photo || client.commercial.photo_url ? <img src={client.commercial.photo || client.commercial.photo_url} alt={client.commercial.nom} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center font-bold text-primary">{initials(client.commercial.nom)}</div>}</div><div><p className="text-xs text-muted-foreground">{client.commercial.fonction || "Votre conseiller"}</p><p className="font-semibold break-words">{client.commercial.nom}</p>{client.commercial.telephone && <a href={`tel:${client.commercial.telephone}`} className="text-sm text-primary inline-flex items-center gap-2"><Phone className="h-4 w-4" />{client.commercial.telephone}</a>}</div></div>}
        {client?.portal_config?.contact_telephone && <a href={`tel:${client.portal_config.contact_telephone}`} className="text-sm text-primary font-semibold inline-flex items-center gap-2"><Phone className="h-4 w-4" />Assistance · {client.portal_config.contact_telephone}</a>}
      </section>}
    </main>
    <footer className="border-t bg-card p-4 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} AgriCapital · Portail</footer>
    <Dialog open={showAccessSaved} onOpenChange={setShowAccessSaved}><DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Code d’accès enregistré</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">Conservez votre code d’accès personnel en lieu sûr.</p><Button onClick={() => setShowAccessSaved(false)}>Continuer</Button></DialogContent></Dialog>
  </div>;
}
