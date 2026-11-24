import { Component, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";

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
// Recover once from stale/missing Vite chunks (often caused by an older PWA cache).
// Prevent loops: a second failure is handled by the visible React error boundary.
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  console.error("[AC_Clients] Échec du chargement d’un module.", event);
  const retryKey = "ac_portal_chunk_retry";
  if (!sessionStorage.getItem(retryKey)) {
    sessionStorage.setItem(retryKey, "1");
    window.location.reload();
  }
});
window.addEventListener("pageshow", () => {
  sessionStorage.removeItem("ac_portal_chunk_retry");
});

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <PortalErrorBoundary>
      <App />
    </PortalErrorBoundary>
  </HelmetProvider>
);
