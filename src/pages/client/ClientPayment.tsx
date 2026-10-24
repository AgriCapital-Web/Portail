import { useState, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useKkiapay } from "@/hooks/useKkiapay";
import logoWhiteBg from "@/assets/logo-white-bg.png";
import { formatCFA } from "@/utils/pricing";
import { canShowPayments, isLocalDemo } from "@/utils/portalRoles";
import { trackEvent } from "@/utils/errorTracker";
import { ArrowLeft, CreditCard, MapPin, AlertTriangle, Loader2, Phone, Leaf } from "lucide-react";

interface ClientPaymentProps { client: any; plantations: any[]; paiements: any[]; onBack: () => void; initialPlantationId?: string | null; }
type PaymentMode = "1" | "3" | "6" | "9" | "12" | "custom";
type ClientPaymentMethod = "momo" | "card";
const calculateKkiapayAbsorption = (amount: number, method: ClientPaymentMethod, feeRate: number) => {
  const clientDebitAmount = Math.max(0, Math.round(amount || 0));
  if (method === "card") return { clientDebitAmount, widgetAmount: clientDebitAmount, estimatedFees: 0, feeRate: 0, absorbedByAgriCapital: 0 };
  const theoreticalAmount = Math.max(0, Math.round(clientDebitAmount / (1 + Math.max(0, feeRate))));
  let widgetAmount = theoreticalAmount;
  for (let candidate = Math.max(0, theoreticalAmount - 20); candidate <= theoreticalAmount + 20; candidate += 1) {
    if (candidate + Math.ceil(candidate * Math.max(0, feeRate)) === clientDebitAmount) { widgetAmount = candidate; break; }
  }
  const estimatedFees = Math.max(0, clientDebitAmount - widgetAmount);
  return { clientDebitAmount, widgetAmount, estimatedFees, feeRate, absorbedByAgriCapital: estimatedFees };
};

const ClientPayment = ({ client, plantations, paiements = [], onBack, initialPlantationId }: ClientPaymentProps) => {
  const { toast } = useToast();
  const { openPayment, onSuccess, onFailed, onClose } = useKkiapay();
  const [typePaiement, setTypePaiement] = useState<"pi" | "mensualite">(() => client?.pre_activation ? "pi" : "mensualite");
  const [selectedPlantation, setSelectedPlantation] = useState(initialPlantationId || "all");
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<ClientPaymentMethod>("momo");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("1");
  const [customAmount, setCustomAmount] = useState("");
  const paymentContextRef = useRef<{ reference: string; pricing: ReturnType<typeof calculateKkiapayAbsorption> } | null>(null);

  const plantation = useMemo(() => selectedPlantation === "all" ? undefined : plantations.find((p) => p.id === selectedPlantation), [selectedPlantation, plantations]);
  const dbFinancialState = selectedPlantation === "all" ? (client?.paiement_etat || {}) : (plantation?.paiement_etat || {});
  const dbInitialDue = Math.max(0, Number(dbFinancialState?.paiement_initial?.solde || 0));
  const dbMonthlyBase = Math.max(0, Number(dbFinancialState?.mensualite?.montant || dbFinancialState?.mensualite?.montant_a_payer || 0));
  const dbArrears = Math.max(0, Number(dbFinancialState?.mensualite?.montant_arriere || 0));
  const dbLateDays = Math.max(0, Number(dbFinancialState?.mensualite?.jours_retard || 0));
  const hasArrears = dbArrears > 0 || dbLateDays > 0;
  const activeHectares = Math.max(0, Number(dbFinancialState?.mensualite?.hectares_actifs || 0));
  const isDemoAccount = isLocalDemo(client);
  const isPreActivation = Boolean(client?.pre_activation && !client?.compte_actif);
  const hasFinancialSubscriptions = Boolean(client?.has_financial_subscriptions);
  const beneficiaryClient = Boolean(client?.is_beneficiaire_particulier || client?.type_client === "beneficiaire_particulier") && !hasFinancialSubscriptions;
  const selectedSubscription = plantation?.acquisition_id
    ? (client?.financial_subscriptions || []).find((subscription: any) => subscription.id === plantation.acquisition_id)
    : null;
  const totalContract = Math.max(0, Number(selectedPlantation === "all" || !hasFinancialSubscriptions ? client?.montant_total_contrat : selectedSubscription?.montant_total_contrat || 0));
  const totalPaid = selectedPlantation === "all" || !hasFinancialSubscriptions
    ? (paiements || []).filter((p:any)=>p.statut==="valide").reduce((sum:number,p:any)=>sum+Number(p.montant_paye ?? p.montant ?? 0),0)
    : Math.max(0,Number(plantation?.paiement_etat?.total_paye||0));
  const isSettled = !beneficiaryClient && ((Boolean(client?.contrat_solde_at) && !hasFinancialSubscriptions) || (totalContract > 0 && totalPaid >= totalContract));
  const financialAllowed = canShowPayments(client) && !beneficiaryClient && !isSettled && (hasFinancialSubscriptions || Boolean(client?.offre_id) || Boolean(client?.paiement_personnalise?.actif) || totalContract > 0);

  useEffect(() => {
    if (initialPlantationId && plantations.some((p: any) => p.id === initialPlantationId)) {
      setSelectedPlantation(initialPlantationId);
    } else if (!initialPlantationId && !selectedPlantation) {
      setSelectedPlantation("all");
    }
  }, [initialPlantationId, plantations, selectedPlantation]);

  const montantTotal = useMemo(() => {
    if (typePaiement === "pi") return dbInitialDue;
    if (paymentMode === "custom") return Math.max(0, Number(customAmount) || 0);
    const months = Number(paymentMode);
    const schedules = dbFinancialState?.mensualite?.echeancier_souscriptions;
    if (Array.isArray(schedules) && schedules.length > 0) {
      return schedules.reduce((sum: number, schedule: any) => {
        const monthly = Math.max(0, Number(schedule.montant_mensuel || 0));
        const remaining = Math.max(0, Number(schedule.mois_restants ?? months));
        return sum + monthly * Math.min(months, remaining);
      }, 0);
    }
    return dbMonthlyBase * months;
  }, [typePaiement, paymentMode, customAmount, dbMonthlyBase, dbInitialDue, dbFinancialState]);

  const contractRemaining = Math.max(0, totalContract - totalPaid);
  const paymentWillSettle = contractRemaining > 0 && montantTotal >= contractRemaining;
  const kkiapayFeeRate = Math.max(0, Number(client?.portal_config?.kkiapay_mobile_money_fee_rate || 0));
  const kkiapayPricing = useMemo(() => calculateKkiapayAbsorption(montantTotal, paymentMethod, kkiapayFeeRate), [montantTotal, paymentMethod, kkiapayFeeRate]);
  const isPiFree = typePaiement === "pi" && !!plantation && dbInitialDue <= 0 && !hasFinancialSubscriptions;

  useEffect(() => {
    onSuccess(async (response) => {
      const context = paymentContextRef.current;
      if (!context?.reference) return;
      try {
        const { data, error } = await supabase.functions.invoke("create-payment", {
          body: { action: "confirm", portal_token: sessionStorage.getItem("agri_portal_access_token"), reference: context.reference, kkiapay_transaction_id: response.transactionId, client_debit_amount: context.pricing.clientDebitAmount, fee_absorption_rate: context.pricing.feeRate }
        });
        if (error || !data?.success) throw new Error(data?.error || error?.message || "Confirmation du paiement impossible.");
        if (paymentWillSettle) {
          try { sessionStorage.setItem("agri_contrat_solde_confirmed", String(client?.id)); } catch { /* dashboard will refresh from DB */ }
        }
        toast({ title: paymentWillSettle ? "🎉 Félicitations, contrat soldé !" : "✅ Paiement réussi", description: paymentWillSettle ? "Votre contrat est entièrement réglé. Merci de la part d’AgriCapital." : "Transaction " + response.transactionId + " validée." });
        setTimeout(onBack, 1800);
      } catch (e: any) {
        trackEvent({ level: "error", scope: "payment", message: "Confirmation serveur du paiement échouée", account: client?.id_unique || client?.telephone, context: { error: e?.message } });
        toast({ variant: "destructive", title: "Paiement reçu, confirmation en cours", description: "La transaction a été reçue mais sa validation sécurisée n'est pas encore terminée." });
      } finally { setLoading(false); }
    });
    onFailed((error) => { toast({ variant: "destructive", title: "Paiement échoué", description: error.reason }); setLoading(false); });
    onClose(() => setLoading(false));
  }, [client?.id_unique, client?.telephone, paymentWillSettle, onBack, onFailed, onSuccess, onClose, toast]);

  const handleActivationGratuite = async () => {
    if (!financialAllowed || !plantation) return;
    setLoading(true);
    const reference = "PI0-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9).toUpperCase();
    try {
      const { data, error } = await supabase.functions.invoke("create-payment", {
        body: { action: "activate_free", portal_token: sessionStorage.getItem("agri_portal_access_token"), client_id: client.id, plantation_id: plantation.id, reference }
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || "Activation impossible.");
      toast({ title: "✅ Plantation activée", description: "Paiement initial offert : 0 F CFA." });
      setTimeout(onBack, 1500);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur", description: e?.message || "Activation impossible." });
    } finally { setLoading(false); }
  };

  const handleDemoPayment = async () => {
    setLoading(true);
    const reference = "DEMO-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9).toUpperCase();
    await new Promise((resolve) => setTimeout(resolve, 700));
    const payment = { id: reference, reference, montant: montantTotal, montant_paye: montantTotal, statut: "valide", type_paiement: typePaiement === "pi" ? "PI" : "MENSUALITE", created_at: new Date().toISOString(), date_paiement: new Date().toISOString(), plantation_id: plantation?.id };
    let previous: any[] = [];
    try { previous = JSON.parse(sessionStorage.getItem("agri_paiements") || "[]"); } catch { previous = []; }
    sessionStorage.setItem("agri_paiements", JSON.stringify([...previous, payment]));
    toast({ title: "✅ Paiement simulé", description: "Référence " + reference + ". Aucun débit réel n'a été effectué." });
    setLoading(false);
    setTimeout(onBack, 1000);
  };

  const handleSubmit = async () => {
    if (isPreActivation && dbInitialDue <= 0) {
      toast({ title: "Activation en cours", description: "Aucun paiement initial ne reste à régler." });
      return;
    }

  if (!financialAllowed) {
      toast({variant:"destructive",title:"Paiement indisponible",description:beneficiaryClient ? "Ce compte bénéficiaire ne dispose pas d’actions financières." : "Ce contrat est déjà soldé ou ne permet pas de paiement."});
      return;
    }
    if (isDemoAccount) {
      if (montantTotal > 0 && (plantation || selectedPlantation === "all" || isPreActivation)) return handleDemoPayment();
      return;
    }
    if (typePaiement === "pi" && montantTotal <= 0 && plantation) return handleActivationGratuite();
    if (isPreActivation && (typePaiement !== "pi" || dbInitialDue <= 0)) {
      toast({ title: "Activation en cours", description: "Le paiement initial est déjà soldé ou aucun montant n’est dû." });
      return;
    }
    if ((!plantation && selectedPlantation !== "all" && !isPreActivation) || montantTotal <= 0) {
      toast({ variant: "destructive", title: "Montant requis", description: "Choisissez un montant réel à payer." });
      return;
    }
    setLoading(true);
    const reference = "PAY-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9).toUpperCase();
    paymentContextRef.current = { reference, pricing: kkiapayPricing };
    try {
      const { data, error } = await supabase.functions.invoke("create-payment", {
        body: {
          action: "insert",
          portal_token: sessionStorage.getItem("agri_portal_access_token"),
          client_id: client.id,
          plantation_id: plantation?.id || null,
          type_paiement: typePaiement === "pi" ? "PI" : "MENSUALITE",
          montant: montantTotal,
          mode_paiement: paymentMethod === "momo" ? "Mobile Money" : "Carte bancaire",
          reference,
          metadata: { payment_provider: "kkiapay", source: "client_portal", selection: paymentMode }
        }
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || "Création du paiement impossible.");
      const opened = await openPayment({
        amount: kkiapayPricing.widgetAmount,
        email: client.email || undefined,
        phone: client.telephone,
        name: client.nom_complet || ((client.prenoms || "") + " " + (client.nom || "")).trim(),
        paymentMethods: [paymentMethod],
        data: { reference, paiement_id: data.paiement.id, type: typePaiement, client_debit_amount: kkiapayPricing.clientDebitAmount }
      });
      if (!opened) throw new Error("Impossible d'ouvrir le paiement sécurisé.");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur", description: e?.message || "Paiement impossible." });
      setLoading(false);
    }
  };

  const fmt = (n: number) => formatCFA(Math.max(0, Math.round(n)));
  const choices: { value: PaymentMode; label: string }[] = [
    { value: "1", label: "1 mois" }, { value: "3", label: "3 mois" }, { value: "6", label: "6 mois" }, { value: "9", label: "9 mois" },
    { value: "12", label: "12 mois" }, { value: "custom", label: "Montant personnalisé" }
  ];

  if (!financialAllowed) {
    return <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg rounded-2xl border border-[#22A45D]/30 shadow-lg">
        <CardContent className="space-y-4 p-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#22A45D]/10 text-2xl text-[#22A45D]">{isSettled ? "✓" : "🔒"}</div>
          <h2 className="text-xl font-black text-[#0B6B46]">{isSettled ? "Contrat entièrement soldé" : "Espace bénéficiaire"}</h2>
          <p className="text-sm text-muted-foreground">{isSettled ? "Félicitations ! Aucune action de paiement n’est nécessaire pour ce contrat." : "Les opérations financières ne sont pas disponibles pour ce compte."}</p>
          {isSettled && <Badge className="agri-settled-badge mx-auto border border-[#FFD700] bg-[#FFD700] text-[#14532D]">CONTRAT SOLDÉ · AGRICAPITAL</Badge>}
          <Button onClick={onBack} className="w-full bg-[#0B6B46] text-white hover:bg-[#075638]">Retour à mon espace</Button>
        </CardContent>
      </Card>
    </div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="py-3 px-4 shadow-lg sticky top-0 z-50 bg-[image:var(--gradient-hero)]">
        <div className="mx-auto flex w-full min-w-0 max-w-7xl items-center gap-3 px-3 sm:px-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="text-primary-foreground hover:bg-card/15 h-9 w-9"><ArrowLeft className="h-5 w-5" /></Button>
          <div className="bg-card rounded-lg p-1 flex items-center justify-center"><img src={logoWhiteBg} alt="AgriCapital" className="h-9 sm:h-10 object-contain" /></div>
          <span className="font-semibold text-primary-foreground text-sm">Paiement</span>
        </div>
      </header>

      <main className="client-page-content min-w-0 flex-1 mx-auto w-full max-w-5xl space-y-4 px-3 py-4 sm:px-4 lg:py-8">
        {isPreActivation && client?.id_unique && <Card className="rounded-lg border-primary/30"><CardContent className="flex flex-wrap items-center justify-between gap-2 p-3"><span className="text-sm text-muted-foreground">Votre numéro client</span><strong className="text-base font-black tracking-wide">{client.id_unique}</strong></CardContent></Card>}

        {client?.offres && <Card className="rounded-lg shadow-md border-2" style={{ borderColor: client.offres.couleur || "#00643C" }}><CardContent className="p-3 flex items-center gap-3"><div className="h-10 w-10 rounded-lg flex items-center justify-center text-primary-foreground shrink-0" style={{ background: client.offres.couleur || "#00643C" }}><Leaf className="h-5 w-5" /></div><div><p className="text-sm uppercase tracking-wide text-muted-foreground font-semibold">Votre offre</p><p className="font-bold text-sm">{client.offres.nom}</p></div></CardContent></Card>}

        <Card className="card-brand rounded-lg shadow-md">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /><h3 className="text-base font-bold">{isPreActivation ? "Régler le paiement initial" : "Choisissez ce que vous souhaitez payer"}</h3></div>
            <div className="space-y-2">
              <Label>Portée du paiement</Label>
              <Select value={selectedPlantation} onValueChange={setSelectedPlantation}>
                <SelectTrigger className="h-11 rounded-lg"><SelectValue placeholder="Choisir le périmètre du paiement" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Compte global · toutes les souscriptions payantes</SelectItem>
                  {plantations.filter((p: any) => p.client_id === client?.id).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nom_plantation || p.id_unique || "Plantation"} · {Number(p.superficie_ha || 0).toLocaleString("fr-FR")} ha</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{selectedPlantation === "all" ? "Le montant cumule les souscriptions payantes actives. Chaque échéancier conserve sa propre durée." : "Le paiement sera rattaché uniquement à cette plantation et à sa souscription."}</p>
              {plantation?.paiement_etat?.sans_contrat_financier && <p className="text-sm text-amber-700">Cette plantation bénéficiaire n’a pas de souscription financière active. Choisissez le compte global ou une plantation payante.</p>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {!isPreActivation && <Button type="button" variant={typePaiement === "mensualite" ? "default" : "outline"} onClick={() => setTypePaiement("mensualite")} className="h-11 rounded-lg">Mensualités</Button>}
              {dbInitialDue > 0 && <Button type="button" variant={typePaiement === "pi" ? "default" : "outline"} onClick={() => setTypePaiement("pi")} className="h-11 rounded-lg">Paiement initial</Button>}
            </div>

            {typePaiement === "mensualite" && <>
              {hasArrears && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
                  <div>
                    <p className="text-sm font-black text-destructive">Vous avez un arriéré</p>
                    <p className="text-sm text-muted-foreground">Vous pouvez le rattraper maintenant, sans créer de nouvelle échéance.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg bg-background p-3"><p className="text-muted-foreground">Arriéré réel</p><p className="font-black">{fmt(dbArrears)}</p></div>
                    <div className="rounded-lg bg-background p-3"><p className="text-muted-foreground">Retard réel</p><p className="font-black">{dbLateDays} j</p></div>
                  </div>
                  <Button type="button" variant="destructive" className="w-full rounded-lg" onClick={() => { setPaymentMode("custom"); setCustomAmount(String(Math.round(dbArrears))); }}>
                    Rattraper {fmt(dbArrears)}
                  </Button>
                </div>
              )}
              <div className="rounded-lg bg-primary/5 border border-primary/15 p-4">
                <p className="text-sm text-muted-foreground">Mensualité</p>
                <p className="text-2xl font-black text-primary">{fmt(dbMonthlyBase)}</p>
                {dbArrears > 0 && <p className="text-sm text-destructive mt-1"><AlertTriangle className="inline h-3.5 w-3.5 mr-1" />Arriéré réel : {dbLateDays} jour{dbLateDays > 1 ? "s" : ""} · {fmt(dbArrears)}</p>}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {choices.map((choice) => <Button variant="outline" key={choice.value} type="button" onClick={() => setPaymentMode(choice.value)} className={"rounded-lg border-2 p-3 text-left text-sm font-bold transition-all " + (paymentMode === choice.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")}>{choice.label}</Button>)}
              </div>

              {paymentMode === "custom" && <div className="space-y-2"><Label>Montant à payer maintenant</Label><Input type="number" min="1" step="1" value={customAmount} onChange={(e) => setCustomAmount(e.target.value)} placeholder="Ex. 25000" /><p className="text-sm text-muted-foreground">Ce montant est payé maintenant. Aucun paiement futur n'est créé.</p></div>}

              <div className="rounded-lg bg-muted/30 p-4 space-y-2">
                <div className="flex justify-between text-sm"><span>Montant à payer maintenant</span><strong className="text-primary">{fmt(montantTotal)}</strong></div>
                <p className="text-sm text-muted-foreground"></p>
              </div>
            </>}

            {typePaiement === "pi" && (plantation || isPreActivation) && <div className="rounded-lg bg-muted/30 p-4 space-y-2 text-sm">{plantation && <><div className="flex justify-between"><span>Plantation</span><strong>{plantation.nom_plantation || plantation.id_unique}</strong></div><div className="flex justify-between"><span>Surface</span><strong>{plantation.superficie_ha} ha</strong></div></>}<div className="flex justify-between"><span>Solde du paiement initial</span><strong className="text-primary">{fmt(dbInitialDue)}</strong></div></div>}

            {typePaiement === "mensualite" && plantation && <div className="rounded-lg border p-4"><div className="flex items-center gap-2 text-sm font-bold"><MapPin className="h-4 w-4 text-primary" />{plantation.nom_plantation || plantation.id_unique}</div><p className="text-sm text-muted-foreground mt-1">{plantation.superficie_activee || 0} ha actifs</p></div>}

            {!isPiFree && <div className="rounded-lg border p-4 space-y-3">
              <div className="flex justify-between items-center"><p className="text-sm font-bold">Mode de paiement</p><Badge variant="outline">Frais absorbés</Badge></div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" type="button" onClick={() => setPaymentMethod("momo")} className={"rounded-lg border-2 p-3 text-left " + (paymentMethod === "momo" ? "border-primary bg-primary/5" : "border-border")}><p className="text-sm font-black">Mobile Money</p></Button>
                <Button variant="outline" type="button" onClick={() => setPaymentMethod("card")} className={"rounded-lg border-2 p-3 text-left " + (paymentMethod === "card" ? "border-primary bg-primary/5" : "border-border")}><p className="text-sm font-black">Carte bancaire</p></Button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm"><div className="rounded-lg bg-muted/40 p-3"><p className="text-muted-foreground">Débit client</p><p className="font-black text-primary">{fmt(kkiapayPricing.clientDebitAmount)}</p></div><div className="rounded-lg bg-muted/40 p-3"><p className="text-muted-foreground">Frais absorbés</p><p className="font-black">{fmt(kkiapayPricing.absorbedByAgriCapital)}</p></div></div>
            </div>}

            <Button onClick={handleSubmit} disabled={loading || (!plantation && selectedPlantation !== "all" && !isPreActivation) || (montantTotal <= 0 && !isPiFree)} className="w-full h-14 rounded-lg font-bold">{loading ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <CreditCard className="h-5 w-5 mr-2" />}{isPreActivation ? "Payer le paiement initial" : isPiFree ? "Activer ma plantation (0 F)" : (isDemoAccount ? "Payer maintenant (simulation)" : "Payer maintenant")}</Button>
            <p className="text-sm text-center text-muted-foreground">{isPreActivation ? "Après confirmation du paiement initial, votre compte client sera activé automatiquement selon les conditions de votre contrat." : "Votre choix indique uniquement le montant que vous souhaitez régler maintenant. Aucun paiement futur ni échéancier n'est créé."}</p>
          </CardContent>
        </Card>

        {client?.portal_config?.contact_telephone && <Card className="rounded-lg"><CardContent className="p-3 text-center"><a href={`tel:${client.portal_config.contact_telephone}`} className="inline-flex items-center gap-2 text-primary font-bold text-sm"><Phone className="h-4 w-4" />{client.portal_config.contact_telephone}</a></CardContent></Card>}
      </main>
      <footer className="border-t bg-card py-3"><p className="text-sm text-muted-foreground text-center">© {new Date().getFullYear()} AgriCapital</p></footer>
    </div>
  );
};
export default ClientPayment;
