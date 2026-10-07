import { useState, useCallback, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import logoWhiteBg from "@/assets/logo-white-bg.png";
import { formatCFA } from "@/utils/pricing";
import { 
  MapPin, Phone, Sprout, CreditCard, Wallet,
  ArrowRight, LogOut, CheckCircle, AlertTriangle, Clock,
  RefreshCw, TrendingUp, Leaf, ChevronRight, Zap, Target, Calendar
} from "lucide-react";
import { format, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import { TransactionStatusWidget } from "@/components/client/TransactionStatusWidget";
import { MapTab } from "@/components/plantation/tabs/MapTab";
import AccessCodePanel from "@/components/client/AccessCodePanel";
import PortalNotificationCenter from "@/components/client/PortalNotificationCenter";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const clientIsDemo = (client: any) => client?.demo === true || sessionStorage.getItem("agri_demo") === "1";

interface ClientDashboardProps {
  client: any;
  plantations: any[];
  paiements: any[];
  syncStatus?: string;
  lastSync?: Date | null;
  onPayment: (options?: { prefillAmount?: number; prefillType?: 'arriere' | 'solde_paiement_initial' }) => void;
  onPlantationHub: () => void;
  onLogout: () => void;
}


const ClientDashboard = ({ 
  client: initialClient, 
  plantations: initialPlantations, 
  paiements: initialPaiements, 
  syncStatus, lastSync,
  onPayment, onPlantationHub, onLogout 
}: ClientDashboardProps) => {

  const { toast } = useToast();
  const { permission, checkAndNotifyArrears } = usePushNotifications();
  const isDemo = clientIsDemo(initialClient);
  const [client, setClient] = useState(initialClient);
  const [plantations, setPlantations] = useState(initialPlantations);
  const [paiements, setPaiements] = useState(initialPaiements);
  const [refreshing, setRefreshing] = useState(false);
  const [showAccessSaved, setShowAccessSaved] = useState(false);

  useEffect(() => {
    setClient(initialClient);
    setPlantations(initialPlantations);
    setPaiements(initialPaiements);
  }, [initialClient, initialPlantations, initialPaiements]);

  useEffect(() => {
    if (permission === 'granted') checkAndNotifyArrears(plantations, client);
  }, [permission, plantations, client, checkAndNotifyArrears]);

  useEffect(() => {
    if (sessionStorage.getItem("agri_access_code_saved") === "1") {
      sessionStorage.removeItem("agri_access_code_saved");
      setShowAccessSaved(true);
    }
  }, []);

  const fmt = (m: number) => formatCFA(m);
  const customPayment = client?.paiement_personnalise?.actif ? client.paiement_personnalise : null;
  const validatedInitialPaid=(paiements||[]).filter((p:any)=>p.statut==="valide"&&p.type_paiement==="PI").reduce((s:number,p:any)=>s+Number(p.montant_paye||p.montant||0),0);
  const customInitialBalance=Number(customPayment?.paiement_initial?.solde ?? Math.max(0,Number(client?.paiement_initial_montant||0)-validatedInitialPaid));
  const financialClient=!client?.is_beneficiaire_particulier&&client?.type_client!=="beneficiaire_particulier"&&Boolean(client?.offre_id);
  const customMonthly = customPayment?.mensualite?.active === true ? customPayment.mensualite : null;
  const paymentState = client?.paiement_etat || {};
  const paymentArrears = Math.max(0, Number(paymentState?.mensualite?.montant_arriere || 0));
  const paymentLateDays = Math.max(0, Number(paymentState?.mensualite?.jours_retard || 0));
  const totalHectares = plantations.length
    ? plantations.reduce((s: number, p: any) => s + Number(p.superficie_ha || 0), 0)
    : Number(client?.total_hectares || client?.parcelle?.surface_totale_ha || 0);
  const hectaresActifs = plantations.reduce((s: number, p: any) => s + (p.superficie_activee || 0), 0);

  const getInitials = (name: string) => name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'AC';
  const offreNom = (client.offres?.nom || '—');

  const handlePayment = useCallback((options?: { prefillAmount?: number; prefillType?: 'arriere' | 'solde_paiement_initial' }) => {
    onPayment(options);
  }, [isDemo, onPayment, toast]);

  const handleRefresh = useCallback(async () => {
    if (isDemo) {
      toast({ title: "Mode démonstration", description: "Les données réelles du CRM ne sont pas utilisées dans cette démonstration." });
      return;
    }
    setRefreshing(true);
    try {
      const accessToken = sessionStorage.getItem("agri_portal_access_token");
      const { data, error } = await supabase.functions.invoke("client-portal-data", {
        body: { access_token: accessToken },
      });
      if (error) throw error;
      if (data?.success) {
        setClient(data.client); setPlantations(data.plantations); setPaiements(data.paiements);
        sessionStorage.setItem('agri_client', JSON.stringify(data.client));
        sessionStorage.setItem('agri_plantations', JSON.stringify(data.plantations));
        sessionStorage.setItem('agri_paiements', JSON.stringify(data.paiements));
        toast({ title: "✅ Données actualisées" });
      }
    } catch { toast({ variant: "destructive", title: "Erreur", description: "Impossible d'actualiser." }); }
    finally { setRefreshing(false); }
  }, [client.telephone, toast, isDemo]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #00643C 0%, #004d2e 28%, #f8f7f4 28.1%, #f8f7f4 100%)' }}>
      <Dialog open={showAccessSaved} onOpenChange={setShowAccessSaved}>
        <DialogContent className="max-w-sm text-center rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex flex-col items-center gap-3 text-lg">
              <span className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-primary" />
              </span>
              Code d'accès enregistré avec succès
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Merci de conserver votre code d'accès en lieu sûr pour vos futures connexions à votre espace client.
          </p>
          <Button className="w-full btn-brand" onClick={() => setShowAccessSaved(false)}>Continuer</Button>
        </DialogContent>
      </Dialog>
      {/* Header */}
      <header className="px-4 pt-4 pb-2 sticky top-0 z-50" style={{ background: 'linear-gradient(180deg, #00643C 0%, #004d2e 100%)' }}>
        <div className="container mx-auto flex items-center justify-between w-full max-w-7xl">
          <div className="bg-white rounded-lg p-1 flex items-center justify-center"><img src={logoWhiteBg} alt="AgriCapital" className="h-10 sm:h-12 object-contain" /></div>
          <div className="flex items-center gap-1">
            <PortalNotificationCenter compact />
            <AccessCodePanel
              telephone={client?.telephone}
              email={client?.email}
              account={client?.id_unique || client?.telephone}
            />
            <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={refreshing} className="text-white hover:bg-white/15 h-9 w-9">
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="ghost" size="icon" onClick={onLogout} className="text-white hover:bg-white/15 h-9 w-9"><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <main className="client-page-content flex-1 container mx-auto space-y-4 lg:space-y-0 lg:grid lg:grid-cols-12 lg:gap-5 w-full max-w-[1400px] pb-8 lg:pb-12 pt-4 lg:pt-6">
        
        {/* Profile Card */}
        <Card className="border-0 shadow-xl overflow-hidden rounded-2xl lg:col-span-5" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 rounded-2xl overflow-hidden border-2 border-gold/40 shadow-lg flex-shrink-0">
                {client.photo_profil_url ? (
                  <img src={client.photo_profil_url} alt={client.nom_complet} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-white/20 flex items-center justify-center">
                    <span className="text-lg font-bold text-white">{getInitials(client.nom_complet)}</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-white/60 uppercase tracking-wider">Bonjour,</p>
                <h2 className="text-base font-bold text-white truncate">{client.nom_complet}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge className="text-[10px] px-2 py-0 bg-gold/20 border-gold/30 text-white">{offreNom}</Badge>
                  {isDemo && <Badge className="text-[10px] px-2 py-0 bg-white/10 border-white/20 text-white/80">Démonstration</Badge>}
                  <span className="text-[10px] text-white/40">{client.id_unique || '—'}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {customPayment && (
          <Card className="lg:col-span-7 border-primary/20 bg-primary/5 shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Wallet className="h-5 w-5 text-primary" />
                    <p className="font-bold">Conditions de règlement personnalisées</p>
                    <Badge variant="outline" className="text-primary border-primary/30">Exception individuelle</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground max-w-2xl">Cette configuration reste rattachée à l’offre {client.offres?.nom || client.offres?.formule_nom || '—'} sans créer d’offre spéciale.</p>
                </div>
                <div className="text-left sm:text-right shrink-0">
                  <p className="text-xs text-muted-foreground">Solde du Paiement initial</p>
                  <p className="text-xl font-extrabold">{fmt(customInitialBalance)}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-4 text-sm">
                <div className="rounded-xl bg-background/70 border p-3"><p className="text-xs text-muted-foreground">Paiement initial déjà versé</p><p className="font-bold">{fmt(Number(customPayment.paiement_initial?.montant_verse || 0))}</p></div>
                <div className="rounded-xl bg-background/70 border p-3"><p className="text-xs text-muted-foreground">Mensualité</p><p className="font-bold">{customMonthly ? fmt(Number(customMonthly.montant || 0)) + ' × ' + customMonthly.nombre : 'Aucune'}</p></div>
                <div className="rounded-xl bg-background/70 border p-3"><p className="text-xs text-muted-foreground">Début mensualités</p><p className="font-bold">{customMonthly?.date_debut ? format(new Date(customMonthly.date_debut), 'dd/MM/yyyy') : '—'}</p></div>
              </div>
              {financialClient && customInitialBalance > 0 && (
                <Button className="mt-4" size="sm" onClick={() => handlePayment({ prefillAmount: customInitialBalance, prefillType: 'solde_paiement_initial' })}>Payer le solde du Paiement initial — {fmt(customInitialBalance)}</Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-1 min-[360px]:grid-cols-3 gap-2 lg:col-span-7">
          {[
            { icon: Sprout, value: plantations.length, label: "Plantation(s)", color: "text-green-400" },
            { icon: MapPin, value: totalHectares, label: "Hectare(s)", color: "text-gold" },
            { icon: CheckCircle, value: hectaresActifs, label: "Ha. actifs", color: "text-blue-400" }
          ].map((stat, i) => (
            <Card key={i} className="border-0 shadow-lg rounded-2xl" style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)' }}>
              <CardContent className="p-3 text-center">
                <stat.icon className={`h-5 w-5 mx-auto mb-1 ${stat.color}`} />
                <p className="text-xl font-bold text-white">{stat.value}</p>
                <p className="text-[10px] text-white/60">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Situation de paiement : uniquement pour les clients financiers */}
        {financialClient && <Card className="card-brand rounded-2xl shadow-md lg:col-span-12">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-muted-foreground uppercase tracking-wide">Situation</p>
              <p className="text-xl font-black">{paymentLateDays > 0 || paymentArrears > 0 ? "🔴 " + paymentLateDays + " jour(s) d’arriéré" : "🟢 0 jour d’arriéré"}</p></div>
              <CheckCircle className="h-6 w-6 text-primary" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-xl bg-muted/30 p-3"><p className="text-[10px] text-muted-foreground">Montant arriéré</p><p className="text-lg font-black">{fmt(paymentArrears)}</p></div>
              <div className="rounded-xl bg-muted/30 p-3"><p className="text-[10px] text-muted-foreground">Jours d’arriéré</p><p className="text-lg font-black">{paymentLateDays}</p></div>
              <div className="rounded-xl bg-muted/30 p-3"><p className="text-[10px] text-muted-foreground">Prochaine échéance</p><p className="font-bold">{client?.prochaine_echeance ? format(new Date(client.prochaine_echeance), "dd/MM/yyyy", { locale: fr }) : "—"}</p></div>
              <div className="rounded-xl bg-muted/30 p-3"><p className="text-[10px] text-muted-foreground">Montant de l’échéance</p><p className="font-bold">{Number(paymentState?.mensualite?.montant_a_payer || paymentState?.mensualite?.montant || 0) > 0 ? fmt(Number(paymentState?.mensualite?.montant_a_payer || paymentState?.mensualite?.montant || 0)) : "—"}</p></div>
            </div>
            <Button onClick={() => paymentArrears > 0 ? handlePayment({ prefillAmount: paymentArrears, prefillType: "arriere" }) : handlePayment()} className="rounded-xl btn-brand">{paymentArrears > 0 ? "Rattraper" : "Effectuer un paiement"}</Button>
          </CardContent>        </Card>}

        {(() => {
          const mapAsset = plantations.find((p: any) => Number(p.latitude || p.localisation_gps_lat) && Number(p.longitude || p.localisation_gps_lng))
            || (Number(client?.parcelle?.localisation_gps_lat) && Number(client?.parcelle?.localisation_gps_lng) ? {
              ...client.parcelle,
              id_unique: client.parcelle.id_unique || "Parcelle",
              nom_plantation: client.parcelle.nom || "Parcelle agricole",
              superficie_ha: client.parcelle.surface_totale_ha,
              latitude: client.parcelle.localisation_gps_lat,
              longitude: client.parcelle.localisation_gps_lng,
            } : null);
          return mapAsset ? (
            <Card className="rounded-2xl shadow-sm lg:col-span-12 overflow-hidden">
              <CardContent className="p-0">
                <div className="p-4"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Carte</p><p className="font-bold">Localisation de votre actif agricole</p></div>
                <MapTab plantation={mapAsset} />
              </CardContent>
            </Card>
          ) : null;
        })()}

        {client?.technique_progression?.length > 0 && (
          <Card className="rounded-2xl shadow-sm lg:col-span-12">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Suivi technique</p><p className="font-bold text-lg">Progression réelle du dossier</p></div>
                <Badge variant="outline">{client.technique_progression.filter((e:any) => e.statut === "termine").length}/{client.technique_progression.length} étapes terminées</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                {client.technique_progression.map((e:any) => (
                  <div key={e.key} className="rounded-xl border bg-muted/20 p-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle className={e.statut === "termine" ? "h-4 w-4 text-primary" : "h-4 w-4 text-muted-foreground"} />
                      <p className="text-xs font-semibold">{e.label}</p>
                    </div>
                    {e.date && <p className="mt-1 text-[10px] text-muted-foreground">{format(new Date(e.date), "dd/MM/yyyy", { locale: fr })}</p>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        {/* CTA Ma Plantation (nouveau hub complet) */}
        {plantations.length > 0 && (
          <Button onClick={onPlantationHub} className="w-full h-14 lg:h-16 text-base font-bold gap-3 shadow-xl rounded-2xl bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white lg:col-span-6">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center"><Leaf className="h-5 w-5" /></div>
            <span className="flex-1 text-left">Ma Plantation<span className="block text-[10px] font-normal opacity-80">Progression · Médias · Carte · Rapports</span></span>
            <ArrowRight className="h-5 w-5" />
          </Button>
        )}

        {/* CTA Paiement */}
        <Button onClick={() => handlePayment()} className="w-full h-14 lg:h-16 text-base font-bold gap-3 shadow-xl rounded-2xl btn-brand lg:col-span-6">
          <CreditCard className="h-5 w-5" />
          <span className="flex-1 text-left">Effectuer un paiement</span>
          <ArrowRight className="h-5 w-5" />
        </Button>

        {financialClient && <div className="lg:col-span-12"><TransactionStatusWidget paiements={paiements} limit={5} /></div>}

        {/* Promotion active */}
        {client.promotion_active && (
          <Card className="rounded-2xl shadow-md border-0 overflow-hidden lg:col-span-6" style={{ background: 'linear-gradient(120deg, #E89C31 0%, #B97A0E 100%)' }}>
            <CardContent className="p-4 text-white">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <Zap className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-wider opacity-80">Promotion active</p>
                  <p className="font-bold text-sm truncate">{client.promotion_active.nom}</p>
                  <p className="text-xs opacity-90">
                    {client.promotion_active.pourcentage_reduction > 0 
                      ? `-${client.promotion_active.pourcentage_reduction}% sur ${client.promotion_active.cible || 'votre offre'}`
                      : `-${fmt(client.promotion_active.montant_fixe_reduction || 0)} de réduction`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mon Conseiller */}
        {client.commercial && (
          <Card className="card-brand-subtle rounded-2xl shadow-sm lg:col-span-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl overflow-hidden bg-primary/10 flex items-center justify-center shrink-0 border-2 border-gold/30">
                  {client.commercial.photo ? (
                    <img src={client.commercial.photo} alt={client.commercial.nom} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-base font-bold text-primary">{getInitials(client.commercial.nom)}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{client.commercial.fonction}</p>
                  <p className="font-bold text-sm truncate">{client.commercial.nom}</p>
                  {client.commercial.telephone && (
                    <a href={`tel:${client.commercial.telephone}`} className="text-xs text-primary font-semibold hover:underline inline-flex items-center gap-1 mt-0.5">
                      <Phone className="h-3 w-3" /> {client.commercial.telephone}
                    </a>
                  )}
                </div>
                {client.commercial.telephone && (
                  <a href={`https://wa.me/225${client.commercial.telephone.replace(/\D/g,'').replace(/^225/,'')}`}
                     target="_blank" rel="noreferrer"
                     className="h-10 w-10 rounded-xl bg-[#22C55E]/10 hover:bg-[#22C55E]/20 flex items-center justify-center text-[#22C55E] transition-colors">
                    <Phone className="h-4 w-4" />
                  </a>
                )}
              </div>
              {client.numero_contrat && (
                <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Contrat</span>
                  <span className="font-mono font-bold text-foreground">{client.numero_contrat}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Contact */}
        <Card className="card-brand-green rounded-2xl shadow-none lg:col-span-12">
          <CardContent className="p-4 text-center">
            <div className="bg-white rounded-lg p-2 inline-flex"><img src={logoWhiteBg} alt="AgriCapital" className="h-12 sm:h-14 mx-auto object-contain" /></div>
            <p className="text-xs text-muted-foreground mb-1.5">Assistance AgriCapital</p>
            {client?.portal_config?.contact_telephone && <a href={`tel:${client.portal_config.contact_telephone}`} className="inline-flex items-center gap-2 text-primary font-bold hover:underline text-sm">
              <Phone className="h-4 w-4" /> {client.portal_config.contact_telephone}
            </a>}
          </CardContent>
        </Card>
      </main>

      <footer className="border-t bg-card py-3">
        <p className="text-[10px] text-muted-foreground text-center">© {new Date().getFullYear()} AgriCapital · Portail Client</p>
      </footer>
    </div>
  );
};

export default ClientDashboard;
