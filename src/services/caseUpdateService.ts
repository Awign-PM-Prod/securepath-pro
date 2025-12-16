import { supabase } from '@/integrations/supabase/client';
import { PayoutCalculationService } from './payoutCalculationService';
import { pincodeTierService } from './pincodeTierService';

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
  location_url?: string;
  client_id: string;
  vendor_tat_start_date: Date;
  tat_hours: number;
  due_date: Date;
  instructions?: string;
}

export class CaseUpdateService {
  /**
   * Update an existing case
   */
  static async updateCase(caseId: string, caseData: UpdateCaseData): Promise<any> {
    try {
      // Get current user with retry logic
      let user = null;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (!user && retryCount < maxRetries) {
        const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
        
        if (userError) {
          console.warn(`Authentication attempt ${retryCount + 1} failed:`, userError);
          if (retryCount === maxRetries - 1) {
            // Try to refresh the session before giving up
            const { error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError) {
              throw new Error(`User not authenticated after ${maxRetries} attempts and refresh failed: ${userError.message}`);
            }
            // Try one more time after refresh
            const { data: { user: refreshedUser } } = await supabase.auth.getUser();
            if (refreshedUser) {
              user = refreshedUser;
              break;
            }
            throw new Error(`User not authenticated after ${maxRetries} attempts and session refresh: ${userError.message}`);
          }
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
          retryCount++;
          continue;
        }
        
        if (!currentUser) {
          console.warn(`No user found on attempt ${retryCount + 1}`);
          if (retryCount === maxRetries - 1) {
            throw new Error('User not authenticated');
          }
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
          retryCount++;
          continue;
        }
        
        user = currentUser;
      }
      
      if (!user) {
        throw new Error('User not authenticated after all retry attempts');
      }

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
        // Check if location exists - use maybeSingle() to handle case when no location is found
        const { data: existingLocation, error: locationCheckError } = await supabase
          .from('locations')
          .select('id')
          .eq('address_line', caseData.address_line)
          .eq('city', caseData.city)
          .eq('state', caseData.state)
          .eq('pincode', caseData.pincode)
          .maybeSingle();

        if (locationCheckError) {
          throw new Error(`Failed to check existing location: ${locationCheckError.message}`);
        }

        if (existingLocation) {
          locationId = existingLocation.id;
        } else {
          // Get pincode tier before creating location
          let pincodeTier: 'tier_1' | 'tier_2' | 'tier_3' = 'tier_3'; // Default fallback
          try {
            const pincodeTierData = await pincodeTierService.getPincodeTier(caseData.pincode);
            if (pincodeTierData && pincodeTierData.tier) {
              // Convert tier format: service returns 'tier1'|'tier2'|'tier3', DB expects 'tier_1'|'tier_2'|'tier_3'
              const tier = pincodeTierData.tier;
              if (tier === 'tier1' || tier === 'tier_1') {
                pincodeTier = 'tier_1';
              } else if (tier === 'tier2' || tier === 'tier_2') {
                pincodeTier = 'tier_2';
              } else if (tier === 'tier3' || tier === 'tier_3') {
                pincodeTier = 'tier_3';
              } else {
                // If format is unexpected, default to tier_3
                pincodeTier = 'tier_3';
              }
            }
          } catch (tierError) {
            // getPincodeTier uses .single() which throws if not found, so catch and use default
            console.warn(`Failed to fetch pincode tier for ${caseData.pincode}, using default tier_3:`, tierError);
            // Use default tier_3 if lookup fails
          }

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
              lng: caseData.lng,
              location_url: caseData.location_url,
              pincode_tier: pincodeTier
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

      // Prepare update data - explicitly avoid updating status to prevent enum issues
      const updateData: any = {
        client_case_id: caseData.client_case_id,
        contract_type: caseData.contract_type,
        candidate_name: caseData.candidate_name,
        phone_primary: caseData.phone_primary,
        phone_secondary: caseData.phone_secondary,
        location_id: locationId,
        tat_hours: caseData.tat_hours,
        due_at: caseData.due_date.toISOString(),
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
      
      // Ensure we don't accidentally update status during case edit
      // Status should only be changed through specific workflows, not during general case updates

      // Add payout data if recalculated
      if (payoutResult) {
        updateData.base_rate_inr = payoutResult.base_rate_inr;
        updateData.total_payout_inr = payoutResult.total_payout_inr;
      }

      // Update the case
      console.log('Updating case with data:', updateData);
      const { data, error } = await supabase
        .from('cases')
        .update(updateData)
        .eq('id', caseId)
        .select()
        .single();

      if (error) {
        console.error('Case update error:', error);
        throw new Error(`Failed to update case: ${error.message}`);
      }
      
      console.log('Case updated successfully:', data);

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
