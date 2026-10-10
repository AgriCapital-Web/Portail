import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { appendJournal, buildCrmSnapshot, diffAndLog, type CrmSnapshot } from "@/utils/syncJournal";
import { trackEvent } from "@/utils/errorTracker";


export type RealtimeStatus = "loading" | "connecting" | "live" | "offline" | "error" | "reconnecting";

/**
 * Rafraîchissement automatique + statut de connexion Realtime.
 * - Polling silencieux vers `client-portal-data` toutes les `intervalMs` ms.
 * - Abonnement Realtime sur toutes les tables CRM concernées.
 * - Expose un `status` (connecting / live / offline / error / reconnecting) que l'UI peut afficher.
 * - Gère la reconnexion automatique quand le navigateur repasse online / la page redevient visible.
 */
export function useAutoRefresh(
  telephone: string | null | undefined,
  onData: (client: any, plantations: any[], paiements: any[]) => void,
  intervalMs: number = 30000,
) {
  const [status, setStatus] = useState<RealtimeStatus>("loading");
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const busy = useRef(false);
  const cbRef = useRef(onData);
  cbRef.current = onData;
  const snapRef = useRef<CrmSnapshot | null>(null);
  const lastPayloadRef = useRef("");
  const errLoggedRef = useRef(false);

  useEffect(() => {
    const isDemoSession = sessionStorage.getItem("agri_demo") === "1";
    if (!telephone || isDemoSession) {
      if (isDemoSession) setStatus("live");
      return;
    }
    let cancelled = false;
    snapRef.current = null;
    lastPayloadRef.current = "";

    let refreshTimer: number | null = null;
    const refresh = async (silent = true, trigger = "polling") => {
      if (busy.current || document.hidden) return;
      busy.current = true;
      try {
        const accessToken = sessionStorage.getItem("agri_portal_access_token");
        const { data, error } = await supabase.functions.invoke("client-portal-data", {
          body: { access_token: accessToken },
        });
        if (!cancelled && !error && data?.success) {
          const plants = data.plantations || [];
          const pays = data.paiements || [];
          const payloadSignature = JSON.stringify({ client: data.client, plantations: plants, paiements: pays });
          if (payloadSignature !== lastPayloadRef.current) {
            lastPayloadRef.current = payloadSignature;
            cbRef.current(data.client, plants, pays);
          }
          setLastSync(new Date());
          setStatus("live");

          // === Journal de synchronisation par compte ===
          const account = data.client?.id_unique || telephone;
          const snapshot = buildCrmSnapshot(data.client, plants, pays);
          const changes = diffAndLog(account, snapRef.current, snapshot);
          snapRef.current = snapshot;
          if (!silent || changes > 0) {
            appendJournal(account, {
              kind: "sync",
              label: changes > 0 ? `Synchronisation — ${changes} changement(s) CRM` : "Synchronisation CRM",
              details: `Déclencheur : ${trigger} · source prix : ${snapshot.price_source}`,
            });
          }
          errLoggedRef.current = false;
        } else if (error) {
          setStatus("error");
          if (!errLoggedRef.current) {
            errLoggedRef.current = true;
            appendJournal(telephone, { kind: "sync_error", label: "Échec de synchronisation", details: error.message || "Erreur inconnue" });
            trackEvent({ level: "error", scope: "sync", message: "Échec de synchronisation CRM", account: telephone, context: { trigger, error: error.message } });
          }
        }
      } catch (e: any) {
        const offline = !navigator.onLine;
        setStatus(offline ? "offline" : "error");
        if (!errLoggedRef.current) {
          errLoggedRef.current = true;
          appendJournal(telephone, {
            kind: offline ? "connection" : "sync_error",
            label: offline ? "Connexion perdue" : "Erreur réseau pendant la synchronisation",
            details: e?.message,
          });
          trackEvent({
            level: offline ? "warning" : "error",
            scope: "realtime",
            message: offline ? "Connexion perdue (offline)" : "Erreur réseau pendant la synchronisation CRM",
            account: telephone,
            context: { trigger, error: e?.message },
          });
        }
      } finally { busy.current = false; }
    };


    refresh(false);
    const timer = setInterval(() => refresh(true), intervalMs);

    const scheduleRefresh = (trigger = "realtime") => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => { refreshTimer = null; void refresh(true, trigger); }, 800);
    };

    const channel = supabase
      .channel(`portal-sync-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "offres" }, () => scheduleRefresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "promotions" }, () => scheduleRefresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, () => scheduleRefresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "rapports_visites_techniques" }, () => scheduleRefresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "rapports_visites_medias" }, () => scheduleRefresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "plantations" }, () => scheduleRefresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "paiements" }, () => scheduleRefresh())
      .subscribe((s) => {
        if (s === "SUBSCRIBED") setStatus("live");
        else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") {
          setStatus("reconnecting");
          trackEvent({ level: "warning", scope: "realtime", message: `Canal temps réel ${s} — reconnexion`, account: telephone });
        } else if (s === "CLOSED") {
          setStatus(navigator.onLine ? "reconnecting" : "offline");
          trackEvent({ level: "warning", scope: "realtime", message: "Canal temps réel fermé", account: telephone, context: { online: navigator.onLine } });
        }
      });

    const onVis = () => { if (document.visibilityState === "visible") scheduleRefresh("visibility"); };
    const onOnline = () => { scheduleRefresh("online"); };
    const onOffline = () => { setStatus("offline"); trackEvent({ level: "warning", scope: "realtime", message: "Navigateur hors ligne", account: telephone }); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      cancelled = true;
      clearInterval(timer);
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [telephone, intervalMs]);

  return { status, lastSync };
}
