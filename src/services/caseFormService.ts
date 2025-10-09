import { supabase } from '@/integrations/supabase/client';

export interface CaseFormDefaults {
  city: string;
  state: string;
  tier: 'tier1' | 'tier2' | 'tier3';
  tat_hours: number;
  working_hours_start?: string;
  working_hours_end?: string;
  bonuses?: any[];
  penalties?: any[];
}

export class CaseFormService {
  /**
   * Get case defaults based on client, contract type, and pincode using the database function
   */
  async getCaseDefaults(clientId: string, contractType: string, pincode: string, tatHours?: number): Promise<CaseFormDefaults | null> {
    try {
      const { data, error } = await supabase
        .rpc('get_case_defaults', {
          p_client_id: clientId,
          p_contract_type: contractType,
          p_pincode: pincode,
          p_tat_hours: tatHours || null
        });

      if (error) {
        console.error('Database function error:', error);
        return this.getFallbackDefaults();
      }

      if (!data || data.length === 0) {
        return this.getFallbackDefaults();
      }

      const result = data[0];
      return {
        city: result.city || 'Unknown',
        state: result.state || 'Unknown',
        tier: result.tier || 'tier3',
        tat_hours: Number(result.tat_hours) || 24,
        working_hours_start: result.working_hours_start,
        working_hours_end: result.working_hours_end,
        bonuses: result.bonuses || [],
        penalties: result.penalties || []
      };
    } catch (error) {
      console.error('Failed to get case defaults:', error);
      return this.getFallbackDefaults();
    }
  }

  /**
   * Get location data from pincode using the database function
   */
  async getLocationFromPincode(pincode: string): Promise<{ city: string; state: string; tier: string } | null> {
    try {
      const { data, error } = await supabase
        .rpc('get_location_from_pincode', {
          p_pincode: pincode
        });

      if (error) {
        console.error('Database function error:', error);
        return { city: 'Unknown', state: 'Unknown', tier: 'tier3' };
      }

      if (!data || data.length === 0) {
        return { city: 'Unknown', state: 'Unknown', tier: 'tier3' };
      }

      const result = data[0];
      return {
        city: result.city || 'Unknown',
        state: result.state || 'Unknown',
        tier: result.tier || 'tier3'
      };
    } catch (error) {
      console.error('Failed to get location from pincode:', error);
      return { city: 'Unknown', state: 'Unknown', tier: 'tier3' };
    }
  }

  /**
   * Get rate card for client and tier using the database function
   */
  async getRateCardForClientTier(
    clientId: string, 
    tier: string, 
    completionSlab: string
  ): Promise<{
    rate_card_id: string | null;
    base_rate_inr: number;
    travel_allowance_inr: number;
    bonus_inr: number;
  } | null> {
    try {
      const { data, error } = await supabase
        .rpc('get_rate_card_for_client_tier', {
          p_client_id: clientId,
          p_tier: tier,
          p_completion_slab: completionSlab
        });

      if (error) {
        console.error('Database function error:', error);
        return { rate_card_id: null, base_rate_inr: 0, travel_allowance_inr: 0, bonus_inr: 0 };
      }

      if (!data || data.length === 0) {
        return { rate_card_id: null, base_rate_inr: 0, travel_allowance_inr: 0, bonus_inr: 0 };
      }

      const result = data[0];
      return {
        rate_card_id: result.rate_card_id,
        base_rate_inr: Number(result.base_rate_inr) || 0,
        travel_allowance_inr: Number(result.travel_allowance_inr) || 0,
        bonus_inr: Number(result.bonus_inr) || 0
      };
    } catch (error) {
      console.error('Failed to get rate card for client tier:', error);
      return { rate_card_id: null, base_rate_inr: 0, travel_allowance_inr: 0, bonus_inr: 0 };
    }
  }

  /**
   * Get completion slab from TAT hours
   */
  getCompletionSlab(tatHours: number): string {
    if (tatHours <= 24) return 'within_24h';
    if (tatHours <= 48) return 'within_48h';
    if (tatHours <= 72) return 'within_72h';
    if (tatHours <= 168) return 'within_168h';
    return 'beyond_168h';
  }

  /**
   * Fallback defaults when database functions fail
   */
  private getFallbackDefaults(): CaseFormDefaults {
    return {
      city: 'Unknown',
      state: 'Unknown',
      tier: 'tier3',
      tat_hours: 24,
      working_hours_start: '09:00',
      working_hours_end: '19:00',
      bonuses: [],
      penalties: []
    };
  }
}

// Export singleton instance
export const caseFormService = new CaseFormService();