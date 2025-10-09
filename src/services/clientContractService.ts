import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { pincodeTierService } from './pincodeTierService';

type ClientContract = Database['public']['Tables']['client_contracts']['Row'];
type RateCard = Database['public']['Tables']['rate_cards']['Row'];

export interface ClientContractDefaults {
  defaultTatHours: number;
  rateCardId: string | null;
  rateCard: RateCard | null;
  contractId: string | null;
}

export class ClientContractService {
  /**
   * Get active client contract defaults for a specific client
   */
  async getClientDefaults(clientId: string): Promise<ClientContractDefaults> {
    try {
      // Get the most recent active contract for the client
      const { data: contracts, error: contractError } = await supabase
        .from('client_contracts')
        .select(`
          id,
          default_tat_hours,
          rate_card_id,
          rate_cards (
            id,
            name,
            pincode_tier,
            completion_slab,
            base_rate_inr,
            default_travel_inr,
            default_bonus_inr,
            is_active
          )
        `)
        .eq('client_id', clientId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (contractError && contractError.code !== 'PGRST116') {
        throw contractError;
      }

      const contract = contracts && contracts.length > 0 ? contracts[0] : null;

      if (!contract) {
        // Return default values if no contract found
        return {
          defaultTatHours: 24,
          rateCardId: null,
          rateCard: null,
          contractId: null,
        };
      }

      return {
        defaultTatHours: contract.default_tat_hours,
        rateCardId: contract.rate_card_id,
        rateCard: contract.rate_cards as RateCard | null,
        contractId: contract.id,
      };
    } catch (error) {
      console.error('Failed to get client defaults:', error);
      // Return default values on error
      return {
        defaultTatHours: 24,
        rateCardId: null,
        rateCard: null,
        contractId: null,
      };
    }
  }

  /**
   * Get rate card based on pincode tier and completion slab
   */
  async getRateCardForLocation(
    pincodeTier: string,
    completionSlab: string,
    clientId?: string
  ): Promise<RateCard | null> {
    try {
      // First try to find client-specific rate card
      if (clientId) {
        const { data: clientRateCards, error: clientError } = await supabase
          .from('rate_cards')
          .select('*')
          .eq('client_id', clientId)
          .eq('pincode_tier', pincodeTier)
          .eq('completion_slab', completionSlab)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1);

        if (clientRateCards && clientRateCards.length > 0 && !clientError) {
          return clientRateCards[0];
        }
      }

      // Fallback to global rate card
      const { data: globalRateCards, error: globalError } = await supabase
        .from('rate_cards')
        .select('*')
        .is('client_id', null)
        .eq('pincode_tier', pincodeTier)
        .eq('completion_slab', completionSlab)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (globalError && globalError.code !== 'PGRST116') {
        throw globalError;
      }

      return globalRateCards && globalRateCards.length > 0 ? globalRateCards[0] : null;
    } catch (error) {
      console.error('Failed to get rate card for location:', error);
      return null;
    }
  }

  /**
   * Get all available rate cards for a client (including global ones)
   */
  async getAvailableRateCards(clientId?: string): Promise<RateCard[]> {
    try {
      let query = supabase
        .from('rate_cards')
        .select('*')
        .eq('is_active', true);

      if (clientId) {
        query = query.or(`client_id.is.null,client_id.eq.${clientId}`);
      } else {
        query = query.is('client_id', null);
      }

      const { data, error } = await query.order('name');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to get available rate cards:', error);
      return [];
    }
  }

  /**
   * Get pincode tier for a given pincode
   */
  async getPincodeTier(pincode: string): Promise<string> {
    try {
      return await pincodeTierService.getPincodeTier(pincode);
    } catch (error) {
      console.error('Failed to get pincode tier:', error);
      return 'tier3'; // Default to tier 3 on error
    }
  }

  /**
   * Get completion slab based on TAT hours
   */
  getCompletionSlab(tatHours: number): string {
    if (tatHours <= 24) {
      return 'within_24h';
    } else if (tatHours <= 48) {
      return 'within_48h';
    } else if (tatHours <= 72) {
      return 'within_72h';
    } else if (tatHours <= 168) {
      return 'within_168h';
    } else {
      return 'beyond_168h';
    }
  }
}

// Export singleton instance
export const clientContractService = new ClientContractService();
