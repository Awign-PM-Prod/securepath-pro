import { supabase } from '@/integrations/supabase/client';

export interface PayoutCalculationResult {
  base_rate_inr: number;
  bonus_inr: number;
  penalty_inr: number;
  total_payout_inr: number;
  tier: string;
  contract_id: string;
}

export class PayoutCalculationService {
  /**
   * Calculate payout for a case based on client contract and pincode tier
   */
  static async calculatePayout(
    clientId: string,
    contractType: string,
    locationId: string,
    bonusInr: number = 0,
    penaltyInr: number = 0
  ): Promise<PayoutCalculationResult> {
    try {
      // 1. Get the client contract
      const { data: contract, error: contractError } = await supabase
        .from('client_contracts')
        .select('*')
        .eq('client_id', clientId)
        .eq('contract_type', contractType)
        .maybeSingle();

      if (contractError) {
        throw new Error(`Failed to fetch client contract: ${contractError.message}`);
      }

      // If no contract found, use default values
      if (!contract) {
        console.warn(`No contract found for client ${clientId} and contract type ${contractType}, using default values`);
        // Return default payout values
        return {
          base_rate_inr: 500, // Default base rate
          bonus_inr: bonusInr,
          penalty_inr: penaltyInr,
          total_payout_inr: 500 + bonusInr - penaltyInr,
          tier: 'tier3', // Default tier
          contract_id: null
        };
      }

      // 2. Get the location to find pincode
      const { data: location, error: locationError } = await supabase
        .from('locations')
        .select('pincode')
        .eq('id', locationId)
        .single();

      if (locationError) {
        throw new Error(`Failed to fetch location: ${locationError.message}`);
      }

      // 3. Get the pincode tier
      const { data: pincodeTier, error: tierError } = await supabase
        .from('pincode_tiers')
        .select('tier')
        .eq('pincode', location.pincode)
        .eq('is_active', true)
        .single();

      if (tierError) {
        throw new Error(`Failed to fetch pincode tier: ${tierError.message}`);
      }

      if (!pincodeTier) {
        throw new Error(`No tier found for pincode ${location.pincode}`);
      }

      // 4. Calculate base rate based on tier
      let baseRate = 0;
      const tier = pincodeTier.tier;

      switch (tier) {
        case 'tier1':
          baseRate = contract.tier1_base_payout_inr || 0;
          break;
        case 'tier2':
          baseRate = contract.tier2_base_payout_inr || 0;
          break;
        case 'tier3':
          baseRate = contract.tier3_base_payout_inr || 0;
          break;
        default:
          // Fallback to tier3 if tier is not recognized
          baseRate = contract.tier3_base_payout_inr || 0;
          break;
      }

      // 5. Calculate total payout
      const totalPayout = baseRate + bonusInr - penaltyInr;

      return {
        base_rate_inr: baseRate,
        bonus_inr: bonusInr,
        penalty_inr: penaltyInr,
        total_payout_inr: totalPayout,
        tier: tier,
        contract_id: contract.id
      };

    } catch (error) {
      console.error('Error calculating payout:', error);
      throw error;
    }
  }

  /**
   * Get client contract details for a specific client and contract type
   */
  static async getClientContract(clientId: string, contractType: string) {
    const { data, error } = await supabase
      .from('client_contracts')
      .select('*')
      .eq('client_id', clientId)
      .eq('contract_type', contractType)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch client contract: ${error.message}`);
    }

    return data;
  }

  /**
   * Get pincode tier information
   */
  static async getPincodeTier(pincode: string) {
    const { data, error } = await supabase
      .from('pincode_tiers')
      .select('*')
      .eq('pincode', pincode)
      .eq('is_active', true)
      .single();

    if (error) {
      throw new Error(`Failed to fetch pincode tier: ${error.message}`);
    }

    return data;
  }

  /**
   * Recalculate payout for an existing case
   */
  static async recalculateCasePayout(caseId: string): Promise<PayoutCalculationResult> {
    try {
      // Get the case details
      const { data: caseData, error: caseError } = await supabase
        .from('cases')
        .select(`
          client_id,
          contract_type,
          location_id,
          bonus_inr,
          penalty_inr
        `)
        .eq('id', caseId)
        .single();

      if (caseError) {
        throw new Error(`Failed to fetch case: ${caseError.message}`);
      }

      // Calculate new payout
      const payoutResult = await this.calculatePayout(
        caseData.client_id,
        caseData.contract_type,
        caseData.location_id,
        caseData.bonus_inr || 0,
        caseData.penalty_inr || 0
      );

      // Update the case with new payout
      const { error: updateError } = await supabase
        .from('cases')
        .update({
          base_rate_inr: payoutResult.base_rate_inr,
          total_payout_inr: payoutResult.total_payout_inr,
          updated_at: new Date().toISOString()
        })
        .eq('id', caseId);

      if (updateError) {
        throw new Error(`Failed to update case payout: ${updateError.message}`);
      }

      return payoutResult;

    } catch (error) {
      console.error('Error recalculating case payout:', error);
      throw error;
    }
  }
}
