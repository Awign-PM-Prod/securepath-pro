import { supabase } from '@/integrations/supabase/client';
import { PayoutCalculationService } from './payoutCalculationService';

export interface UpdateCaseData {
  client_case_id: string;
  contract_type: string;
  candidate_name: string;
  phone_primary: string;
  phone_secondary?: string;
  address_line: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  lat?: number;
  lng?: number;
  vendor_tat_start_date: Date;
  instructions?: string;
}

export class CaseUpdateService {
  /**
   * Update an existing case
   */
  static async updateCase(caseId: string, caseData: UpdateCaseData): Promise<any> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Get the current case to get client_id and location_id
      const { data: currentCase, error: caseError } = await supabase
        .from('cases')
        .select('client_id, location_id')
        .eq('id', caseId)
        .single();

      if (caseError) {
        throw new Error(`Failed to fetch case: ${caseError.message}`);
      }

      // Update or create location
      let locationId = currentCase.location_id;
      if (caseData.address_line || caseData.city || caseData.state || caseData.pincode) {
        // Check if location exists
        const { data: existingLocation } = await supabase
          .from('locations')
          .select('id')
          .eq('address_line', caseData.address_line)
          .eq('city', caseData.city)
          .eq('state', caseData.state)
          .eq('pincode', caseData.pincode)
          .single();

        if (existingLocation) {
          locationId = existingLocation.id;
        } else {
          // Create new location
          const { data: newLocation, error: locationError } = await supabase
            .from('locations')
            .insert({
              address_line: caseData.address_line,
              city: caseData.city,
              state: caseData.state,
              pincode: caseData.pincode,
              country: caseData.country,
              lat: caseData.lat,
              lng: caseData.lng
            })
            .select()
            .single();

          if (locationError) {
            throw new Error(`Failed to create location: ${locationError.message}`);
          }
          locationId = newLocation.id;
        }
      }

      // Recalculate payout if client or contract type changed
      const { data: updatedCase } = await supabase
        .from('cases')
        .select('client_id, contract_type, location_id')
        .eq('id', caseId)
        .single();

      let payoutResult = null;
      if (updatedCase.client_id !== currentCase.client_id || 
          updatedCase.contract_type !== caseData.contract_type ||
          updatedCase.location_id !== locationId) {
        
        // Recalculate payout
        payoutResult = await PayoutCalculationService.calculatePayout(
          currentCase.client_id,
          caseData.contract_type,
          locationId,
          0, // bonus_inr - will be preserved from current case
          0  // penalty_inr - will be preserved from current case
        );
      }

      // Prepare update data
      const updateData: any = {
        client_case_id: caseData.client_case_id,
        contract_type: caseData.contract_type,
        candidate_name: caseData.candidate_name,
        phone_primary: caseData.phone_primary,
        phone_secondary: caseData.phone_secondary,
        location_id: locationId,
        vendor_tat_start_date: caseData.vendor_tat_start_date.toISOString(),
        last_updated_by: user.id,
        updated_at: new Date().toISOString(),
        metadata: {
          instructions: caseData.instructions || '',
          candidate_name: caseData.candidate_name,
          phone_primary: caseData.phone_primary,
          phone_secondary: caseData.phone_secondary,
          contract_type: caseData.contract_type
        }
      };

      // Add payout data if recalculated
      if (payoutResult) {
        updateData.base_rate_inr = payoutResult.base_rate_inr;
        updateData.total_payout_inr = payoutResult.total_payout_inr;
      }

      // Update the case
      const { data, error } = await supabase
        .from('cases')
        .update(updateData)
        .eq('id', caseId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update case: ${error.message}`);
      }

      return data;

    } catch (error) {
      console.error('Error updating case:', error);
      throw error;
    }
  }

  /**
   * Get case data for editing
   */
  static async getCaseForEdit(caseId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('cases')
        .select(`
          *,
          client:clients(id, name),
          location:locations(*)
        `)
        .eq('id', caseId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch case: ${error.message}`);
      }

      return data;

    } catch (error) {
      console.error('Error fetching case for edit:', error);
      throw error;
    }
  }
}
