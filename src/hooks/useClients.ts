import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Client {
  id: string;
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useClients() {
  return useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as Client[];
    },
    staleTime: 60000, // Consider data fresh for 1 minute (clients don't change often)
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
}

export function useClientsInvalidation() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['clients'] });
  };
}

