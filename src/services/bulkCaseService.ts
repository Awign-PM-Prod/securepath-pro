// =====================================================
// Bulk Case Creation Service
// =====================================================

import { supabase } from '@/integrations/supabase/client';
import { ParsedCaseData } from './csvParserService';
import { caseFormService } from './caseFormService';

export interface BulkCreationResult {
  success: boolean;
  created: number;
  failed: number;
  errors: string[];
  caseNumbers: string[];
}

export class BulkCaseService {
  /**
   * Create multiple cases from parsed data
   */
  static async createBulkCases(
    parsedData: ParsedCaseData[],
    createdBy: string
  ): Promise<BulkCreationResult> {
    const result: BulkCreationResult = {
      success: true,
      created: 0,
      failed: 0,
      errors: [],
      caseNumbers: []
    };

    try {
      // Process cases in batches to avoid overwhelming the database
      const batchSize = 10;
      const batches = this.chunkArray(parsedData, batchSize);

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} cases)`);

        for (const caseData of batch) {
          try {
            const caseResult = await this.createSingleCase(caseData, createdBy);
            if (caseResult.success) {
              result.created++;
              result.caseNumbers.push(caseResult.caseNumber!);
            } else {
              result.failed++;
              result.errors.push(caseResult.error!);
            }
          } catch (error) {
            result.failed++;
            result.errors.push(`Failed to create case: ${error}`);
          }
        }
      }

      if (result.failed > 0) {
        result.success = false;
      }

    } catch (error) {
      result.success = false;
      result.errors.push(`Bulk creation failed: ${error}`);
    }

    return result;
  }

  /**
   * Create a single case
   */
  private static async createSingleCase(
    caseData: ParsedCaseData,
    createdBy: string
  ): Promise<{ success: boolean; caseNumber?: string; error?: string }> {
    try {
      // Check if a case with this client_case_id already exists for the same client
      const { data: existingCases } = await supabase
        .from('cases')
        .select('id, case_number')
        .eq('client_case_id', caseData.client_case_id)
        .eq('client_id', caseData.client_id);

      if (existingCases && existingCases.length > 0) {
        return { 
          success: false, 
          error: `A case with client case ID '${caseData.client_case_id}' already exists for this client. Existing case: ${existingCases[0].case_number}` 
        };
      }

      // First, create or get location
      const locationResult = await this.createOrGetLocation(caseData);
      if (!locationResult.success) {
        return { success: false, error: locationResult.error };
      }

      // Get case defaults from client contract
      const caseDefaults = await caseFormService.getCaseDefaults(
        caseData.client_id,
        caseData.contract_type,
        caseData.pincode,
        caseData.tat_hours
      );

      if (!caseDefaults) {
        return { success: false, error: 'Failed to get case defaults from client contract' };
      }

      // Get client contract for pricing
      console.log('Bulk upload debug:', {
        clientId: caseData.client_id,
        tier: caseDefaults.tier,
        pincode: caseData.pincode
      });
      
      // Get client contract for pricing - this is required for proper payout calculation
      // Filter by contract_type to get the specific contract for the case type
      const { data: clientContract, error: contractError } = await supabase
        .from('client_contracts')
        .select('*')
        .eq('client_id', caseData.client_id)
        .eq('contract_type', caseData.contract_type)
        .eq('is_active', true)
        .single();

      console.log('Client contract result:', clientContract);
      console.log('Contract error:', contractError);

      if (contractError || !clientContract) {
        return { 
          success: false, 
          error: `No active client contract found for client ID: ${caseData.client_id}. Please set up a client contract with tier-based pricing before creating cases.` 
        };
      }

      // Calculate rates based on tier from contract
      let baseRate = 0;
      let travelAllowance = 0;
      let bonus = 0;

      switch (caseDefaults.tier) {
        case 'tier1':
          baseRate = clientContract.tier1_base_payout_inr || 0;
          break;
        case 'tier2':
          baseRate = clientContract.tier2_base_payout_inr || 0;
          break;
        case 'tier3':
          baseRate = clientContract.tier3_base_payout_inr || 0;
          break;
        default:
          baseRate = clientContract.tier3_base_payout_inr || 0;
      }

      // Don't calculate bonuses for bulk upload - only show base payout
      bonus = 0;
      travelAllowance = 0;

      const rateCard = {
        base_rate_inr: baseRate,
        travel_allowance_inr: travelAllowance,
        bonus_inr: bonus
      };

      console.log('Calculated rates from contract:', rateCard);

      // Generate case number
      const caseNumber = await this.generateCaseNumber();

      // Calculate due date
      const dueAt = new Date();
      dueAt.setHours(dueAt.getHours() + caseData.tat_hours);

      // Calculate total payout
      const totalPayout = rateCard.base_rate_inr + rateCard.travel_allowance_inr + rateCard.bonus_inr;
      console.log('Payout calculation:', {
        baseRate: rateCard.base_rate_inr,
        travelAllowance: rateCard.travel_allowance_inr,
        bonus: rateCard.bonus_inr,
        totalPayout
      });

      // Validate that we have valid rates
      if (rateCard.base_rate_inr === 0 && rateCard.travel_allowance_inr === 0 && rateCard.bonus_inr === 0) {
        return { 
          success: false, 
          error: `Client contract found but all rates are zero. Please check the contract pricing for tier: ${caseDefaults.tier}` 
        };
      }

      // Create case
      const caseDataToInsert = {
        case_number: caseNumber,
        title: `${caseData.candidate_name} - ${caseData.contract_type}`,
        description: `Background verification for ${caseData.candidate_name}`,
        priority: caseData.priority,
        source: 'manual',
        client_id: caseData.client_id,
        location_id: locationResult.locationId,
        tat_hours: caseData.tat_hours,
        due_at: dueAt.toISOString(),
        status: 'new',
        base_rate_inr: rateCard.base_rate_inr,
        total_rate_inr: totalPayout,
        visible_to_gig: true,
        created_by: createdBy,
        metadata: {
          instructions: caseData.instructions || '',
          contract_type: caseData.contract_type,
          phone_primary: caseData.phone_primary,
          phone_secondary: caseData.phone_secondary || '',
          candidate_name: caseData.candidate_name
        },
        client_case_id: caseData.client_case_id,
        travel_allowance_inr: rateCard.travel_allowance_inr,
        bonus_inr: rateCard.bonus_inr,
        penalty_inr: 0,
        total_payout_inr: totalPayout,
        contract_type: caseData.contract_type,
        candidate_name: caseData.candidate_name,
        phone_primary: caseData.phone_primary,
        phone_secondary: caseData.phone_secondary || '',
        vendor_tat_start_date: dueAt.toISOString()
      };

      console.log('Case data being inserted:', {
        base_rate_inr: caseDataToInsert.base_rate_inr,
        travel_allowance_inr: caseDataToInsert.travel_allowance_inr,
        bonus_inr: caseDataToInsert.bonus_inr,
        total_payout_inr: caseDataToInsert.total_payout_inr,
        total_rate_inr: caseDataToInsert.total_rate_inr
      });

      const { data: caseRecord, error: caseError } = await supabase
        .from('cases')
        .insert(caseDataToInsert)
        .select('id, case_number')
        .single();

      if (caseError) {
        return { success: false, error: `Database error: ${caseError.message}` };
      }

      return { success: true, caseNumber: caseRecord.case_number };

    } catch (error) {
      return { success: false, error: `Unexpected error: ${error}` };
    }
  }

  /**
   * Create or get location
   */
  private static async createOrGetLocation(
    caseData: ParsedCaseData
  ): Promise<{ success: boolean; locationId?: string; error?: string }> {
    try {
      // Check if location already exists (with same address and pincode)
      const { data: existingLocation } = await supabase
        .from('locations')
        .select('id, location_url')
        .eq('pincode', caseData.pincode)
        .eq('address_line', caseData.address_line)
        .single();

      if (existingLocation) {
        // If location exists but has no URL and we have one, update it
        if (caseData.location_url && !existingLocation.location_url) {
          const { error: updateError } = await supabase
            .from('locations')
            .update({ location_url: caseData.location_url })
            .eq('id', existingLocation.id);
          
          if (updateError) {
            console.warn('Failed to update location URL:', updateError);
          }
        }
        return { success: true, locationId: existingLocation.id };
      }

      // Get pincode tier from database
      const pincodeTier = await this.getPincodeTier(caseData.pincode);

      // Create new location
      console.log('Creating location with URL:', caseData.location_url);
      const { data: location, error: locationError } = await supabase
        .from('locations')
        .insert({
          address_line: caseData.address_line,
          city: caseData.city,
          state: caseData.state,
          country: caseData.country,
          pincode: caseData.pincode,
          pincode_tier: pincodeTier,
          is_verified: false,
          location_url: caseData.location_url || null
        })
        .select('id, location_url')
        .single();

      if (locationError) {
        return { success: false, error: `Location creation failed: ${locationError.message}` };
      }

      console.log('Location created with URL:', location.location_url);
      return { success: true, locationId: location.id };

    } catch (error) {
      return { success: false, error: `Location error: ${error}` };
    }
  }

  /**
   * Generate unique case number
   */
  private static async generateCaseNumber(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    // Get count of cases created today
    const { count } = await supabase
      .from('cases')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString().slice(0, 10));

    const sequence = (count || 0) + 1;
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    return `BG-${dateStr}-${randomSuffix}`;
  }


  /**
   * Get pincode tier based on pincode from database
   */
  private static async getPincodeTier(pincode: string): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('pincode_tiers')
        .select('tier')
        .eq('pincode', pincode)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        console.warn(`No tier found for pincode ${pincode}, using tier3 as default`);
        return 'tier3';
      }

      // Database already uses tier1, tier2, tier3 format
      return data.tier;
    } catch (error) {
      console.error('Error fetching pincode tier:', error);
      return 'tier3'; // Default to tier3 on error
    }
  }

  /**
   * Split array into chunks
   */
  private static chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
