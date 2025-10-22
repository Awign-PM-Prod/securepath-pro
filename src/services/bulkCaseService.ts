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

      // Get rate card for the client and tier
      const completionSlab = caseFormService.getCompletionSlab(caseData.tat_hours);
      const rateCard = await caseFormService.getRateCardForClientTier(
        caseData.client_id,
        caseDefaults.tier,
        completionSlab
      );

      if (!rateCard) {
        return { success: false, error: 'Failed to get rate card for client and tier' };
      }

      // Generate case number
      const caseNumber = await this.generateCaseNumber();

      // Calculate due date
      const dueAt = new Date();
      dueAt.setHours(dueAt.getHours() + caseData.tat_hours);

      // Calculate total payout
      const totalPayout = rateCard.base_rate_inr + rateCard.travel_allowance_inr + rateCard.bonus_inr;

      // Create case
      const { data: caseRecord, error: caseError } = await supabase
        .from('cases')
        .insert({
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
        })
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
      // Check if location already exists
      const { data: existingLocation } = await supabase
        .from('locations')
        .select('id')
        .eq('pincode', caseData.pincode)
        .eq('address_line', caseData.address_line)
        .single();

      if (existingLocation) {
        return { success: true, locationId: existingLocation.id };
      }

      // Create new location
      const { data: location, error: locationError } = await supabase
        .from('locations')
        .insert({
          address_line: caseData.address_line,
          city: caseData.city,
          state: caseData.state,
          country: caseData.country,
          pincode: caseData.pincode,
          pincode_tier: this.getPincodeTier(caseData.pincode),
          is_verified: false
        })
        .select('id')
        .single();

      if (locationError) {
        return { success: false, error: `Location creation failed: ${locationError.message}` };
      }

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
   * Get pincode tier based on pincode
   */
  private static getPincodeTier(pincode: string): string {
    // Simple tier assignment based on pincode ranges
    const firstDigit = pincode.charAt(0);
    
    if (['1', '2', '3', '4', '5'].includes(firstDigit)) {
      return 'tier_1'; // Metro cities
    } else if (['6', '7'].includes(firstDigit)) {
      return 'tier_2'; // Tier 2 cities
    } else {
      return 'tier_3'; // Rural areas
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
