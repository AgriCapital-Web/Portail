import { useEffect, useState } from "react";

export default function PwaUpdatePrompt() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let disposed = false;
    let registration: ServiceWorkerRegistration | null = null;
    let intervalId: number | undefined;

    const checkForUpdate = () => {
      void registration?.update().catch((error) => {
        console.warn("[AgriCapital] Vérification de mise à jour impossible :", error);
      });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") checkForUpdate();
    };

    const register = async () => {
      try {
        registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        if (disposed) return;

        if (registration.waiting && navigator.serviceWorker.controller) {
          setWaitingWorker(registration.waiting);
        }

        registration.addEventListener("updatefound", () => {
          const installing = registration?.installing;
          installing?.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller && !disposed) {
              setWaitingWorker(registration?.waiting || installing);
            }
          });
        });

        checkForUpdate();
        intervalId = window.setInterval(checkForUpdate, 60 * 60 * 1000);
        document.addEventListener("visibilitychange", onVisibilityChange);
      } catch (error) {
        console.error("[AgriCapital] Enregistrement du Service Worker impossible :", error);
      }
    };

    void register();

    return () => {
      disposed = true;
      if (intervalId) window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const applyUpdate = () => {
    if (!waitingWorker || updating) return;
    setUpdating(true);
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      () => window.location.reload(),
      { once: true },
    );
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  };

  if (!waitingWorker) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/65 p-5 backdrop-blur-sm"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="pwa-update-title"
      aria-describedby="pwa-update-description"
    >
      <div className="w-full max-w-sm rounded-3xl border border-primary/15 bg-white p-6 text-center shadow-2xl">
        <img
          src="/logo-agricapital.png?v=20261124-1"
          alt="Logo officiel AgriCapital"
          className="mx-auto mb-4 h-16 w-40 object-contain"
        />
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-primary">Mise à jour obligatoire</p>
        <h2 id="pwa-update-title" className="text-xl font-extrabold text-slate-900">
          Une nouvelle version est disponible
        </h2>
        <p id="pwa-update-description" className="mt-2 text-sm leading-relaxed text-slate-600">
          Cette mise à jour actualise l’application, son logo et ses icônes. Appuyez pour l’installer et redémarrer votre espace client.
        </p>
        <button
          type="button"
          onClick={applyUpdate}
          disabled={updating}
          className="mt-5 min-h-12 w-full rounded-full bg-primary px-5 py-3 text-sm font-extrabold text-white shadow-lg transition hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
        >
          {updating ? "Installation de la mise à jour…" : "Mettre à jour maintenant"}
        </button>
      </div>
    </div>
  );
}
