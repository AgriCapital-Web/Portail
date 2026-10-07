import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import ClientHome from "./client/ClientHome";
const ClientDashboard = lazy(() => import("./client/ClientDashboard"));
const ClientPayment = lazy(() => import("./client/ClientPayment"));
const PaymentReturn = lazy(() => import("./client/PaymentReturn"));
const ClientPlantationHub = lazy(() => import("./client/ClientPlantationHub"));
import { canShowPayments } from "@/utils/portalRoles";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { supabase } from "@/integrations/supabase/client";

type PrivateView = "dashboard" | "payment" | "plantation-hub";
const SESSION_KEYS = [
  "agri_client","agri_plantations","agri_paiements",
  "agri_portal_access_token","agri_demo","agri_demo_token","agri_demo_code",
  "agri_demo_messages","agri_demo_notifications","agri_notified_ids","agri_access_code_saved",
] as const;

const readJson = <T,>(key: string): T | null => {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const clearPortalSession = () => SESSION_KEYS.forEach((key) => sessionStorage.removeItem(key));

const ClientPortal = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { id: plantationId } = useParams();
  const [searchParams] = useSearchParams();
  const [client, setClient] = useState<any>(null);
  const [plantations, setPlantations] = useState<any[]>([]);
  const [paiements, setPaiements] = useState<any[]>([]);
  const [restoring, setRestoring] = useState(true);

  const pathname = location.pathname;
  const isPaymentReturn = pathname === "/paiement/retour";
  const isHome = pathname === "/";
  const isPrivate = pathname !== "/";

  const privateView: PrivateView = useMemo(() => {
    if (pathname === "/paiements") return "payment";
    if (pathname === "/plantations" || pathname.startsWith("/plantations/")) return "plantation-hub";
    return "dashboard";
  }, [pathname]);

  useEffect(() => {
    if (pathname !== "/") return;
    const hasPaymentReturn =
      Boolean(searchParams.get("status")) ||
      Boolean(searchParams.get("reference") || searchParams.get("ref")) ||
      Boolean(searchParams.get("id") || searchParams.get("transaction_id"));
    if (hasPaymentReturn) {
      navigate({ pathname: "/paiement/retour", search: location.search }, { replace: true });
    }
  }, [pathname, searchParams, navigate, location.search]);

  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      setRestoring(true);
      const storedClient = readJson<any>("agri_client");
      const storedPlantations = readJson<any[]>("agri_plantations") || [];
      const storedPaiements = readJson<any[]>("agri_paiements") || [];
      const token = sessionStorage.getItem("agri_portal_access_token");

      if (storedClient) {
        setClient(storedClient);
        setPlantations(storedPlantations);
        setPaiements(storedPaiements);
      }

      if (isPaymentReturn) {
        if (!cancelled) setRestoring(false);
        return;
      }

      const isDemoSession = sessionStorage.getItem("agri_demo") === "1" || storedClient?.demo === true;

      if (!token && !isDemoSession) {
        if (!cancelled) {
          setClient(null);
          setPlantations([]);
          setPaiements([]);
          setRestoring(false);
          if (isPrivate) navigate("/", { replace: true });
        }
        return;
      }

      if (isHome && storedClient) navigate("/dashboard", { replace: true });

      if (isDemoSession) {
        if (!cancelled) setRestoring(false);
        return;
      }

      if (!navigator.onLine) {
        if (!cancelled) setRestoring(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("client-portal-data", {
          body: { access_token: token },
        });

        if (!cancelled && !error && data?.success) {
          const nextClient = data.client;
          const nextPlantations = data.plantations || [];
          const nextPaiements = data.paiements || [];
          setClient(nextClient);
          setPlantations(nextPlantations);
          setPaiements(nextPaiements);
          sessionStorage.setItem("agri_client", JSON.stringify(nextClient));
          sessionStorage.setItem("agri_plantations", JSON.stringify(nextPlantations));
          sessionStorage.setItem("agri_paiements", JSON.stringify(nextPaiements));
        } else if (!cancelled) {
          const httpStatus = error?.context?.status;
          if (httpStatus === 401 || httpStatus === 403 || !storedClient) {
            clearPortalSession();
            setClient(null);
            setPlantations([]);
            setPaiements([]);
            if (pathname !== "/") navigate("/", { replace: true });
          }
        }
      } catch (error: any) {
        if (!cancelled && !navigator.onLine) {
          console.warn("[AC_Clients] session conservée hors ligne", error?.message || error);
        }
      } finally {
        if (!cancelled) setRestoring(false);
      }
    };

    void restore();
    return () => { cancelled = true; };
  }, [isPaymentReturn, isHome, pathname, navigate]);

  useEffect(() => {
    if (!client || isPaymentReturn || privateView === "dashboard" || privateView === "plantation-hub") return;
    if (!canShowPayments(client)) navigate("/dashboard", { replace: true });
  }, [client, isPaymentReturn, privateView, navigate]);

  useEffect(() => {
    if (!restoring && client && privateView === "plantation-hub" && !plantations.length) navigate("/dashboard", { replace: true });
  }, [restoring, client, privateView, plantations.length, navigate]);

  useEffect(() => {
    if (privateView !== "plantation-hub" || !plantationId || !plantations.length) return;
    if (!plantations.some((plantation) => plantation.id === plantationId)) {
      navigate("/plantations", { replace: true });
    }
  }, [privateView, plantationId, plantations, navigate]);

  useEffect(() => {
    document.title = "AC_Clients | AgriCapital";
    document.querySelector('link[rel="manifest"]')?.setAttribute("href", "/manifest-client.json");
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#00643C");
  }, []);

  useEffect(() => {
    const ensure = (name: string) => {
      let el = document.querySelector('meta[name="' + name + '"]') as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute("name", name);
        document.head.appendChild(el);
      }
      return el;
    };
    const privatePage = isPrivate && !isHome;
    ensure("robots").setAttribute(
      "content",
      privatePage ? "noindex, nofollow, noarchive, nosnippet, noimageindex" : "index, follow",
    );
    ensure("googlebot").setAttribute(
      "content",
      privatePage ? "noindex, nofollow, noarchive" : "index, follow",
    );
  }, [isHome, isPrivate]);

  const { status, lastSync } = useAutoRefresh(
    client?.telephone,
    (nextClient, nextPlantations, nextPaiements) => {
      setClient(nextClient);
      setPlantations(nextPlantations);
      setPaiements(nextPaiements);
      sessionStorage.setItem("agri_client", JSON.stringify(nextClient));
      sessionStorage.setItem("agri_plantations", JSON.stringify(nextPlantations));
      sessionStorage.setItem("agri_paiements", JSON.stringify(nextPaiements));
    },
  );

  const handleLogin = (clientData: any, plants: any[], paies: any[]) => {
    setClient(clientData);
    setPlantations(plants);
    setPaiements(paies);
    sessionStorage.setItem("agri_client", JSON.stringify(clientData));
    sessionStorage.setItem("agri_plantations", JSON.stringify(plants));
    sessionStorage.setItem("agri_paiements", JSON.stringify(paies));
    navigate("/dashboard", { replace: true });
  };

  const handleLogout = () => {
    clearPortalSession();
    setClient(null);
    setPlantations([]);
    setPaiements([]);
    navigate("/", { replace: true });
  };

  const goPayment = (options?: { prefillAmount?: number; prefillType?: "arriere" | "solde_paiement_initial" }) => {
    if (!canShowPayments(client)) return;
    navigate("/paiements", { state: options });
  };

  const renderView = () => {
    if (isHome) return <ClientHome onLogin={handleLogin} />;
    if (isPaymentReturn) return <PaymentReturn onBack={() => navigate(client ? "/dashboard" : "/", { replace: true })} />;
    if (!client) return null;

    if (privateView === "plantation-hub" && plantations.length === 0) return null;

    if (privateView === "plantation-hub") {
      return (
        <ClientPlantationHub
          client={client}
          plantations={plantations}
          initialPlantationId={plantationId}
          onPlantationChange={(id) => navigate("/plantations/" + encodeURIComponent(id))}
          onBack={() => navigate("/dashboard")}
        />
      );
    }

    if (privateView === "payment" && canShowPayments(client)) {
      return (
        <ClientPayment
          client={client}
          plantations={plantations}
          paiements={paiements}
          onBack={() => navigate("/dashboard")}
        />
      );
    }

    return (
      <ClientDashboard
        client={client}
        plantations={plantations}
        paiements={paiements}
        syncStatus={status}
        lastSync={lastSync}
        onPayment={goPayment}
        onPlantationHub={(id) => navigate(id ? "/plantations/" + encodeURIComponent(id) : "/plantations")}
        onLogout={handleLogout}
      />
    );
  };

  if (restoring && !isPaymentReturn && !client && !isHome) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-primary">Chargement de votre espace…</div>;
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center text-primary">Chargement de votre espace…</div>}>
      <>
        <InstallPrompt />
        {renderView()}
      </>
    </Suspense>
  );
};

export default ClientPortal;
