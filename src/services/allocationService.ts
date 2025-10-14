import { supabase } from '@/integrations/supabase/client';
import { notificationService } from './notificationService';
import { allocationEngine, AllocationResult } from './allocationEngine';

export interface AllocationRequest {
  caseId: string;
  pincode: string;
  pincodeTier: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  forceAllocation?: boolean;
}

export interface ManualAllocationRequest {
  caseId: string;
  gigWorkerId: string;
  pincode: string;
  pincodeTier: string;
}

export interface VendorAllocationRequest {
  caseId: string;
  vendorId: string;
  pincode: string;
  pincodeTier: string;
}

export interface AllocationResponse {
  success: boolean;
  allocationId?: string;
  assigneeId?: string;
  assigneeType?: 'gig' | 'vendor';
  vendorId?: string;
  score?: number;
  waveNumber?: number;
  acceptanceDeadline?: string;
  error?: string;
}

export interface CapacityUpdate {
  gigPartnerId: string;
  action: 'consume' | 'free' | 'reset';
  caseId?: string;
  reason?: string;
}

export interface BulkAllocationResult {
  successful: number;
  failed: number;
  errors: string[];
  allocations: AllocationResponse[];
}

export class AllocationService {
  /**
   * Allocate multiple cases in bulk
   */
  async allocateCases(caseIds: string[]): Promise<BulkAllocationResult> {
    const results: AllocationResponse[] = [];
    const errors: string[] = [];
    let successful = 0;
    let failed = 0;

    console.log(`Starting bulk allocation for ${caseIds.length} cases`);

    // Process cases sequentially to avoid capacity conflicts
    for (const caseId of caseIds) {
      try {
        // Get case details with proper joins
        const { data: caseData, error: caseError } = await supabase
          .from('cases')
          .select(`
            id,
            location:locations(
              pincode,
              pincode_tier
            ),
            client:clients(
              id,
              client_contracts(id, contract_type)
            )
          `)
          .eq('id', caseId)
          .single();

        if (caseError || !caseData) {
          throw new Error(`Failed to fetch case details: ${caseError?.message || 'Case not found'}`);
        }

        const pincode = caseData.location?.pincode;
        const pincodeTier = caseData.location?.pincode_tier;
        const clientContract = caseData.client?.client_contracts?.[0]; // Get first contract

        if (!pincode || !pincodeTier) {
          throw new Error('Case missing pincode or tier information');
        }

        if (!clientContract) {
          throw new Error('Case missing client contract information');
        }

        // Allocate the case
        const result = await this.allocateCase({
          caseId,
          pincode,
          pincodeTier,
          priority: 'medium'
        });

        console.log(`Allocation result for case ${caseId}:`, result);
        results.push(result);
      } catch (error) {
        console.error(`Allocation failed for case ${caseId}:`, error);
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Process results
    results.forEach((result, index) => {
      if (result.success) {
        successful++;
      } else {
        failed++;
        errors.push(`Case ${caseIds[index]}: ${result.error || 'Allocation failed'}`);
      }
    });

    console.log(`Bulk allocation completed: ${successful} successful, ${failed} failed`);

    return {
      successful,
      failed,
      errors,
      allocations: results
    };
  }

  /**
   * Allocate a case to the best available candidate
   */
  async allocateCase(request: AllocationRequest): Promise<AllocationResponse> {
    try {
      console.log('Starting allocation for case:', request.caseId);
      
      // Use the allocation engine to find the best candidate
      const result = await allocationEngine.allocateCase(
        request.caseId,
        request.pincode,
        request.pincodeTier
      );

      console.log('Allocation engine result:', result);

      if (!result.success) {
        console.log('Allocation failed:', result.error);
        return {
          success: false,
          error: result.error || 'Allocation failed'
        };
      }

      // The allocation engine already handles capacity validation and consumption
      // No need for additional capacity checks here to avoid race conditions

      // Note: Case and capacity are already updated by the allocation engine

      // Send notification to assigned worker
      await this.sendAllocationNotification(result.assignee_id, request.caseId);

      return {
        success: true,
        allocationId: result.allocationId,
        assigneeId: result.assignee_id,
        assigneeType: result.assignee_type,
        vendorId: result.vendor_id,
        score: result.score,
        waveNumber: result.wave_number,
        acceptanceDeadline: result.acceptance_deadline
      };

    } catch (error) {
      console.error('Allocation service error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown allocation error'
      };
    }
  }

  /**
   * Manually allocate a case to a specific gig worker
   */
  async allocateCaseManually(request: ManualAllocationRequest): Promise<AllocationResponse> {
    console.log('Starting manual allocation for case:', request.caseId, 'to gig worker:', request.gigWorkerId);
    
    try {
      // Verify the gig worker exists and has capacity
      const { data: gigWorker, error: gigWorkerError } = await supabase
        .from('gig_partners')
        .select('id, capacity_available, max_daily_capacity, is_active, is_available')
        .eq('id', request.gigWorkerId)
        .single();

      if (gigWorkerError || !gigWorker) {
        return {
          success: false,
          error: 'Gig worker not found'
        };
      }

      if (!gigWorker.is_active || !gigWorker.is_available) {
        return {
          success: false,
          error: 'Gig worker is not available'
        };
      }

      if (gigWorker.capacity_available <= 0) {
        return {
          success: false,
          error: 'Gig worker has no available capacity'
        };
      }

      // Get case details
      const { data: caseData, error: caseError } = await supabase
        .from('cases')
        .select('id, case_number, status, current_assignee_id')
        .eq('id', request.caseId)
        .single();

      if (caseError || !caseData) {
        return {
          success: false,
          error: 'Case not found'
        };
      }

      if (caseData.status !== 'created') {
        return {
          success: false,
          error: 'Case is not in created status'
        };
      }

      if (caseData.current_assignee_id) {
        return {
          success: false,
          error: 'Case is already assigned'
        };
      }

      // Create allocation log
      const { data: allocationLog, error: logError } = await supabase
        .from('allocation_logs')
        .insert({
          case_id: request.caseId,
          candidate_id: request.gigWorkerId,
          candidate_type: 'gig',
          allocated_at: new Date().toISOString(),
          decision: 'allocated',
          decision_at: new Date().toISOString(),
          wave_number: 1,
          score_snapshot: {
            manual_allocation: true,
            allocated_by: 'ops_team'
          },
          final_score: 1.0, // Perfect score for manual allocation
          acceptance_window_minutes: 30,
          acceptance_deadline: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (logError) {
        console.error('Failed to create allocation log:', logError);
        return {
          success: false,
          error: 'Failed to create allocation log'
        };
      }

      // Update case with assignment
      const { error: caseUpdateError } = await supabase
        .from('cases')
        .update({
          current_assignee_id: request.gigWorkerId,
          current_assignee_type: 'gig',
          status: 'auto_allocated',
          status_updated_at: new Date().toISOString(),
          last_updated_by: (await supabase.auth.getUser()).data.user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', request.caseId);

      if (caseUpdateError) {
        console.error('Failed to update case:', caseUpdateError);
        return {
          success: false,
          error: 'Failed to update case assignment'
        };
      }

      // Consume capacity
      await this.updateCapacity({
        gigPartnerId: request.gigWorkerId,
        action: 'consume',
        caseId: request.caseId,
        reason: 'Manual allocation'
      });

      // Send notification to assigned worker
      await this.sendAllocationNotification(request.gigWorkerId, request.caseId);

      console.log('Manual allocation successful for case:', request.caseId);

      return {
        success: true,
        allocationId: allocationLog.id,
        assigneeId: request.gigWorkerId,
        assigneeType: 'gig',
        caseId: request.caseId,
      };
    } catch (error) {
      console.error('Manual allocation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Manually allocate a case to a specific vendor
   */
  async allocateCaseToVendor(request: VendorAllocationRequest): Promise<AllocationResponse> {
    console.log('Starting vendor allocation for case:', request.caseId, 'to vendor:', request.vendorId);
    
    try {
      // Verify the vendor exists and has capacity
      const { data: vendor, error: vendorError } = await supabase
        .from('vendors')
        .select('id, capacity_available, max_daily_capacity, is_active')
        .eq('id', request.vendorId)
        .single();

      if (vendorError || !vendor) {
        return {
          success: false,
          error: 'Vendor not found'
        };
      }

      if (!vendor.is_active) {
        return {
          success: false,
          error: 'Vendor is not active'
        };
      }

      if (vendor.capacity_available <= 0) {
        return {
          success: false,
          error: 'Vendor has no available capacity'
        };
      }

      // Get case details
      const { data: caseData, error: caseError } = await supabase
        .from('cases')
        .select('id, case_number, status, current_assignee_id')
        .eq('id', request.caseId)
        .single();

      if (caseError || !caseData) {
        return {
          success: false,
          error: 'Case not found'
        };
      }

      if (caseData.status !== 'created') {
        return {
          success: false,
          error: 'Case is not in created status'
        };
      }

      if (caseData.current_assignee_id) {
        return {
          success: false,
          error: 'Case is already assigned'
        };
      }

      // Create allocation log
      const { data: allocationLog, error: logError } = await supabase
        .from('allocation_logs')
        .insert({
          case_id: request.caseId,
          candidate_id: request.vendorId, // This will be the vendor ID
          candidate_type: 'vendor',
          vendor_id: request.vendorId,
          allocated_at: new Date().toISOString(),
          decision: 'allocated',
          decision_at: new Date().toISOString(),
          wave_number: 1,
          score_snapshot: {
            manual_allocation: true,
            allocated_by: 'ops_team',
            vendor_allocation: true
          },
          final_score: 1.0, // Perfect score for manual allocation
          acceptance_window_minutes: 30,
          acceptance_deadline: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (logError) {
        console.error('Failed to create allocation log:', logError);
        return {
          success: false,
          error: 'Failed to create allocation log'
        };
      }

      // Update case with assignment
      const { error: caseUpdateError } = await supabase
        .from('cases')
        .update({
          current_assignee_id: request.vendorId,
          current_assignee_type: 'vendor',
          current_vendor_id: request.vendorId,
          status: 'auto_allocated',
          status_updated_at: new Date().toISOString(),
          last_updated_by: (await supabase.auth.getUser()).data.user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', request.caseId);

      if (caseUpdateError) {
        console.error('Failed to update case:', caseUpdateError);
        return {
          success: false,
          error: 'Failed to update case assignment'
        };
      }

      // Consume vendor capacity
      const { error: capacityError } = await supabase.rpc('consume_vendor_capacity', {
        p_vendor_id: request.vendorId,
        p_cases_count: 1
      });

      if (capacityError) {
        console.error('Failed to consume vendor capacity:', capacityError);
        return {
          success: false,
          error: 'Failed to update vendor capacity'
        };
      }

      // Send notification to vendor (if they have notification preferences)
      await this.sendVendorAllocationNotification(request.vendorId, request.caseId);

      console.log('Vendor allocation successful for case:', request.caseId);

      return {
        success: true,
        allocationId: allocationLog.id,
        assigneeId: request.vendorId,
        assigneeType: 'vendor',
        vendorId: request.vendorId,
        caseId: request.caseId,
      };
    } catch (error) {
      console.error('Vendor allocation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Handle allocation acceptance
   */
  async acceptAllocation(allocationId: string, caseId: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Update allocation log
      const { error: allocationError } = await supabase
        .from('allocation_logs')
        .update({
          decision: 'accepted',
          decision_at: new Date().toISOString(),
          accepted_at: new Date().toISOString()
        })
        .eq('id', allocationId);

      if (allocationError) throw allocationError;

      // Update case status
      const { error: caseError } = await supabase
        .from('cases')
        .update({
          status: 'accepted',
          status_updated_at: new Date().toISOString(),
          last_updated_by: user.id
        })
        .eq('id', caseId);

      if (caseError) throw caseError;

      // Update capacity (already consumed, no change needed)
      console.log('Allocation accepted for case:', caseId);

      return true;
    } catch (error) {
      console.error('Failed to accept allocation:', error);
      return false;
    }
  }

  /**
   * Handle allocation rejection
   */
  async rejectAllocation(allocationId: string, caseId: string, reason?: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Update allocation log
      const { error: allocationError } = await supabase
        .from('allocation_logs')
        .update({
          decision: 'rejected',
          decision_at: new Date().toISOString(),
          reallocation_reason: reason
        })
        .eq('id', allocationId);

      if (allocationError) throw allocationError;

      // Free up capacity
      await this.updateCapacity({
        gigPartnerId: '', // Will be determined from allocation log
        action: 'free',
        caseId: caseId,
        reason: 'Allocation rejected'
      });

      // Trigger reallocation
      await this.triggerReallocation(caseId);

      return true;
    } catch (error) {
      console.error('Failed to reject allocation:', error);
      return false;
    }
  }

  /**
   * Handle allocation timeout
   */
  async timeoutAllocation(allocationId: string, caseId: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Update allocation log
      const { error: allocationError } = await supabase
        .from('allocation_logs')
        .update({
          decision: 'timeout',
          decision_at: new Date().toISOString()
        })
        .eq('id', allocationId);

      if (allocationError) throw allocationError;

      // Free up capacity
      await this.updateCapacity({
        gigPartnerId: '', // Will be determined from allocation log
        action: 'free',
        caseId: caseId,
        reason: 'Allocation timeout'
      });

      // Trigger reallocation
      await this.triggerReallocation(caseId);

      return true;
    } catch (error) {
      console.error('Failed to timeout allocation:', error);
      return false;
    }
  }

  /**
   * Get allocation history for a case
   */
  async getAllocationHistory(caseId: string) {
    try {
      const { data, error } = await supabase
        .from('allocation_logs')
        .select(`
          *,
          gig_partners!inner(
            profiles(first_name, last_name, email)
          ),
          vendors(name)
        `)
        .eq('case_id', caseId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to get allocation history:', error);
      return [];
    }
  }

  /**
   * Get capacity overview for all gig workers
   */
  async getCapacityOverview() {
    try {
      const { data, error } = await supabase
        .from('capacity_tracking')
        .select(`
          *,
          gig_partners!inner(
            profiles(first_name, last_name, email),
            quality_score,
            completion_rate,
            ontime_completion_rate,
            acceptance_rate,
            coverage_pincodes,
            is_active,
            is_available
          )
        `)
        .eq('is_active', true)
        .order('current_capacity_available', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to get capacity overview:', error);
      return [];
    }
  }

  /**
   * Update case with allocation details
   */
  private async updateCaseAllocation(caseId: string, allocation: {
    assigneeId: string;
    assigneeType: 'gig' | 'vendor';
    vendorId?: string;
    allocationId?: string;
  }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('cases')
      .update({
        current_assignee_id: allocation.assigneeId,
        current_assignee_type: allocation.assigneeType,
        current_vendor_id: allocation.vendorId,
        status: 'auto_allocated',
        status_updated_at: new Date().toISOString(),
        last_updated_by: user.id
      })
      .eq('id', caseId);

    if (error) throw error;
  }

  /**
   * Update capacity tracking
   */
  private async updateCapacity(update: CapacityUpdate) {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      if (update.action === 'consume') {
        // Get current capacity data
        const { data: currentCapacity, error: fetchError } = await supabase
          .from('capacity_tracking')
          .select('current_capacity_available, cases_allocated, max_daily_capacity')
          .eq('gig_partner_id', update.gigPartnerId)
          .eq('date', today)
          .single();

        if (fetchError) {
          console.error('Failed to fetch current capacity:', fetchError);
          return;
        }

        if (!currentCapacity) {
          console.error('No capacity tracking record found for gig partner:', update.gigPartnerId);
          return;
        }

        // Calculate new values
        const newCapacityAvailable = Math.max(0, currentCapacity.current_capacity_available - 1);
        const newCasesAllocated = currentCapacity.cases_allocated + 1;

        // Get actual count of cases assigned to this gig worker
        const { data: assignedCases, error: countError } = await supabase
          .from('cases')
          .select('id', { count: 'exact' })
          .eq('current_assignee_id', update.gigPartnerId)
          .in('status', ['auto_allocated', 'accepted', 'in_progress', 'submitted']);

        if (countError) {
          console.error('Failed to get assigned cases count:', countError);
          // Continue with the allocation even if count fails
        }

        const actualAssignedCount = assignedCases?.length || 0;

        // Update capacity tracking
        const { error } = await supabase
          .from('capacity_tracking')
          .update({
            current_capacity_available: newCapacityAvailable,
            cases_allocated: newCasesAllocated,
            last_capacity_consumed_at: new Date().toISOString()
          })
          .eq('gig_partner_id', update.gigPartnerId)
          .eq('date', today);

        if (error) throw error;

        // Also update the gig_partners table with actual count
        const { error: gigError } = await supabase
          .from('gig_partners')
          .update({
            capacity_available: newCapacityAvailable,
            active_cases_count: actualAssignedCount,
            updated_at: new Date().toISOString()
          })
          .eq('id', update.gigPartnerId);

        if (gigError) throw gigError;

        console.log(`Capacity consumed for gig partner ${update.gigPartnerId}: ${newCapacityAvailable}/${currentCapacity.max_daily_capacity} available`);
        
      } else if (update.action === 'free') {
        // Get current capacity data (use maybeSingle to handle 0 rows)
        const { data: currentCapacity, error: fetchError } = await supabase
          .from('capacity_tracking')
          .select('current_capacity_available, cases_allocated, max_daily_capacity')
          .eq('gig_partner_id', update.gigPartnerId)
          .eq('date', today)
          .maybeSingle();

        if (fetchError) {
          console.error('Failed to fetch current capacity:', fetchError);
          return;
        }

        // If no capacity tracking record exists, just update gig_partners table
        if (!currentCapacity) {
          console.log('No capacity tracking record found, updating gig_partners directly');
          // Skip capacity_tracking update, it will be handled by gig_partners update below
        }

        // Get actual count of cases assigned to this gig worker
        const { data: assignedCases, error: countError } = await supabase
          .from('cases')
          .select('id', { count: 'exact' })
          .eq('current_assignee_id', update.gigPartnerId)
          .in('status', ['auto_allocated', 'accepted', 'in_progress', 'submitted']);

        if (countError) {
          console.error('Failed to get assigned cases count:', countError);
          // Continue with the unallocation even if count fails
        }

        const actualAssignedCount = assignedCases?.length || 0;
        
        // Get max daily capacity from gig_partners if capacity tracking doesn't exist
        let maxCapacity = currentCapacity?.max_daily_capacity;
        
        if (!maxCapacity) {
          const { data: gigPartner } = await supabase
            .from('gig_partners')
            .select('max_daily_capacity')
            .eq('id', update.gigPartnerId)
            .single();
          maxCapacity = gigPartner?.max_daily_capacity || 1;
        }
        
        // Calculate new values based on actual assigned count
        const newCapacityAvailable = Math.min(maxCapacity, maxCapacity - actualAssignedCount);
        const newCasesAllocated = actualAssignedCount;

        // Update capacity tracking only if record exists
        if (currentCapacity) {
          const { error } = await supabase
            .from('capacity_tracking')
            .update({
              current_capacity_available: newCapacityAvailable,
              cases_allocated: newCasesAllocated,
              last_capacity_freed_at: new Date().toISOString()
            })
            .eq('gig_partner_id', update.gigPartnerId)
            .eq('date', today);

          if (error) console.warn('Failed to update capacity_tracking:', error);
        }

        // Always update the gig_partners table with actual count
        const { error: gigError } = await supabase
          .from('gig_partners')
          .update({
            capacity_available: newCapacityAvailable,
            active_cases_count: actualAssignedCount,
            updated_at: new Date().toISOString()
          })
          .eq('id', update.gigPartnerId);

        if (gigError) throw gigError;

        console.log(`Capacity freed for gig partner ${update.gigPartnerId}: ${newCapacityAvailable}/${maxCapacity} available`);
        
      } else if (update.action === 'reset') {
        // Get max daily capacity
        const { data: gigPartner, error: fetchError } = await supabase
          .from('gig_partners')
          .select('max_daily_capacity')
          .eq('id', update.gigPartnerId)
          .single();

        if (fetchError) {
          console.error('Failed to fetch gig partner data:', fetchError);
          return;
        }

        // Reset capacity for the day
        const { error } = await supabase
          .from('capacity_tracking')
          .update({
            current_capacity_available: gigPartner.max_daily_capacity,
            cases_allocated: 0,
            cases_accepted: 0,
            cases_in_progress: 0,
            cases_submitted: 0,
            cases_completed: 0,
            last_reset_at: new Date().toISOString(),
            reset_count: 0
          })
          .eq('gig_partner_id', update.gigPartnerId)
          .eq('date', today);

        if (error) throw error;

        // Also update the gig_partners table
        const { error: gigError } = await supabase
          .from('gig_partners')
          .update({
            capacity_available: gigPartner.max_daily_capacity,
            active_cases_count: 0,
            updated_at: new Date().toISOString()
          })
          .eq('id', update.gigPartnerId);

        if (gigError) throw gigError;

        console.log(`Capacity reset for gig partner ${update.gigPartnerId}: ${gigPartner.max_daily_capacity}/${gigPartner.max_daily_capacity} available`);
      }
    } catch (error) {
      console.error('Failed to update capacity:', error);
      // Don't throw error to prevent allocation failure
      console.warn('Capacity update failed, but continuing with allocation');
    }
  }

  /**
   * Send allocation notification
   */
  private async sendAllocationNotification(gigPartnerId: string, caseId: string) {
    try {
      console.log('Sending allocation notification to:', gigPartnerId, 'for case:', caseId);
      
      // Get case details for notification
      const { data: caseData, error: caseError } = await supabase
        .from('cases')
        .select('case_number')
        .eq('id', caseId)
        .single();

      if (caseError) {
        console.error('Error getting case details for notification:', caseError);
        return;
      }

      // Send notification
      await notificationService.sendCaseAllocationNotification(
        caseId,
        gigPartnerId,
        caseData.case_number
      );
    } catch (error) {
      console.error('Failed to send allocation notification:', error);
    }
  }

  /**
   * Send vendor allocation notification
   */
  private async sendVendorAllocationNotification(vendorId: string, caseId: string) {
    try {
      console.log('Sending vendor allocation notification to:', vendorId, 'for case:', caseId);
      
      // Get case details for notification
      const { data: caseData, error: caseError } = await supabase
        .from('cases')
        .select('case_number')
        .eq('id', caseId)
        .single();

      if (caseError) {
        console.error('Error getting case details for vendor notification:', caseError);
        return;
      }

      // Get vendor profile for notification
      const { data: vendorProfile, error: profileError } = await supabase
        .from('vendors')
        .select('profile_id')
        .eq('id', vendorId)
        .single();

      if (profileError || !vendorProfile) {
        console.error('Error getting vendor profile for notification:', profileError);
        return;
      }

      // Send notification to vendor
      await notificationService.sendCaseAllocationNotification(
        caseId,
        vendorProfile.profile_id,
        caseData.case_number
      );
    } catch (error) {
      console.error('Failed to send vendor allocation notification:', error);
    }
  }

  /**
   * Trigger reallocation for a case
   */
  private async triggerReallocation(caseId: string) {
    try {
      // Get case details for reallocation
      const { data: caseData, error: caseError } = await supabase
        .from('cases')
        .select(`
          *,
          locations(pincode),
          client_contracts(contract_type)
        `)
        .eq('id', caseId)
        .single();

      if (caseError || !caseData) {
        console.error('Failed to get case for reallocation:', caseError);
        return;
      }

      // Get pincode tier
      const pincodeTier = await this.getPincodeTier(caseData.locations.pincode);

      // Attempt reallocation
      const result = await this.allocateCase({
        caseId: caseId,
        pincode: caseData.locations.pincode,
        pincodeTier: pincodeTier,
        priority: 'medium'
      });

      if (!result.success) {
        console.error('Reallocation failed:', result.error);
        // TODO: Alert vendor management team
      }
    } catch (error) {
      console.error('Failed to trigger reallocation:', error);
    }
  }

  /**
   * Get pincode tier for a given pincode
   */
  private async getPincodeTier(pincode: string): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('pincode_tiers')
        .select('tier')
        .eq('pincode', pincode)
        .single();

      if (error || !data) {
        console.warn('Pincode tier not found for:', pincode, 'using tier3 as default');
        return 'tier3';
      }

      return data.tier;
    } catch (error) {
      console.error('Failed to get pincode tier:', error);
      return 'tier3'; // Default fallback
    }
  }

  /**
   * Initialize daily capacity for all active gig workers
   */
  async initializeDailyCapacity() {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Get all active gig workers
      const { data: gigWorkers, error: workersError } = await supabase
        .from('gig_partners')
        .select('id, max_daily_capacity')
        .eq('is_active', true);

      if (workersError) throw workersError;

      // Initialize capacity tracking for today
      for (const worker of gigWorkers || []) {
        const { error: capacityError } = await supabase
          .from('capacity_tracking')
          .upsert({
            gig_partner_id: worker.id,
            date: today,
            max_daily_capacity: worker.max_daily_capacity,
            initial_capacity_available: worker.max_daily_capacity,
            current_capacity_available: worker.max_daily_capacity,
            is_active: true
          }, {
            onConflict: 'gig_partner_id,date'
          });

        if (capacityError) {
          console.error('Failed to initialize capacity for worker:', worker.id, capacityError);
        }
      }

      console.log('Daily capacity initialized for', gigWorkers?.length || 0, 'workers');
    } catch (error) {
      console.error('Failed to initialize daily capacity:', error);
    }
  }

  /**
   * Unallocate a case - remove assignment and change status to created
   */
  async unallocateCase(caseId: string, reason?: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get case details to find current assignee
      const { data: caseData, error: caseError } = await supabase
        .from('cases')
        .select('id, current_assignee_id, current_assignee_type, status')
        .eq('id', caseId)
        .single();

      if (caseError || !caseData) {
        return { success: false, error: 'Case not found' };
      }

      if (!caseData.current_assignee_id) {
        return { success: false, error: 'Case is not currently allocated' };
      }

      // Update case to remove assignment and change status to created
      const { error: updateError } = await supabase
        .from('cases')
        .update({
          current_assignee_id: null,
          current_assignee_type: null,
          current_vendor_id: null,
          status: 'created',
          status_updated_at: new Date().toISOString()
        })
        .eq('id', caseId);

      if (updateError) {
        console.error('Failed to update case:', updateError);
        return { success: false, error: 'Failed to update case' };
      }

      // Free up capacity for the assignee
      await this.updateCapacity({
        gigPartnerId: caseData.current_assignee_id,
        action: 'free',
        caseId: caseId,
        reason: reason || 'Case unallocated'
      });

      // Update allocation log to mark as unallocated
      const { error: logError } = await supabase
        .from('allocation_logs')
        .update({
          decision: 'unallocated',
          decision_at: new Date().toISOString(),
          reallocation_reason: reason || 'Manually unallocated'
        })
        .eq('case_id', caseId)
        .eq('candidate_id', caseData.current_assignee_id)
        .is('decision', null); // Look for records with null decision (newly allocated)

      if (logError) {
        console.warn('Failed to update allocation log:', logError);
        // Don't fail the unallocation for this
      }

      console.log(`Case ${caseId} unallocated from ${caseData.current_assignee_id}`);
      return { success: true };
    } catch (error) {
      console.error('Failed to unallocate case:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Bulk unallocate multiple cases
   */
  async unallocateCases(caseIds: string[], reason?: string): Promise<{
    successful: number;
    failed: number;
    errors: string[];
  }> {
    const results = {
      successful: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Process cases in parallel with concurrency limit
    const concurrencyLimit = 5;
    for (let i = 0; i < caseIds.length; i += concurrencyLimit) {
      const batch = caseIds.slice(i, i + concurrencyLimit);
      
      const batchPromises = batch.map(async (caseId) => {
        const result = await this.unallocateCase(caseId, reason);
        if (result.success) {
          results.successful++;
        } else {
          results.failed++;
          results.errors.push(`Case ${caseId}: ${result.error}`);
        }
      });

      await Promise.all(batchPromises);
    }

    return results;
  }
}

// Export singleton instance
export const allocationService = new AllocationService();
