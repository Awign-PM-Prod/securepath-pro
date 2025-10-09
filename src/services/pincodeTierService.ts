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
      const { data, error } = await supabase
        .from('pincode_tiers')
        .select('*')
        .order('pincode');

      if (error) throw error;
      return data || [];
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
        .single();

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

      const { data, error } = await supabase
        .from('pincode_tiers')
        .insert(dataWithUser)
        .select();

      if (error) throw error;
      
      return {
        success: data?.length || 0,
        errors: []
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
      const { data, error } = await supabase
        .from('pincode_tiers')
        .select('*')
        .or(`pincode.ilike.%${query}%,city.ilike.%${query}%,state.ilike.%${query}%`)
        .order('pincode');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to search pincode tiers:', error);
      return [];
    }
  }

  async getPincodeTiersByTier(tier: 'tier1' | 'tier2' | 'tier3'): Promise<PincodeTier[]> {
    try {
      const { data, error } = await supabase
        .from('pincode_tiers')
        .select('*')
        .eq('tier', tier)
        .eq('is_active', true)
        .order('pincode');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to fetch pincode tiers by tier:', error);
      return [];
    }
  }
}

export const pincodeTierService = new PincodeTierService();