import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PortalReference {
  categorie: string;
  code: string;
  libelle: string;
  ordre: number;
  metadata: { callingCode?: string; flag?: string; minLocalDigits?: number; maxLocalDigits?: number; optional?: boolean };
}

export function usePortalReferences(category: string, enabled = true) {
  const [references, setReferences] = useState<PortalReference[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    if (!enabled) { setLoading(false); return; }
    setLoading(true);
    void supabase.rpc("portal_public_references").then(({ data, error: queryError }) => {
      if (!active) return;
      setReferences(queryError ? [] : (data || []).filter((row) => row.categorie === category) as PortalReference[]);
      setError(Boolean(queryError));
      setLoading(false);
    });
    return () => { active = false; };
  }, [category, enabled]);
  return { references, loading, error };
}