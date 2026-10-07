CREATE OR REPLACE FUNCTION public.portal_public_references()
RETURNS TABLE(categorie text, code text, libelle text, ordre integer, metadata jsonb)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT r.categorie, r.code, r.libelle, r.ordre, r.metadata
  FROM public.referentiels_systeme r
  WHERE r.actif = true AND r.categorie IN ('pays_telephone', 'etape_plantation')
  ORDER BY r.categorie, r.ordre, r.libelle;
$$;
REVOKE ALL ON FUNCTION public.portal_public_references() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_public_references() TO anon, authenticated, service_role;