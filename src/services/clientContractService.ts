import { supabase } from '@/integrations/supabase/client';
import { pincodeTierService } from './pincodeTierService';

export interface ClientContractDefaults {
  defaultTatHours: number;
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
        .select('id, tier1_tat_days, tier2_tat_days, tier3_tat_days')
        .eq('client_id', clientId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (contractError && contractError.code !== 'PGRST116') {
        throw contractError;
      }

      const contract = contracts && contracts.length > 0 ? contracts[0] : null;

      if (!contract) {
        return {
          defaultTatHours: 24,
          contractId: null,
        };
      }

      // Use tier1 TAT by default (can be adjusted based on pincode tier)
      return {
        defaultTatHours: contract.tier1_tat_days * 24, // Convert days to hours
        contractId: contract.id,
      };
    } catch (error) {
      console.error('Failed to get client defaults:', error);
      return {
        defaultTatHours: 24,
        contractId: null,
      };
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
      return 'tier3';
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
