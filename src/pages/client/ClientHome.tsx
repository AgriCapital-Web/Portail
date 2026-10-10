import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import logoWhiteBg from "@/assets/logo-white-bg.png";
import { Loader2, ArrowRight, MessageCircle, ShieldCheck, KeyRound, ArrowLeft, Lock, Sparkles, CheckCircle2 } from "lucide-react";
import { Helmet } from "react-helmet-async";
import PortalAccessSupportDialog from "@/components/client/PortalAccessSupportDialog";
import { createDemoAccount } from "@/data/demoAccount";
import PhoneInput, { isValidPhoneNumber, type Country } from "react-phone-number-input";
import "react-phone-number-input/style.css";
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

      <main className="min-h-[100svh] bg-muted px-3 py-4 sm:px-6 sm:py-8 flex items-start sm:items-center">
        <div className="mx-auto grid w-full max-w-3xl gap-4 sm:gap-6 lg:gap-10 items-stretch">
          <div className="flex items-center justify-center">
            <div className="w-full max-w-2xl min-w-0">
              <div className="mb-4 sm:mb-6 flex justify-center">
                <img src={logoWhiteBg} alt="AgriCapital" className="h-auto w-[clamp(190px,48vw,360px)] max-w-full object-contain mix-blend-multiply" />
              </div>

              <section className="flex flex-col justify-center rounded-2xl border border-border bg-card p-4 min-[420px]:p-5 sm:p-7 lg:p-9 shadow-xl min-w-0">
                <div className="mb-5 sm:mb-7 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-primary">
                    {step === "phone" ? <ShieldCheck className="h-6 w-6" /> : <KeyRound className="h-6 w-6" />}
                  </div>
                  <h1 className="text-[clamp(1.35rem,4vw,1.75rem)] leading-tight font-bold text-primary">Votre espace client</h1>
                  <p className="mt-2 text-[clamp(0.9rem,2.5vw,1rem)] leading-relaxed text-muted-foreground">
                    {step === "phone"
                      ? "Connectez-vous avec le numéro utilisé lors de votre contractualisation."
                      : step === "setup"
                        ? "Créez votre code d'accès personnel."
                          : welcomeText}
                  </p>
                </div>

                {step !== "phone" && (
                  <Button variant="ghost" type="button" onClick={reset} className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">
                    <ArrowLeft className="h-4 w-4" /> Modifier le numéro
                  </Button>
                )}

                {step === "phone" && (
                  <div className="space-y-4 sm:space-y-5">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-primary">Numéro de téléphone</label>
                      <PhoneInput
                        countries={countries.map(row => row.code as Country)}
                        disabled={countriesLoading || countriesError}
                        international
                        defaultCountry="CI"
                        countryCallingCodeEditable={false}
                        value={telephone}
                        onChange={setTelephone}
                        onKeyDown={(e) => { if (e.key === "Enter") void handlePhoneContinue(); }}
                        aria-label="Numéro de téléphone international"
                        className="phone-input"
                      />
                      {countriesError && <p role="alert" className="mt-2 text-sm text-destructive">La liste des pays est indisponible. Réessayez dans quelques instants.</p>}
                    </div>
                    <Button onClick={() => void handlePhoneContinue()} disabled={loading || countriesLoading || countriesError} className="min-h-12 h-auto py-3 w-full rounded-lg whitespace-normal text-base leading-snug bg-primary text-primary-foreground hover:bg-muted">
                      {loading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Chargement…</> : <>Vérifier le numéro <ArrowRight className="ml-2 h-5 w-5" /></>}
                    </Button>
                    <Button type="button" variant="outline" onClick={handleDemoEnter} className="min-h-12 h-auto py-3 w-full whitespace-normal text-base leading-snug">
                      <Sparkles className="mr-2 h-5 w-5" /> Accéder à la démonstration
                    </Button>
                  </div>
                )}

                {step === "setup" && (
                  <div className="space-y-5">
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

                <div className="mt-6 sm:mt-7 border-t border-border pt-4 sm:pt-5 text-center">
                  <p className="mb-3 text-sm text-muted-foreground">Besoin d'aide pour accéder à votre espace ?</p>
                  <Button variant="outline" onClick={() => setSupportOpen(true)} className="h-11 rounded-lg border-border text-primary">
                    <MessageCircle className="mr-2 h-4 w-4" /> Contacter AgriCapital
                  </Button>
                </div>
              </section>

              <p className="mt-4 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
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
