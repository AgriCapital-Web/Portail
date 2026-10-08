import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import ClientHome from "./client/ClientHome";
import { createDemoAccount } from "@/data/demoAccount";
import { canShowPayments, isLocalDemo } from "@/utils/portalRoles";
const ClientDashboard = lazy(() => import("./client/ClientDashboard"));
const ClientPayment = lazy(() => import("./client/ClientPayment"));
const PaymentReturn = lazy(() => import("./client/PaymentReturn"));
const ClientPlantationHub = lazy(() => import("./client/ClientPlantationHub"));
const StakeholderDashboard = lazy(() => import("./client/StakeholderDashboard"));
import InstallPrompt from "@/components/pwa/InstallPrompt";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";
import { supabase } from "@/integrations/supabase/client";

type PrivateView = "dashboard" | "payment" | "plantation-hub";
const SESSION_KEYS = [
  "agri_client","agri_plantations","agri_paiements",
  "agri_portal_access_token","agri_demo","agri_demo_token","agri_demo_code",
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

      const isDemoSession = isLocalDemo(storedClient);

      if (!token && !storedClient) {
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
        const fresh = createDemoAccount(storedClient.telephone);
        const nextClient = { ...storedClient, ...fresh.client };
        setClient(nextClient);
        setPlantations(fresh.plantations);
        sessionStorage.setItem("agri_client", JSON.stringify(nextClient));
        sessionStorage.setItem("agri_plantations", JSON.stringify(fresh.plantations));
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
        } else if (!cancelled && error) {
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

  const goPayment = () => {
    if (!canShowPayments(client)) return;
    navigate("/paiements");
  };

  const renderView = () => {
    if (isHome) return <ClientHome onLogin={handleLogin} />;
    if (isPaymentReturn) return <PaymentReturn onBack={() => navigate(client ? "/dashboard" : "/", { replace: true })} />;
    if (!client) return null;

    if (privateView === "plantation-hub" && plantations.length === 0) {
      navigate("/dashboard", { replace: true });
      return null;
    }

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

    if (client.portal_primary_role !== "client") {
      return (
        <StakeholderDashboard
          client={client}
          plantations={plantations}
          onPlantationHub={(id?: string) => navigate(id ? "/plantations/" + encodeURIComponent(id) : "/plantations")}
          onLogout={handleLogout}
        />
      );
    }

    if (privateView === "payment") {
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
        onPayment={() => goPayment()}
        onPlantationHub={(id?: string) => navigate(id ? "/plantations/" + encodeURIComponent(id) : "/plantations")}
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
