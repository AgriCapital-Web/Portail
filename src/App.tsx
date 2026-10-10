import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";
import ClientPortal from "./pages/ClientPortal";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 30 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
  },
});

const PortalNavigationGuard = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const onSubmit = (event: Event) => {
      const form = event.target;
      if (form instanceof HTMLFormElement && form.dataset.nativeSubmit !== "true") event.preventDefault();
    };

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.composedPath().find((node) => node instanceof HTMLAnchorElement) as HTMLAnchorElement | undefined;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download") || anchor.dataset.nativeNavigation === "true") return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (/\.(?:pdf|jpg|jpeg|png|gif|webp|mp4|webm|csv|xlsx?|docx?|pptx?)$/i.test(url.pathname)) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash === window.location.hash) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      navigate(url.pathname + url.search + url.hash);
    };

    document.addEventListener("submit", onSubmit, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("submit", onSubmit, true);
      document.removeEventListener("click", onClick, true);
    };
  }, [navigate]);

  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <PortalNavigationGuard />
        <Routes>
          <Route path="/" element={<ClientPortal />} />
          <Route path="/dashboard" element={<ClientPortal />} />
          <Route path="/demo" element={<ClientPortal />} />
          <Route path="/plantations" element={<ClientPortal />} />
          <Route path="/plantations/:id" element={<ClientPortal />} />
          <Route path="/paiements" element={<ClientPortal />} />
          <Route path="/paiement/retour" element={<ClientPortal />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
