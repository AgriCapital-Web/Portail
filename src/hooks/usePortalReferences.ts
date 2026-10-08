import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function usePortalReferences(category: string, enabled = true) {
  return useQuery({
    queryKey: ['portal-references', category],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('portal_public_references');
      if (error) throw error;
      return (data || []).filter(row => row.categorie === category);
    },
    staleTime: 5 * 60_000,
  });
}