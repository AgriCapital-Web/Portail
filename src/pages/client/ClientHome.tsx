import { lazy, Suspense, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import logoWhiteBg from "@/assets/logo-white-bg.png";
import { Loader2, ArrowRight, MessageCircle, ShieldCheck, KeyRound, ArrowLeft, Lock, Sparkles, CheckCircle2 } from "lucide-react";
import { Helmet } from "react-helmet-async";
import PortalAccessSupportDialog from "@/components/client/PortalAccessSupportDialog";
import { createDemoAccount } from "@/data/demoAccount";
const PhoneNumberField = lazy(() => import("@/components/client/PhoneNumberField"));
import { usePortalReferences } from "@/hooks/usePortalReferences";

interface ClientHomeProps {
  onLogin: (client: any, plantations: any[], paiements: any[]) => void;
}
type Step = "phone" | "setup" | "login";

const ClientHome = ({ onLogin }: ClientHomeProps) => {
  const { toast } = useToast();
  const [telephone, setTelephone] = useState<string | undefined>("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<Step>("phone");
  const [accessCode, setAccessCode] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [clientName, setClientName] = useState("");
  const [supportOpen, setSupportOpen] = useState(false);
  const { data: countries = [], isLoading: countriesLoading, isError: countriesError } = usePortalReferences("pays_telephone");

  useEffect(() => { document.title = "Portail Client | AgriCapital"; }, []);

  const cleanPhone = () => telephone?.replace(/[^+\d]/g, "") || "";


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
    const { isValidPhoneNumber } = await import("react-phone-number-input");
    if (!phone || !isValidPhoneNumber(phone)) {
      toast({ variant: "destructive", title: "Numéro invalide", description: "Veuillez sélectionner le pays puis saisir un numéro de téléphone valide." });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("portal-access", {
        body: { action: "inspect", telephone: phone },
      });

      if (!error && data?.success) {
        if (data.demo) {
          handleDemoEnter();
        } else {
          setClientName(data.nom_complet || "");
          setAccessCode("");
          setConfirmCode("");
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

      // Un essai précédent peut avoir enregistré le code avant qu'une étape secondaire échoue.
      // En cas de conflit 409, ne pas laisser le client bloqué sur l'écran « première connexion » :
      // vérifier le code saisi via le flux de connexion normal, sans contourner la vérification.
      if (error?.context?.status === 409 || (!error && data?.needs_access_code_setup === false && !data?.success)) {
        const loginResult = await supabase.functions.invoke("portal-access", {
          body: { action: "login", telephone: cleanPhone(), code: accessCode },
        });
        if (!loginResult.error && loginResult.data?.success && loginResult.data?.access_token) {
          await loadRealClient(loginResult.data.access_token);
          sessionStorage.setItem("agri_access_code_saved", "1");
          return;
        }
        throw new Error("Un code d'accès existe déjà pour ce compte. Vérifiez le code saisi ou contactez AgriCapital pour réinitialiser votre accès.");
      }

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
    ["agri_demo_messages", "agri_demo_notifications", "agri_notified_ids", "agri_access_code_saved"].forEach(key => sessionStorage.removeItem(key));
    saveSession(createDemoAccount(), undefined, true);
  };

  const reset = () => {
    setStep("phone");
    setAccessCode("");
    setConfirmCode("");
    setClientName("");
    setTelephone("");
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
      className="h-14 rounded-lg text-center text-2xl tracking-[0.5em] font-semibold"
    />
  );

  const welcomeText = clientName ? "Bienvenue, " + clientName + "." : "Saisissez votre code d'accès à 4 chiffres.";

  return (
    <>
      <Helmet>
        <title>Portail Client | AgriCapital</title>
        <meta name="description" content="Accédez à votre espace client AgriCapital." />
      </Helmet>

      <main className="client-login-page min-h-[100svh] w-full bg-background overflow-x-hidden">
        <div className="min-h-[100svh] w-full grid grid-cols-1 md:grid-cols-[52%_48%]">
          <aside className="relative hidden md:flex min-h-[100svh] flex-col items-center justify-center overflow-hidden bg-[#00643C] px-8 py-10 text-white">
            <div aria-hidden="true" className="pointer-events-none absolute left-[11%] top-[12%] h-40 w-40 rounded-full border border-white/5" />
            <div aria-hidden="true" className="pointer-events-none absolute bottom-[15%] right-[9%] h-64 w-64 rounded-full border border-white/5" />
            <div className="relative z-10 flex w-full max-w-xl flex-col items-center text-center">
              <img src={logoWhiteBg} alt="AgriCapital" className="client-login-logo h-auto w-[clamp(320px,42vw,540px)] max-w-full max-h-[clamp(150px,25vh,240px)] object-contain" />
              <p className="mt-3 text-[clamp(1.25rem,2.5vw,2rem)] font-medium leading-tight text-[#F59E0B]">Investir la terre. Cultiver l’avenir.</p>
              <p className="mt-28 text-xl font-semibold">Espace client</p>
            </div>
            <p className="absolute bottom-6 left-4 right-4 text-center text-xs text-white/70">© 2026 AgriCapital - Investir la terre. Cultiver l’avenir.</p>
          </aside>
          <section className="flex min-h-[100svh] items-center justify-center bg-background px-4 py-6 sm:px-6 md:px-10 lg:px-14">
            <div className="w-full max-w-xl min-w-0">
              <div className="mb-4 flex justify-center md:hidden">
                <img src={logoWhiteBg} alt="AgriCapital" className="client-login-logo h-auto w-[clamp(240px,52vw,420px)] max-w-full max-h-[clamp(100px,20vh,170px)] object-contain mix-blend-multiply" />
              </div>
              <section className="client-login-card flex flex-col justify-center rounded-2xl border border-border bg-card p-3 min-[420px]:p-4 sm:p-5 lg:p-6 shadow-xl min-w-0">
                <div className="mb-3 sm:mb-4 text-center">
                  <div className="mx-auto mb-2 flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-muted text-primary">
                    {step === "phone" ? <ShieldCheck className="h-5 w-5 sm:h-6 sm:w-6" /> : <KeyRound className="h-5 w-5 sm:h-6 sm:w-6" />}
                  </div>
                  <h1 className="text-[clamp(1.55rem,5vw,2rem)] leading-tight font-bold text-primary">Votre espace client</h1>
                  <p className="mt-1.5 text-[clamp(0.875rem,1.5vw,1rem)] leading-snug text-muted-foreground">
                    {step === "phone"
                      ? "Connectez-vous avec le numéro utilisé lors de votre contractualisation."
                      : step === "setup"
                        ? "Créez votre code d'accès personnel."
                          : welcomeText}
                  </p>
                </div>

                {step !== "phone" && (
                  <Button variant="ghost" type="button" onClick={reset} className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
                    <ArrowLeft className="h-4 w-4" /> Modifier le numéro
                  </Button>
                )}

                {step === "phone" && (
                  <div className="space-y-2.5 sm:space-y-3">
                    <div>
                      <label className="mb-1 block text-[clamp(0.875rem,1.3vw,1rem)] font-semibold text-primary">Numéro de téléphone</label>
                      <Suspense fallback={<Input value={telephone || ""} onChange={(e) => setTelephone(e.target.value)} placeholder="+225 07 00 00 00 00" disabled={countriesLoading || countriesError} aria-label="Numéro de téléphone" className="phone-input" />}>
                        <PhoneNumberField
                          countries={countries.map((row) => row.code)}
                          disabled={countriesLoading || countriesError}
                          value={telephone}
                          onChange={setTelephone}
                          onKeyDown={(e) => { if (e.key === "Enter") void handlePhoneContinue(); }}
                        />
                      </Suspense>
                      {countriesError && <p role="alert" className="mt-2 text-sm text-destructive">La liste des pays est indisponible. Réessayez dans quelques instants.</p>}
                    </div>
                    <Button onClick={() => void handlePhoneContinue()} disabled={loading || countriesLoading || countriesError} className="min-h-10 h-auto py-2.5 w-full rounded-xl whitespace-normal text-[clamp(0.875rem,1.3vw,1rem)] leading-snug bg-primary text-primary-foreground hover:bg-muted">
                      {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Chargement…</> : <>Vérifier le numéro <ArrowRight className="ml-2 h-5 w-5" /></>}
                    </Button>
                    <Button type="button" variant="outline" onClick={handleDemoEnter} className="min-h-10 h-auto py-2.5 w-full rounded-xl whitespace-normal text-[clamp(0.875rem,1.3vw,1rem)] leading-snug">
                      <Sparkles className="mr-2 h-5 w-5" /> Accéder à la démonstration
                    </Button>
                  </div>
                )}

                {step === "setup" && (
                  <div className="space-y-3">
                    <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2 font-semibold text-primary"><Sparkles className="h-4 w-4 text-primary" /> Première connexion</div>
                      <p className="mt-1">Choisissez un code à 4 chiffres pour vos prochaines connexions.</p>
                    </div>
                    <div><label className="mb-2 block text-sm font-semibold text-primary">Nouveau code</label>{codeInput(accessCode, setAccessCode)}</div>
                    <div><label className="mb-2 block text-sm font-semibold text-primary">Confirmer le code</label>{codeInput(confirmCode, setConfirmCode)}</div>
                    <Button onClick={() => void handleSetup()} disabled={loading} className="h-14 w-full rounded-lg bg-primary text-primary-foreground hover:bg-muted">
                      {loading ? "Création…" : <>Créer mon accès <CheckCircle2 className="ml-2 h-5 w-5" /></>}
                    </Button>
                  </div>
                )}

                {step === "login" && (
                  <div className="space-y-5">
                    <div className="rounded-lg bg-muted p-4 text-center text-sm text-muted-foreground">
                      <Lock className="mx-auto mb-2 h-5 w-5 text-primary" />
                      Saisissez votre code d'accès à 4 chiffres.
                    </div>
                    {codeInput(accessCode, setAccessCode)}
                    <Button onClick={() => void handleLogin()} disabled={loading} className="h-14 w-full rounded-lg bg-primary text-primary-foreground hover:bg-muted">
                      {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Connexion…</> : <>Accéder à mon espace <ArrowRight className="ml-2 h-5 w-5" /></>}
                    </Button>
                  </div>
                )}

                <div className="mt-3 sm:mt-4 border-t border-border pt-2.5 sm:pt-3 text-center">
                  <p className="mb-2 text-xs sm:text-sm text-muted-foreground">Besoin d'aide pour accéder à votre espace ?</p>
                  <Button variant="outline" onClick={() => setSupportOpen(true)} className="h-9 rounded-lg border-border text-primary">
                    <MessageCircle className="mr-2 h-4 w-4" /> Contacter AgriCapital
                  </Button>
                </div>
              </section>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-xs sm:text-sm text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" /> Accès sécurisé à votre espace personnel
              </p>
            </div>
          </section>
        </div>
      </main>

      <PortalAccessSupportDialog open={supportOpen} onOpenChange={setSupportOpen} initialPhone={cleanPhone()} />
    </>
  );
};

export default ClientHome;
