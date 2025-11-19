import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface GigWorker {
  id: string;
  user_id: string;
  profile_id: string;
  vendor_id?: string;
  vendor_name?: string;
  alternate_phone?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  coverage_pincodes: string[];
  max_daily_capacity: number;
  capacity_available: number;
  completion_rate: number;
  ontime_completion_rate: number;
  acceptance_rate: number;
  quality_score: number;
  qc_pass_count: number;
  total_cases_completed: number;
  active_cases_count: number;
  last_assignment_at?: string;
  is_direct_gig: boolean;
  is_active: boolean;
  is_available: boolean;
  last_seen_at?: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  };
  vendors?: {
    name: string;
  };
}

interface Vendor {
  id: string;
  name: string;
  email: string;
}

export function useGigWorkers() {
  return useQuery({
    queryKey: ['gigWorkers'],
    queryFn: async (): Promise<GigWorker[]> => {
      const { data: gigPartnersData, error: gigPartnersError } = await supabase
        .from('gig_partners')
        .select(`
          *,
          profiles!inner (
            first_name,
            last_name,
            email,
            phone
          ),
          vendors (
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (gigPartnersError) throw gigPartnersError;
      return (gigPartnersData || []) as GigWorker[];
    },
    staleTime: 30000, // Consider data fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });
}

export function useVendors() {
  return useQuery({
    queryKey: ['vendors'],
    queryFn: async (): Promise<Vendor[]> => {
      const { data, error } = await supabase
        .from('vendors')
        .select('id, name, email')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return (data || []) as Vendor[];
    },
    staleTime: 60000, // Consider data fresh for 1 minute
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  });
}

export function useGigWorkersInvalidation() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['gigWorkers'] });
  };
}

export function useVendorsInvalidation() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ['vendors'] });
  };
}

