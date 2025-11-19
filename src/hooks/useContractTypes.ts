import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ContractType {
  id: string;
  type_key: string;
  display_name: string;
  description: string;
  is_active: boolean;
  sort_order: number;
}

export function useContractTypes() {
  return useQuery({
    queryKey: ['contractTypes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contract_type_config')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return (data || []) as ContractType[];
    },
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes (contract types rarely change)
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
  });
}

export function useContractTypesInvalidation() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['contractTypes'] });
  };
}

