import { useState, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useKkiapay } from "@/hooks/useKkiapay";
import logoWhiteBg from "@/assets/logo-white-bg.png";
import { formatCFA } from "@/utils/pricing";
import { trackEvent } from "@/utils/errorTracker";
import { ArrowLeft, CreditCard, MapPin, AlertTriangle, Loader2, Phone, Leaf } from "lucide-react";

interface ClientPaymentProps { client: any; plantations: any[]; paiements: any[]; onBack: () => void; }
type PaymentMode = "1" | "3" | "6" | "9" | "12" | "custom";
type ClientPaymentMethod = "momo" | "card";
const calculateKkiapayAbsorption = (amount: number, method: ClientPaymentMethod, feeRate: number) => {
  const clientDebitAmount = Math.max(0, Math.round(amount || 0));
  if (method === "card") return { clientDebitAmount, widgetAmount: clientDebitAmount, estimatedFees: 0, feeRate: 0, absorbedByAgriCapital: 0 };
  const theoreticalAmount = Math.max(0, Math.round(clientDebitAmount / (1 + Math.max(0, feeRate))));
  let widgetAmount = theoreticalAmount;
  for (let candidate = Math.max(0, theoreticalAmount - 20); candidate <= theoreticalAmount + 20; candidate += 1) {
    if (candidate + Math.ceil(candidate * Math.max(0, candidate * feeRate)) === clientDebitAmount) { widgetAmount = candidate; break; }
  }
  const estimatedFees = Math.max(0, clientDebitAmount - widgetAmount);
  return { clientDebitAmount, widgetAmount, estimatedFees, feeRate, absorbedByAgriCapital: estimatedFees };
};

const ClientPayment = ({ client, plantations, onBack }: ClientPaymentProps) => {
  const { toast } = useToast();
  const { openPayment, onSuccess, onFailed, onClose } = useKkiapay();
  const [typePaiement, setTypePaiement] = useState<"pi" | "mensualite">("mensualite");
  const [selectedPlantation, setSelectedPlantation] = useState("");
  const [loading, setLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<ClientPaymentMethod>("momo");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("1");
  const [customAmount, setCustomAmount] = useState("");
  const paymentContextRef = useRef<{ reference: string; pricing: ReturnType<typeof calculateKkiapayAbsorption> } | null>(null);

  const dbFinancialState = client?.paiement_etat || {};
  const dbInitialDue = Math.max(0, Number(dbFinancialState?.paiement_initial?.solde || 0));
  const dbMonthlyBase = Math.max(0, Number(dbFinancialState?.mensualite?.montant || dbFinancialState?.mensualite?.montant_a_payer || 0));
  const dbArrears = Math.max(0, Number(dbFinancialState?.mensualite?.montant_arriere || 0));
  const dbLateDays = Math.max(0, Number(dbFinancialState?.mensualite?.jours_retard || 0));
  const hasArrears = dbArrears > 0 || dbLateDays > 0;
  const activeHectares = Math.max(0, Number(dbFinancialState?.mensualite?.hectares_actifs || 0));
  const isDemoAccount = client?.demo === true || client?._demo === true || sessionStorage.getItem("agri_demo") === "1";

  useEffect(() => {
    if (selectedPlantation || plantations.length === 0) return;
    const candidates = typePaiement === "pi"
      ? plantations.filter((p: any) => Number(p.superficie_ha || 0) - Number(p.superficie_activee || 0) > 0)
      : plantations.filter((p: any) => Number(p.superficie_activee || 0) > 0);
    const sorted = [...candidates].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    if (sorted[0]) setSelectedPlantation(sorted[0].id);
  }, [typePaiement, plantations, selectedPlantation]);

  const plantation = useMemo(() => plantations.find((p) => p.id === selectedPlantation), [selectedPlantation, plantations]);

  const montantTotal = useMemo(() => {
    if (typePaiement === "pi") return dbInitialDue;
    if (paymentMode === "custom") return Math.max(0, Number(customAmount) || 0);
    return paymentMode === "custom" ? Math.max(0, Number(customAmount) || 0) : dbMonthlyBase * Number(paymentMode);
  }, [typePaiement, paymentMode, customAmount, dbMonthlyBase, dbInitialDue]);

  const kkiapayFeeRate = Math.max(0, Number(client?.portal_config?.kkiapay_mobile_money_fee_rate || 0));
  const kkiapayPricing = useMemo(() => calculateKkiapayAbsorption(montantTotal, paymentMethod, kkiapayFeeRate), [montantTotal, paymentMethod, kkiapayFeeRate]);
  const isPiFree = typePaiement === "pi" && !!plantation && dbInitialDue <= 0;

  useEffect(() => {
    onSuccess(async (response) => {
      const context = paymentContextRef.current;
      if (!context?.reference) return;
      try {
        const { data, error } = await supabase.functions.invoke("create-payment", {
          body: { action: "confirm", portal_token: sessionStorage.getItem("agri_portal_access_token"), reference: context.reference, kkiapay_transaction_id: response.transactionId, client_debit_amount: context.pricing.clientDebitAmount, fee_absorption_rate: context.pricing.feeRate }
        });
        if (error || !data?.success) throw new Error(data?.error || error?.message || "Confirmation du paiement impossible.");
        toast({ title: "✅ Paiement réussi", description: "Transaction " + response.transactionId + " validée." });
        setTimeout(onBack, 1800);
      } catch (e: any) {
        trackEvent({ level: "error", scope: "payment", message: "Confirmation serveur du paiement échouée", account: client?.id_unique || client?.telephone, context: { error: e?.message } });
        toast({ variant: "destructive", title: "Paiement reçu, confirmation en cours", description: "La transaction a été reçue mais sa validation sécurisée n'est pas encore terminée." });
      } finally { setLoading(false); }
    });
    onFailed((error) => { toast({ variant: "destructive", title: "Paiement échoué", description: error.reason }); setLoading(false); });
    onClose(() => setLoading(false));
  }, [client?.id_unique, client?.telephone, onBack, onFailed, onSuccess, onClose, toast]);

  const handleActivationGratuite = async () => {
    if (!plantation) return;
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
    toast({ title: "✅ Paiement simulé", description: "Référence " + reference + ". Aucun débit réel n'a été effectué." });
    setLoading(false);
    setTimeout(onBack, 1000);
  };

  const handleSubmit = async () => {
    if (typePaiement === "pi" && montantTotal <= 0 && plantation) return handleActivationGratuite();
    if (isDemoAccount) return handleDemoPayment();
    if (!plantation || montantTotal <= 0) {
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
          plantation_id: plantation.id,
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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="py-3 px-4 shadow-lg sticky top-0 z-50 bg-[image:var(--gradient-hero)]">
        <div className="container mx-auto flex items-center gap-3 w-full max-w-7xl">
          <Button variant="ghost" size="icon" onClick={onBack} className="text-white hover:bg-white/15 h-9 w-9"><ArrowLeft className="h-5 w-5" /></Button>
          <div className="bg-white rounded-lg p-1 flex items-center justify-center"><img src={logoWhiteBg} alt="AgriCapital" className="h-9 sm:h-10 object-contain" /></div>
          <span className="font-semibold text-white text-sm">Paiement</span>
        </div>
      </header>

      <main className="client-page-content flex-1 container mx-auto py-4 lg:py-8 space-y-4 max-w-lg lg:max-w-7xl">
        {client?.offres && <Card className="rounded-2xl shadow-md border-2" style={{ borderColor: client.offres.couleur || "#00643C" }}><CardContent className="p-3 flex items-center gap-3"><div className="h-10 w-10 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: client.offres.couleur || "#00643C" }}><Leaf className="h-5 w-5" /></div><div><p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Votre offre</p><p className="font-bold text-sm">{client.offres.nom}</p></div></CardContent></Card>}

        <Card className="card-brand rounded-2xl shadow-md">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /><h3 className="text-base font-bold">Choisissez ce que vous souhaitez payer</h3></div>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={typePaiement === "mensualite" ? "default" : "outline"} onClick={() => setTypePaiement("mensualite")} className="h-11 rounded-xl">Mensualités</Button>
              {dbInitialDue > 0 && <Button type="button" variant={typePaiement === "pi" ? "default" : "outline"} onClick={() => setTypePaiement("pi")} className="h-11 rounded-xl">Paiement initial</Button>}
            </div>

            {typePaiement === "mensualite" && <>
              {hasArrears && (
                <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
                  <div>
                    <p className="text-sm font-black text-destructive">Vous avez un arriéré</p>
                    <p className="text-xs text-muted-foreground">Vous pouvez le rattraper maintenant, sans créer de nouvelle échéance.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-background p-3"><p className="text-muted-foreground">Arriéré réel</p><p className="font-black">{fmt(dbArrears)}</p></div>
                    <div className="rounded-xl bg-background p-3"><p className="text-muted-foreground">Retard réel</p><p className="font-black">{dbLateDays} j</p></div>
                  </div>
                  <Button type="button" variant="destructive" className="w-full rounded-xl" onClick={() => { setPaymentMode("custom"); setCustomAmount(String(Math.round(dbArrears))); }}>
                    Rattraper {fmt(dbArrears)}
                  </Button>
                </div>
              )}
              <div className="rounded-2xl bg-primary/5 border border-primary/15 p-4">
                <p className="text-xs text-muted-foreground">Mensualité réelle fournie par la DB</p>
                <p className="text-2xl font-black text-primary">{fmt(dbMonthlyBase)}</p>
                {dbArrears > 0 && <p className="text-xs text-destructive mt-1"><AlertTriangle className="inline h-3.5 w-3.5 mr-1" />Arriéré réel : {dbLateDays} jour{dbLateDays > 1 ? "s" : ""} · {fmt(dbArrears)}</p>}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {choices.map((choice) => <button key={choice.value} type="button" onClick={() => setPaymentMode(choice.value)} className={"rounded-xl border-2 p-3 text-left text-xs font-bold transition-all " + (paymentMode === choice.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")}>{choice.label}</button>)}
              </div>

              {paymentMode === "custom" && <div className="space-y-2"><Label>Montant à payer maintenant</Label><Input type="number" min="1" step="1" value={customAmount} onChange={(e) => setCustomAmount(e.target.value)} placeholder="Ex. 25000" /><p className="text-[11px] text-muted-foreground">Ce montant est payé maintenant. Aucun paiement futur n'est créé.</p></div>}

              <div className="rounded-2xl bg-muted/30 p-4 space-y-2">
                <div className="flex justify-between text-sm"><span>Montant à payer maintenant</span><strong className="text-primary">{fmt(montantTotal)}</strong></div>
                <p className="text-[10px] text-muted-foreground">Le montant provient de l’état financier réel fourni par la base. La validation finale reste calculée côté serveur.</p>
              </div>
            </>}

            {typePaiement === "pi" && plantation && <div className="rounded-2xl bg-muted/30 p-4 space-y-2 text-sm"><div className="flex justify-between"><span>Plantation</span><strong>{plantation.nom_plantation || plantation.id_unique}</strong></div><div className="flex justify-between"><span>Surface</span><strong>{plantation.superficie_ha} ha</strong></div><div className="flex justify-between"><span>Solde Paiement initial réel</span><strong className="text-primary">{fmt(dbInitialDue)}</strong></div></div>}

            {typePaiement === "mensualite" && plantation && <div className="rounded-2xl border p-4"><div className="flex items-center gap-2 text-sm font-bold"><MapPin className="h-4 w-4 text-primary" />{plantation.nom_plantation || plantation.id_unique}</div><p className="text-xs text-muted-foreground mt-1">{plantation.superficie_activee || 0} ha actifs</p></div>}

            {!isPiFree && <div className="rounded-2xl border p-4 space-y-3">
              <div className="flex justify-between items-center"><p className="text-sm font-bold">Mode de paiement</p><Badge variant="outline">Frais absorbés</Badge></div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setPaymentMethod("momo")} className={"rounded-xl border-2 p-3 text-left " + (paymentMethod === "momo" ? "border-primary bg-primary/5" : "border-border")}><p className="text-xs font-black">Mobile Money</p></button>
                <button type="button" onClick={() => setPaymentMethod("card")} className={"rounded-xl border-2 p-3 text-left " + (paymentMethod === "card" ? "border-primary bg-primary/5" : "border-border")}><p className="text-xs font-black">Carte bancaire</p></button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-muted/40 p-3"><p className="text-muted-foreground">Débit client</p><p className="font-black text-primary">{fmt(kkiapayPricing.clientDebitAmount)}</p></div><div className="rounded-xl bg-muted/40 p-3"><p className="text-muted-foreground">Frais absorbés</p><p className="font-black">{fmt(kkiapayPricing.absorbedByAgriCapital)}</p></div></div>
            </div>}

            <Button onClick={handleSubmit} disabled={loading || !plantation || (montantTotal <= 0 && !isPiFree)} className="w-full h-13 rounded-xl font-bold">{loading ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <CreditCard className="h-5 w-5 mr-2" />}{isPiFree ? "Activer ma plantation (0 F)" : "Payer maintenant"}</Button>
            <p className="text-[10px] text-center text-muted-foreground">Votre choix indique uniquement le montant que vous souhaitez régler maintenant. Aucun paiement futur ni échéancier n'est créé.</p>
          </CardContent>
        </Card>

        {client?.portal_config?.contact_telephone && <Card className="rounded-2xl"><CardContent className="p-3 text-center"><a href={`tel:${client.portal_config.contact_telephone}`} className="inline-flex items-center gap-2 text-primary font-bold text-sm"><Phone className="h-4 w-4" />{client.portal_config.contact_telephone}</a></CardContent></Card>}
      </main>
      <footer className="border-t bg-card py-3"><p className="text-xs text-muted-foreground text-center">© {new Date().getFullYear()} AgriCapital</p></footer>
    </div>
  );
};
export default ClientPayment;
