import { Component, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { initCacheBuster } from "./utils/cacheBuster";

type BoundaryState = { hasError: boolean };

class PortalErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { hasError: false };

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[AC_Clients] Erreur d'affichage récupérée :", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background px-6 text-center">
          <h1 className="text-xl font-semibold text-primary">Votre espace rencontre un problème temporaire.</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            Vos données ne sont pas supprimées. Réessayez d’ouvrir cet écran sans recharger toute la plateforme.
          </p>
          <button
            type="button"
            className="rounded-md bg-primary px-5 py-3 font-medium text-primary-foreground"
            onClick={() => this.setState({ hasError: false })}
          >
            Réessayer
          </button>
        </main>
      );
    }
    return this.props.children;
  }
}

// Une erreur de chargement de module ne doit jamais provoquer de rechargement forcé.
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  console.error("[AC_Clients] Un module n’a pas pu être chargé. La navigation reste active.", event);
});

// Enregistre le Service Worker unique de la PWA : cache, Push et clics notification.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
      console.error("AgriCapital Service Worker registration failed:", error);
    });
  });
}

void initCacheBuster();

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <PortalErrorBoundary>
      <App />
    </PortalErrorBoundary>
  </HelmetProvider>
);
