import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import logoWhiteBg from "@/assets/logo-white-bg.png";
import { Loader2, ArrowRight, MessageCircle, ShieldCheck, KeyRound, ArrowLeft, Lock, Sparkles, CheckCircle2 } from "lucide-react";
import { Helmet } from "react-helmet-async";
import PortalAccessSupportDialog from "@/components/client/PortalAccessSupportDialog";
import { createDemoAccount, DEMO_ACCESS_CODE } from "@/data/demoAccount";

interface ClientHomeProps {
  onLogin: (client: any, plantations: any[], paiements: any[]) => void;
}
type Step = "phone" | "setup" | "login" | "demo";

const ClientHome = ({ onLogin }: ClientHomeProps) => {
  const { toast } = useToast();
  const [telephone, setTelephone] = useState("");
  const [telephoneIndicatif, setTelephoneIndicatif] = useState("+225");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>("phone");
  const [accessCode, setAccessCode] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [clientName, setClientName] = useState("");
  const [supportOpen, setSupportOpen] = useState(false);
  const [demoData, setDemoData] = useState<any>(null);

  useEffect(() => { document.title = "Portail Client | AgriCapital"; }, []);

  const cleanPhone = () => telephoneIndicatif.replace(/[^+\d]/g, "") + telephone.replace(/\D/g, "");
  const formatPhoneDisplay = (value: string) =>
    value.replace(/\D/g, "").slice(0, 10).replace(/(\d{2})(?=\d)/g, "$1 ").trim();

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setTelephone(e.target.value.replace(/\D/g, "").slice(0, 10));

  const handleIndicatifChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^+\d]/g, "").replace(/(?!^)\+/g, "").slice(0, 5);
    setTelephoneIndicatif(value || "+225");
  };

  const saveSession = (data: any, token?: string, demo = false) => {
    const client = data.client;
    if (!client) throw new Error("Données client indisponibles.");
    sessionStorage.setItem("agri_client", JSON.stringify(client));
    sessionStorage.setItem("agri_plantations", JSON.stringify(data.plantations || []));
    sessionStorage.setItem("agri_paiements", JSON.stringify(data.paiements || []));
    sessionStorage.setItem("agri_demo", demo ? "1" : "0");
    if (token) sessionStorage.setItem("agri_portal_access_token", token);
    else sessionStorage.removeItem("agri_portal_access_token");
    onLogin(client, data.plantations || [], data.paiements || []);
  };

  const loadRealClient = async (token: string, demo = false) => {
    const { data, error } = await supabase.functions.invoke("client-portal-data", {
      body: { access_token: token },
    });
    if (error || !data?.success) {
      throw new Error(data?.error || error?.message || "Impossible de charger votre espace client.");
    }
    saveSession(data, token, demo || data.client?.demo === true);
  };

  const handlePhoneContinue = async () => {
    const phone = cleanPhone();
    if (telephone.replace(/\D/g, "").length < 10) {
      toast({ variant: "destructive", title: "Numéro incomplet", description: "Veuillez saisir les 10 chiffres du numéro ivoirien." });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("portal-access", {
        body: { action: "inspect", telephone: phone },
      });

      if (!error && data?.success) {
        if (data.demo) {
          setClientName(data.client?.nom_complet || "Compte DÉMO");
          // Le compte démo est 100% local : jamais chargé depuis la base.
          setDemoData(createDemoAccount(phone));
          setStep("demo");
        } else {
          setClientName(data.nom_complet || "");
          setAccessCode("");
          setConfirmCode("");
          setDemoData(null);
          setStep(data.needs_access_code_setup ? "setup" : "login");
        }
        return;
      }

      if (data?.code === "CLIENT_NOT_FOUND" || error?.context?.status === 404) {
        throw new Error("Aucun espace client réel actif n'est rattaché à ce numéro.");
      }

      throw new Error(data?.error || error?.message || "Aucun espace client actif trouvé pour ce numéro.");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur", description: e.message || "Connexion impossible." });
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async () => {
    if (!/^\d{4}$/.test(accessCode) || accessCode !== confirmCode) {
      toast({ variant: "destructive", title: "Code invalide", description: "Les deux champs doivent contenir le même code à 4 chiffres." });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("portal-access", {
        body: { action: "setup", telephone: cleanPhone(), code: accessCode, confirm_code: confirmCode },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || "Enregistrement impossible.");
      await loadRealClient(data.access_token);
      sessionStorage.setItem("agri_access_code_saved", "1");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erreur", description: e.message || "Impossible d'enregistrer le code." });
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!/^\d{4}$/.test(accessCode)) {
      toast({ variant: "destructive", title: "Code requis", description: "Veuillez saisir votre code d'accès à 4 chiffres." });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("portal-access", {
        body: { action: "login", telephone: cleanPhone(), code: accessCode },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || "Code incorrect.");
      await loadRealClient(data.access_token);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Connexion refusée", description: e.message || "Code incorrect." });
    } finally {
      setLoading(false);
    }
  };

  const handleDemoEnter = () => {
    const demo = demoData || createDemoAccount(cleanPhone());
    if (!demo?.client || demo.demo_code !== DEMO_ACCESS_CODE) {
      toast({ variant: "destructive", title: "Démonstration indisponible", description: "Les données de démonstration sont indisponibles." });
      return;
    }
    saveSession(demo, undefined, true);
  };

  const reset = () => {
    setStep("phone");
    setAccessCode("");
    setConfirmCode("");
    setClientName("");
    setDemoData(null);
    setTelephone("");
    setTelephoneIndicatif("+225");
  };

  const codeInput = (value: string, setter: (v: string) => void) => (
    <Input
      value={value}
      onChange={(e) => setter(e.target.value.replace(/\D/g, "").slice(0, 4))}
      inputMode="numeric"
      maxLength={4}
      autoComplete="one-time-code"
      type="password"
      placeholder="••••"
      className="h-14 rounded-xl text-center text-2xl tracking-[0.5em] font-semibold"
    />
  );

  const welcomeText = clientName ? "Bienvenue, " + clientName + "." : "Saisissez votre code d'accès à 4 chiffres.";

  return (
    <>
      <Helmet>
        <title>Portail Client | AgriCapital</title>
        <meta name="description" content="Accédez à votre espace client AgriCapital." />
      </Helmet>

      <main className="min-h-[100svh] bg-[#F7FAF8] px-3 py-4 sm:px-6 sm:py-8 flex items-center">
        <div className="mx-auto grid w-full max-w-[1440px] lg:grid-cols-[minmax(0,1.05fr)_minmax(520px,0.95fr)] gap-6 lg:gap-10 items-stretch">
          <aside className="hidden lg:flex rounded-[2rem] overflow-hidden bg-gradient-to-br from-[#00643C] via-[#007A48] to-[#004D2E] text-white p-10 xl:p-14 min-h-[680px] relative">
            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,white,transparent_38%)]" />
            <div className="relative z-10 flex flex-col justify-between w-full">
              <div>
                <img src={logoWhiteBg} alt="AgriCapital" className="h-auto w-[clamp(180px,16vw,280px)] max-w-full object-contain bg-white rounded-xl p-1" />
                <p className="mt-10 text-sm uppercase tracking-[0.22em] text-white/65">Investir la terre. Cultiver l’avenir.</p>
                <h2 className="mt-4 max-w-2xl text-4xl xl:text-5xl font-black leading-tight">Votre patrimoine agricole, suivi depuis un seul espace.</h2>
                <p className="mt-5 max-w-xl text-base leading-7 text-white/80">Paiements, localisation GPS, progression technique, rapports, médias et échanges avec votre équipe AgriCapital.</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {["Paiements réels", "Suivi GPS", "Rapports terrain"].map((x) => (
                  <div key={x} className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
                    <p className="text-xs font-semibold">{x}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <div className="flex items-center justify-center">
            <div className="w-full max-w-[620px]">
              <div className="mb-4 sm:mb-6 flex justify-center lg:hidden">
                <img src={logoWhiteBg} alt="AgriCapital" className="h-auto w-[clamp(190px,52vw,320px)] max-w-[88vw] object-contain" />
              </div>

              <section className="flex min-h-[620px] lg:min-h-[680px] flex-col justify-center rounded-3xl border border-[#E3EAE5] bg-white p-5 sm:p-7 lg:p-9 shadow-xl shadow-black/5">
                <div className="mb-7 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EAF5EF] text-[#00643C]">
                    {step === "phone" ? <ShieldCheck className="h-6 w-6" /> : <KeyRound className="h-6 w-6" />}
                  </div>
                  <h1 className="text-2xl font-bold text-[#123326]">Votre espace client</h1>
                  <p className="mt-2 text-sm leading-6 text-[#68756E]">
                    {step === "phone"
                      ? "Connectez-vous avec le numéro utilisé lors de votre contractualisation."
                      : step === "setup"
                        ? "Créez votre code d'accès personnel."
                        : step === "demo"
                          ? "Compte de démonstration AgriCapital : toutes les rubriques sont alimentées avec des données fictives intégrées au portail, sans écriture CRM."
                          : welcomeText}
                  </p>
                </div>

                {step !== "phone" && (
                  <button type="button" onClick={reset} className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-[#00643C] hover:underline">
                    <ArrowLeft className="h-4 w-4" /> Modifier le numéro
                  </button>
                )}

                {step === "phone" && (
                  <div className="space-y-5">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-[#24352D]">Numéro de téléphone</label>
                      <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
                        <Input type="tel" inputMode="tel" autoComplete="tel-country-code" value={telephoneIndicatif} onChange={handleIndicatifChange} aria-label="Indicatif international" placeholder="+225" className="h-14 rounded-xl text-center text-lg font-semibold" />
                        <Input
                          type="tel"
                          inputMode="numeric"
                          autoComplete="tel-national"
                          value={formatPhoneDisplay(telephone)}
                          onChange={handlePhoneChange}
                          onKeyDown={(e) => { if (e.key === "Enter") void handlePhoneContinue(); }}
                          placeholder="07 00 00 00 00"
                          className="h-14 w-full rounded-xl text-lg"
                        />
                      </div>
                      <p className="mt-2 text-[11px] text-[#78847E]">L’indicatif est conservé pour la saisie et la recherche ; le CRM conserve le numéro local.</p>
                    </div>
                    <Button onClick={() => void handlePhoneContinue()} disabled={loading} className="h-14 w-full rounded-xl bg-[#00643C] text-white hover:bg-[#004D2E]">
                      {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Chargement…</> : <>Vérifier le numéro <ArrowRight className="ml-2 h-5 w-5" /></>}
                    </Button>
                    <button
                      type="button"
                      onClick={() => {
                        const demo = createDemoAccount("+2250000000000");
                        setClientName(demo.client.nom_complet);
                        setDemoData(demo);
                        setStep("demo");
                      }}
                      className="w-full text-xs font-semibold text-[#00643C] hover:underline"
                    >
                      Accéder uniquement à la démonstration
                    </button>
                  </div>
                )}

                {step === "setup" && (
                  <div className="space-y-5">
                    <div className="rounded-xl bg-[#F5F8F6] p-4 text-sm text-[#53625A]">
                      <div className="flex items-center gap-2 font-semibold text-[#234137]"><Sparkles className="h-4 w-4 text-[#00643C]" /> Première connexion</div>
                      <p className="mt-1">Choisissez un code à 4 chiffres pour vos prochaines connexions.</p>
                    </div>
                    <div><label className="mb-2 block text-sm font-semibold text-[#24352D]">Nouveau code</label>{codeInput(accessCode, setAccessCode)}</div>
                    <div><label className="mb-2 block text-sm font-semibold text-[#24352D]">Confirmer le code</label>{codeInput(confirmCode, setConfirmCode)}</div>
                    <Button onClick={() => void handleSetup()} disabled={loading} className="h-14 w-full rounded-xl bg-[#00643C] text-white hover:bg-[#004D2E]">
                      {loading ? "Création…" : <>Créer mon accès <CheckCircle2 className="ml-2 h-5 w-5" /></>}
                    </Button>
                  </div>
                )}

                {step === "demo" && (
                  <div className="space-y-5">
                    <div className="rounded-xl border border-[#E5C46A] bg-[#FFF9E8] p-5 text-center">
                      <Sparkles className="mx-auto mb-2 h-6 w-6 text-[#B47A00]" />
                      <p className="text-sm font-semibold text-[#5E4700]">Compte DÉMO</p>
                      <p className="mt-1 text-xs leading-5 text-[#76651E]">Démonstration complète alimentée par le front : profil, progression, GPS, photos, documents, rapports, notifications et messages. Aucune donnée CRM n'est créée.</p>
                      <div className="mt-4 rounded-xl bg-white px-4 py-3">
                        <p className="text-[11px] uppercase tracking-wider text-[#7B7564]">Compte</p>
                        <p className="mt-1 text-xl font-black text-[#00643C]">{demoData?.client?.nom_complet || "Compte DÉMO AgriCapital"}</p>
                        <p className="mt-3 text-[11px] uppercase tracking-wider text-[#7B7564]">Code d’accès démo</p>
                        <p className="mt-1 text-3xl font-black tracking-[0.35em] text-[#00643C]">{demoData?.demo_code || DEMO_ACCESS_CODE}</p>
                      </div>
                    </div>
                    <Button onClick={handleDemoEnter} disabled={loading} className="h-14 w-full rounded-xl bg-[#00643C] text-white hover:bg-[#004D2E]">
                      Ouvrir la démonstration <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </div>
                )}

                {step === "login" && (
                  <div className="space-y-5">
                    <div className="rounded-xl bg-[#F5F8F6] p-4 text-center text-sm text-[#53625A]">
                      <Lock className="mx-auto mb-2 h-5 w-5 text-[#00643C]" />
                      Saisissez votre code d'accès à 4 chiffres.
                    </div>
                    {codeInput(accessCode, setAccessCode)}
                    <Button onClick={() => void handleLogin()} disabled={loading} className="h-14 w-full rounded-xl bg-[#00643C] text-white hover:bg-[#004D2E]">
                      {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Connexion…</> : <>Accéder à mon espace <ArrowRight className="ml-2 h-5 w-5" /></>}
                    </Button>
                  </div>
                )}

                <div className="mt-7 border-t border-[#E8ECE9] pt-5 text-center">
                  <p className="mb-3 text-xs text-[#78847E]">Besoin d'aide pour accéder à votre espace ?</p>
                  <Button variant="outline" onClick={() => setSupportOpen(true)} className="h-11 rounded-xl border-[#D8E2DC] text-[#00643C]">
                    <MessageCircle className="mr-2 h-4 w-4" /> Contacter AgriCapital
                  </Button>
                </div>
              </section>

              <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-[#7A867F]">
                <ShieldCheck className="h-3.5 w-3.5" /> Accès sécurisé à votre espace personnel
              </p>
            </div>
          </div>
        </div>
      </main>

      <PortalAccessSupportDialog open={supportOpen} onOpenChange={setSupportOpen} initialPhone={cleanPhone()} />
    </>
  );
};

export default ClientHome;
