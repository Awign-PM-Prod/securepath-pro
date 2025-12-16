import { supabase } from '@/integrations/supabase/client';

export interface PincodeTier {
  id: string;
  pincode: string;
  tier: 'tier1' | 'tier2' | 'tier3';
  city: string | null;
  state: string | null;
  region: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreatePincodeTierData {
  pincode: string;
  tier: 'tier1' | 'tier2' | 'tier3';
  city?: string;
  state?: string;
  region?: string;
}

export interface BulkPincodeTierData {
  pincode: string;
  tier: 'tier1' | 'tier2' | 'tier3';
  city?: string;
  state?: string;
  region?: string;
}

export class PincodeTierService {
  async getPincodeTiers(): Promise<PincodeTier[]> {
    try {
      const allData: PincodeTier[] = [];
      const pageSize = 1000; // Supabase default limit
      let from = 0;
      let hasMore = true;

      // Fetch all records in batches to overcome Supabase's 1000 row limit
      while (hasMore) {
        const { data, error } = await supabase
          .from('pincode_tiers')
          .select('*')
          .order('pincode')
          .range(from, from + pageSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allData.push(...data);
          from += pageSize;
          // If we got less than pageSize, we've reached the end
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      return allData;
    } catch (error) {
      console.error('Failed to fetch pincode tiers:', error);
      return [];
    }
  }

  async getPincodeTier(pincode: string): Promise<PincodeTier | null> {
    try {
      const { data, error } = await supabase
        .from('pincode_tiers')
        .select('*')
        .eq('pincode', pincode)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to fetch pincode tier:', error);
      return null;
    }
  }

  async createPincodeTier(tierData: CreatePincodeTierData): Promise<PincodeTier | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('pincode_tiers')
        .insert({
          ...tierData,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to create pincode tier:', error);
      throw error;
    }
  }

  async updatePincodeTier(id: string, tierData: Partial<CreatePincodeTierData>): Promise<PincodeTier | null> {
    try {
      const { data, error } = await supabase
        .from('pincode_tiers')
        .update({
          ...tierData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Failed to update pincode tier:', error);
      throw error;
    }
  }

  async deletePincodeTier(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('pincode_tiers')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to delete pincode tier:', error);
      throw error;
    }
  }

  async bulkCreatePincodeTiers(tiersData: BulkPincodeTierData[]): Promise<{ success: number; errors: any[] }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const dataWithUser = tiersData.map(tier => ({
        ...tier,
        created_by: user.id,
      }));

      // Process in batches to avoid exceeding database limits
      // Supabase/PostgreSQL typically has limits around 1000-2000 rows per insert
      const BATCH_SIZE = 500;
      const batches: BulkPincodeTierData[][] = [];
      
      for (let i = 0; i < dataWithUser.length; i += BATCH_SIZE) {
        batches.push(dataWithUser.slice(i, i + BATCH_SIZE));
      }

      let totalSuccess = 0;
      const allErrors: any[] = [];

      // Process each batch sequentially
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} records)`);

        try {
          const { data, error } = await supabase
            .from('pincode_tiers')
            .insert(batch)
            .select();

          if (error) {
            console.error(`Error in batch ${batchIndex + 1}:`, error);
            allErrors.push({
              batch: batchIndex + 1,
              error: error.message || error,
              recordsInBatch: batch.length
            });
          } else {
            totalSuccess += data?.length || 0;
          }
        } catch (batchError: any) {
          console.error(`Failed to process batch ${batchIndex + 1}:`, batchError);
          allErrors.push({
            batch: batchIndex + 1,
            error: batchError.message || batchError,
            recordsInBatch: batch.length
          });
        }
      }
      
      return {
        success: totalSuccess,
        errors: allErrors
      };
    } catch (error) {
      console.error('Failed to bulk create pincode tiers:', error);
      return {
        success: 0,
        errors: [error]
      };
    }
  }

  async searchPincodeTiers(query: string): Promise<PincodeTier[]> {
    try {
      const allData: PincodeTier[] = [];
      const pageSize = 1000;
      let from = 0;
      let hasMore = true;

      // Fetch all matching records in batches
      while (hasMore) {
        const { data, error } = await supabase
          .from('pincode_tiers')
          .select('*')
          .or(`pincode.ilike.%${query}%,city.ilike.%${query}%,state.ilike.%${query}%`)
          .order('pincode')
          .range(from, from + pageSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allData.push(...data);
          from += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      return allData;
    } catch (error) {
      console.error('Failed to search pincode tiers:', error);
      return [];
    }
  }

  async getPincodeTiersByTier(tier: 'tier1' | 'tier2' | 'tier3'): Promise<PincodeTier[]> {
    try {
      const allData: PincodeTier[] = [];
      const pageSize = 1000;
      let from = 0;
      let hasMore = true;

      // Fetch all matching records in batches
      while (hasMore) {
        const { data, error } = await supabase
          .from('pincode_tiers')
          .select('*')
          .eq('tier', tier)
          .eq('is_active', true)
          .order('pincode')
          .range(from, from + pageSize - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allData.push(...data);
          from += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      return allData;
    } catch (error) {
      console.error('Failed to fetch pincode tiers by tier:', error);
      return [];
    }
  }
}

export const pincodeTierService = new PincodeTierService();