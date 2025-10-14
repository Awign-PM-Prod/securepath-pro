import { supabase } from '@/integrations/supabase/client';
import { PayoutCalculationService } from './payoutCalculationService';
import { pincodeTierService } from './pincodeTierService';

export interface Case {
  id: string;
  case_number: string;
  client_case_id: string;
  contract_type: string;
  candidate_name: string;
  phone_primary: string;
  phone_secondary?: string;
  status: 'created' | 'auto_allocated' | 'pending_acceptance' | 'accepted' | 'in_progress' | 'submitted' | 'qc_pending' | 'qc_passed' | 'qc_rejected' | 'qc_rework' | 'completed' | 'reported' | 'in_payment_cycle' | 'cancelled';
  client: {
    id: string;
    name: string;
    contact_person: string;
    phone: string;
    email: string;
  };
  location: {
    id: string;
    address_line: string;
    city: string;
    state: string;
    pincode: string;
    lat?: number;
    lng?: number;
  };
  current_assignee?: {
    id: string;
    name: string;
    type: 'gig' | 'vendor';
  };
  vendor_tat_start_date: string;
  due_at: string;
  base_rate_inr: number;
  bonus_inr: number;
  penalty_inr: number;
  total_payout_inr: number;
  tat_hours: number;
  instructions?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  last_updated_by: string;
  status_updated_at: string;
}

export interface CreateCaseData {
  client_case_id: string;
  contract_type: string;
  candidate_name: string;
  phone_primary: string;
  phone_secondary?: string;
  client_id: string;
  location_id: string;
  vendor_tat_start_date: string;
  due_at: string;
  base_rate_inr: number;
  bonus_inr: number;
  penalty_inr: number;
  total_payout_inr: number;
  tat_hours: number;
  instructions?: string;
}

export class CaseService {
  /**
   * Get all cases with related data
   */
  async getCases(): Promise<Case[]> {
    try {
      const { data, error } = await supabase
        .from('cases')
        .select(`
          id,
          case_number,
          client_case_id,
          contract_type,
          candidate_name,
          phone_primary,
          phone_secondary,
          status,
          current_assignee_id,
          current_assignee_type,
          current_vendor_id,
          vendor_tat_start_date,
          due_at,
          base_rate_inr,
          bonus_inr,
          penalty_inr,
          total_payout_inr,
          tat_hours,
          created_at,
          updated_at,
          created_by,
          last_updated_by,
          status_updated_at,
          clients!inner (
            id,
            name,
            contact_person,
            phone,
            email
          ),
          locations!inner (
            id,
            address_line,
            city,
            state,
            pincode,
            lat,
            lng
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get assignee information separately for both gig workers and vendors
      const casesWithAssignees = await Promise.all(
        data?.map(async (caseItem) => {
          let assigneeInfo = null;

          if (caseItem.current_assignee_id && caseItem.current_assignee_type) {
            if (caseItem.current_assignee_type === 'gig') {
              // Get gig worker info
              const { data: gigWorker } = await supabase
                .from('gig_partners')
                .select(`
                  id,
                  profiles!inner (
                    first_name,
                    last_name,
                    email,
                    phone
                  )
                `)
                .eq('id', caseItem.current_assignee_id)
                .single();

              if (gigWorker) {
                assigneeInfo = {
                  id: gigWorker.id,
                  name: `${gigWorker.profiles?.first_name || ''} ${gigWorker.profiles?.last_name || ''}`.trim() || 'Unknown',
                  type: 'gig' as const,
                };
              }
            } else if (caseItem.current_assignee_type === 'vendor') {
              // Get vendor info
              const { data: vendor } = await supabase
                .from('vendors')
                .select('id, name')
                .eq('id', caseItem.current_assignee_id)
                .single();

              if (vendor) {
                assigneeInfo = {
                  id: vendor.id,
                  name: vendor.name || 'Unknown Vendor',
                  type: 'vendor' as const,
                };
              }
            }
          }

          return {
            id: caseItem.id,
            case_number: caseItem.case_number,
            client_case_id: caseItem.client_case_id,
            contract_type: caseItem.contract_type,
            candidate_name: caseItem.candidate_name,
            phone_primary: caseItem.phone_primary,
            phone_secondary: caseItem.phone_secondary,
            status: caseItem.status,
            client: {
              id: caseItem.clients.id,
              name: caseItem.clients.name,
              contact_person: caseItem.clients.contact_person,
              phone: caseItem.clients.phone,
              email: caseItem.clients.email,
            },
            location: {
              id: caseItem.locations.id,
              address_line: caseItem.locations.address_line,
              city: caseItem.locations.city,
              state: caseItem.locations.state,
              pincode: caseItem.locations.pincode,
              lat: caseItem.locations.lat,
              lng: caseItem.locations.lng,
            },
            current_assignee: assigneeInfo,
            vendor_tat_start_date: caseItem.vendor_tat_start_date,
            due_at: caseItem.due_at,
            base_rate_inr: caseItem.base_rate_inr,
            bonus_inr: caseItem.bonus_inr,
            penalty_inr: caseItem.penalty_inr,
            total_payout_inr: caseItem.total_payout_inr,
            tat_hours: caseItem.tat_hours,
            instructions: '', // Will be extracted from metadata
            created_at: caseItem.created_at,
            updated_at: caseItem.updated_at,
            created_by: caseItem.created_by,
            last_updated_by: caseItem.last_updated_by,
            status_updated_at: caseItem.status_updated_at,
          };
        }) || []
      );

      return casesWithAssignees;
    } catch (error) {
      console.error('Failed to fetch cases:', error);
      return [];
    }
  }

  /**
   * Get a single case by ID
   */
  async getCaseById(id: string): Promise<Case | null> {
    try {
      const { data, error } = await supabase
        .from('cases')
        .select(`
          id,
          case_number,
          client_case_id,
          title,
          description,
          priority,
          status,
          due_at,
          base_rate_inr,
          total_rate_inr,
          tat_hours,
          created_at,
          updated_at,
          created_by,
          last_updated_by,
          status_updated_at,
          clients!inner (
            id,
            name,
            contact_person,
            phone,
            email
          ),
          locations!inner (
            id,
            address_line,
            city,
            state,
            pincode,
            lat,
            lng
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      return {
        id: data.id,
        case_number: data.case_number,
        client_case_id: data.client_case_id,
        title: data.title,
        description: data.description,
        priority: data.priority,
        status: data.status,
        client: {
          id: data.clients.id,
          name: data.clients.name,
          contact_person: data.clients.contact_person,
          phone: data.clients.phone,
          email: data.clients.email,
        },
        location: {
          id: data.locations.id,
          address_line: data.locations.address_line,
          city: data.locations.city,
          state: data.locations.state,
          pincode: data.locations.pincode,
          lat: data.locations.lat,
          lng: data.locations.lng,
        },
        due_at: data.due_at,
        base_rate_inr: data.base_rate_inr,
        total_rate_inr: data.total_rate_inr,
        travel_allowance_inr: 0, // Will be extracted from rate_adjustments
        bonus_inr: 0, // Will be extracted from rate_adjustments
        tat_hours: data.tat_hours,
        instructions: '', // Will be extracted from metadata
        created_at: data.created_at,
        updated_at: data.updated_at,
        created_by: data.created_by,
        last_updated_by: data.last_updated_by,
        status_updated_at: data.status_updated_at,
      };
    } catch (error) {
      console.error('Failed to fetch case:', error);
      return null;
    }
  }

  /**
   * Create a new case
   */
  async createCase(caseData: CreateCaseData): Promise<Case | null> {
    try {
      // Generate case number
      const caseNumber = `BG-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Calculate payout based on client contract and pincode tier
      const payoutResult = await PayoutCalculationService.calculatePayout(
        caseData.client_id,
        caseData.contract_type,
        caseData.location_id,
        caseData.bonus_inr || 0,
        caseData.penalty_inr || 0
      );

      // Prepare metadata JSONB for instructions and candidate info
      const metadata = {
        instructions: caseData.instructions || '',
        candidate_name: caseData.candidate_name,
        phone_primary: caseData.phone_primary,
        phone_secondary: caseData.phone_secondary || null,
        contract_type: caseData.contract_type
      };

      const { data, error } = await supabase
        .from('cases')
        .insert({
          case_number: caseNumber,
          title: `${caseData.candidate_name} - ${caseData.contract_type.replace('_', ' ').toUpperCase()}`,
          description: `Background verification for ${caseData.candidate_name}`,
          priority: 'medium',
          client_case_id: caseData.client_case_id,
          contract_type: caseData.contract_type,
          candidate_name: caseData.candidate_name,
          phone_primary: caseData.phone_primary,
          phone_secondary: caseData.phone_secondary,
          status: 'created',
          client_id: caseData.client_id,
          location_id: caseData.location_id,
          vendor_tat_start_date: caseData.vendor_tat_start_date,
          due_at: caseData.due_at,
          base_rate_inr: payoutResult.base_rate_inr,
          bonus_inr: payoutResult.bonus_inr,
          penalty_inr: payoutResult.penalty_inr,
          total_payout_inr: payoutResult.total_payout_inr,
          metadata: metadata,
          tat_hours: caseData.tat_hours,
          created_by: user.id,
          last_updated_by: user.id,
          status_updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // Return the created case with related data
      return await this.getCaseById(data.id);
    } catch (error) {
      console.error('Failed to create case:', error);
      return null;
    }
  }

  /**
   * Update a case
   */
  async updateCase(id: string, updates: Partial<CreateCaseData>): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Prepare update data
      const updateData: any = {
        ...updates,
        last_updated_by: user.id,
        updated_at: new Date().toISOString(),
      };

      // If rate fields are being updated, recalculate total_rate_inr
      if (updates.base_rate_inr !== undefined || updates.travel_allowance_inr !== undefined || updates.bonus_inr !== undefined) {
        const currentCase = await this.getCaseById(id);
        if (currentCase) {
          const baseRate = updates.base_rate_inr ?? currentCase.base_rate_inr;
          const travelAllowance = updates.travel_allowance_inr ?? 0;
          const bonus = updates.bonus_inr ?? 0;
          updateData.total_rate_inr = baseRate + travelAllowance + bonus;
          
          // Update rate_adjustments
          updateData.rate_adjustments = {
            travel_allowance_inr: travelAllowance,
            bonus_inr: bonus
          };
        }
      }

      // If instructions are being updated, update metadata
      if (updates.instructions !== undefined) {
        updateData.metadata = {
          instructions: updates.instructions
        };
      }

      const { error } = await supabase
        .from('cases')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to update case:', error);
      return false;
    }
  }

  /**
   * Delete a case
   */
  async deleteCase(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('cases')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to delete case:', error);
      return false;
    }
  }

  /**
   * Get all clients
   */
  async getClients(): Promise<Array<{ id: string; name: string; contact_person: string; email: string }>> {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, contact_person, email')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to fetch clients:', error);
      return [];
    }
  }


  /**
   * Create or get location
   */
  async createOrGetLocation(locationData: {
    address_line: string;
    city: string;
    state: string;
    pincode: string;
    lat?: number;
    lng?: number;
  }): Promise<string | null> {
    try {
      // First, try to find existing location
      const { data: existingLocations, error: queryError } = await supabase
        .from('locations')
        .select('id')
        .eq('address_line', locationData.address_line)
        .eq('city', locationData.city)
        .eq('state', locationData.state)
        .eq('pincode', locationData.pincode)
        .limit(1);

      if (queryError && queryError.code !== 'PGRST116') {
        throw queryError;
      }

      if (existingLocations && existingLocations.length > 0) {
        return existingLocations[0].id;
      }

      // Determine pincode tier
      const pincodeTierData = await pincodeTierService.getPincodeTier(locationData.pincode);
      const pincodeTier = pincodeTierData?.tier || 'tier3'; // Default to tier3 if not found

      // Create new location
      const { data, error } = await supabase
        .from('locations')
        .insert({
          address_line: locationData.address_line,
          city: locationData.city,
          state: locationData.state,
          pincode: locationData.pincode,
          country: 'India',
          lat: locationData.lat,
          lng: locationData.lng,
          pincode_tier: pincodeTier,
        })
        .select('id')
        .single();

      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error('Failed to create/get location:', error);
      return null;
    }
  }
}

// Export singleton instance
export const caseService = new CaseService();