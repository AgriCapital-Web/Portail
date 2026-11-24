import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Share, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-install-last-dismissed-ac-clients";
const DAY = 24 * 60 * 60 * 1000;
const standalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  window.matchMedia("(display-mode: fullscreen)").matches ||
  window.matchMedia("(display-mode: minimal-ui)").matches ||
  (window.navigator as any).standalone === true;

async function installed() {
  if (standalone()) return true;
  try {
    const getInstalledRelatedApps = (navigator as any).getInstalledRelatedApps;
    if (typeof getInstalledRelatedApps === "function") {
      const apps = await getInstalledRelatedApps.call(navigator);
      return Array.isArray(apps) && apps.length > 0;
    }
  } catch {
    // Some browsers do not expose installed related apps.
  }
  return false;
}

const allowed = () => {
  const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
  return !dismissedAt || Date.now() - dismissedAt >= DAY;
};

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [ios, setIos] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);
  const [isInstalled, setInstalled] = useState(false);

  useEffect(() => {
    let disposed = false;
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIos(isIOS);

    const before = async (event: Event) => {
      event.preventDefault();
      if (await installed() || !allowed() || disposed) return;
      setDeferred(event as BeforeInstallPromptEvent);
      window.setTimeout(() => {
        if (!disposed && !standalone() && allowed()) setShow(true);
      }, 1800);
    };

    const appInstalled = () => {
      localStorage.removeItem(DISMISS_KEY);
      setInstalled(true);
      setDeferred(null);
      setShow(false);
    };

    void installed().then((value) => {
      if (!disposed && value) setInstalled(true);
    });

    window.addEventListener("beforeinstallprompt", before);
    window.addEventListener("appinstalled", appInstalled);

    if (isIOS && !standalone() && allowed()) {
      window.setTimeout(() => {
        if (!disposed && !standalone()) setShow(true);
      }, 2200);
    }

    return () => {
      disposed = true;
      window.removeEventListener("beforeinstallprompt", before);
      window.removeEventListener("appinstalled", appInstalled);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
  };

  const install = async () => {
    if (ios) {
      setIosHelp(true);
      return;
    }
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDeferred(null);
    setShow(false);
  };

  if (!show || isInstalled) return null;

  return (
    <Dialog open={show} onOpenChange={(open) => !open && dismiss()}>
      <DialogContent className="flex h-[min(318px,calc(100vw-2rem))] w-[min(318px,calc(100vw-2rem))] max-w-none flex-col items-center justify-center overflow-hidden rounded-full border border-primary/15 bg-white p-6 text-center shadow-2xl">
        <div className="mb-2 flex h-20 w-32 items-center justify-center">
          <img
            src="/logo-agricapital.png?v=20261124-1"
            alt="Logo officiel AgriCapital"
            className="max-h-full max-w-full object-contain"
          />
        </div>
        <DialogHeader className="items-center space-y-1">
          <div className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-primary">
            <Smartphone className="h-3 w-3" /> Application officielle
          </div>
          <DialogTitle className="text-lg font-extrabold text-slate-900">
            Installer AgriCapital
          </DialogTitle>
          <DialogDescription className="max-w-[220px] text-xs leading-relaxed text-slate-600">
            Retrouvez votre espace client directement sur votre écran d’accueil.
          </DialogDescription>
        </DialogHeader>

        {iosHelp ? (
          <div className="mt-2 max-w-[220px] text-[11px] leading-relaxed text-slate-700">
            <p><strong>1.</strong> Appuyez sur <Share className="inline h-3 w-3" /> Partager.</p>
            <p><strong>2.</strong> Choisissez « Sur l’écran d’accueil ».</p>
            <p><strong>3.</strong> Appuyez sur « Ajouter ».</p>
          </div>
        ) : (
          <Button
            onClick={() => void install()}
            disabled={!ios && !deferred}
            size="lg"
            className="pwa-install-pulse mt-4 min-h-11 w-full max-w-[220px] gap-2 rounded-full bg-red-600 px-5 text-sm font-extrabold text-white hover:bg-red-700"
          >
            <Download className="h-4 w-4" />
            {ios ? "Comment installer" : "Installer"}
          </Button>
        )}

        <button
          type="button"
          onClick={dismiss}
          className="mt-2 min-h-8 text-[11px] font-medium text-slate-500 underline-offset-2 hover:underline"
        >
          Plus tard
        </button>
      </DialogContent>
    </Dialog>
  );
}
