/**
 * Mise à jour silencieuse de la PWA.
 * Aucune détection de version ne provoque de rechargement de page.
 */
declare const __APP_BUILD_ID__: string;
const currentBuildId = typeof __APP_BUILD_ID__ !== "undefined" ? __APP_BUILD_ID__ : "dev";
export async function initCacheBuster() {
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;
  try {
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
    if (registration.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) worker.postMessage({ type: "SKIP_WAITING" });
      });
    });
    const check = () => registration.update().catch(() => {});
    void check();
    window.setInterval(check, 15 * 60 * 1000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void check();
    });
  } catch {}
}
export const APP_BUILD_ID = currentBuildId;
