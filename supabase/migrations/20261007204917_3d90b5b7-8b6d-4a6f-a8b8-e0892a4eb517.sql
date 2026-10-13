ALTER FUNCTION public.portal_public_references() SECURITY INVOKER;
GRANT SELECT (categorie, code, libelle, ordre, metadata, actif) ON public.referentiels_systeme TO anon;
DROP POLICY IF EXISTS portal_public_reference_labels ON public.referentiels_systeme;
CREATE POLICY portal_public_reference_labels ON public.referentiels_systeme FOR SELECT TO anon USING (actif = true AND categorie IN ('pays_telephone','etape_plantation'));
