import { supabase } from '@/integrations/supabase/client';
import { notificationService } from './notificationService';
import { caseNotificationService } from './caseNotificationService';
import { allocationEngine, AllocationResult, AllocationCandidate } from './allocationEngine';

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
   * Determine rejection reasons for a candidate compared to the best candidate
   */
  private getRejectionReasons(
    candidate: AllocationCandidate,
    bestCandidate: AllocationCandidate,
    bestScore: number,
    candidateScore: number
  ): string[] {
    if (!candidate || !bestCandidate) {
      return ['Invalid candidate data'];
    }

    const reasons: string[] = [];

    // Score comparison
    if (candidateScore < bestScore) {
      const scoreDiff = bestScore - candidateScore;
      reasons.push(`Lower final score (${scoreDiff.toFixed(2)} points lower)`);
    }

    // Quality score comparison
    const candidateQuality = candidate.quality_score ?? 0;
    const bestQuality = bestCandidate.quality_score ?? 0;
    if (candidateQuality < bestQuality) {
      const diff = ((bestQuality - candidateQuality) * 100).toFixed(1);
      reasons.push(`Lower quality score (${diff}% lower)`);
    }

    // Performance score comparison
    const candidatePerformance = candidate.performance_score ?? 0;
    const bestPerformance = bestCandidate.performance_score ?? 0;
    if (candidatePerformance < bestPerformance) {
      const diff = ((bestPerformance - candidatePerformance) * 100).toFixed(1);
      reasons.push(`Lower performance score (${diff}% lower)`);
    }

    // Location match comparison
    const locationPriority: Record<string, number> = { pincode: 3, city: 2, tier: 1 };
    const candidateLocationPriority = candidate.location_match_type ? locationPriority[candidate.location_match_type] || 0 : 0;
    const bestLocationPriority = bestCandidate.location_match_type ? locationPriority[bestCandidate.location_match_type] || 0 : 0;
    if (candidateLocationPriority < bestLocationPriority) {
      reasons.push(`Less precise location match (${candidate.location_match_type || 'none'} vs ${bestCandidate.location_match_type || 'none'})`);
    }

    // Experience comparison
    const candidateExperience = candidate.experience_score ?? 0;
    const bestExperience = bestCandidate.experience_score ?? 0;
    if (candidateExperience < bestExperience) {
      const candidateCases = candidate.total_cases_completed ?? 0;
      const bestCases = bestCandidate.total_cases_completed ?? 0;
      reasons.push(`Less experience (${candidateCases} vs ${bestCases} cases completed)`);
    }

    // Reliability comparison
    if ((candidate.reliability_score || 0) < (bestCandidate.reliability_score || 0)) {
      const diff = (((bestCandidate.reliability_score || 0) - (candidate.reliability_score || 0)) * 100).toFixed(1);
      reasons.push(`Lower reliability score (${diff}% lower)`);
    }

    // Capacity comparison (if significantly different)
    const candidateMaxCapacity = candidate.max_daily_capacity ?? 0;
    const candidateActiveCases = candidate.active_cases_count ?? 0;
    const bestMaxCapacity = bestCandidate.max_daily_capacity ?? 0;
    const bestActiveCases = bestCandidate.active_cases_count ?? 0;
    
    const capacityUtilizationCandidate = candidateMaxCapacity > 0 
      ? (candidateActiveCases / candidateMaxCapacity) * 100 
      : 0;
    const capacityUtilizationBest = bestMaxCapacity > 0 
      ? (bestActiveCases / bestMaxCapacity) * 100 
      : 0;
    if (capacityUtilizationCandidate > capacityUtilizationBest + 10) {
      reasons.push(`Higher capacity utilization (${capacityUtilizationCandidate.toFixed(1)}% vs ${capacityUtilizationBest.toFixed(1)}%)`);
    }

    return reasons.length > 0 ? reasons : ['Lower overall ranking'];
  }

  /**
   * Preview allocation candidates for cases without actually allocating
   * Returns the best candidate for each case along with alternative candidates and rejection reasons
   */
  async previewAllocation(caseIds: string[]): Promise<Array<{
    caseId: string;
    caseNumber: string;
    candidate: AllocationCandidate | null;
    casePincode?: string;
    applicantName?: string;
    city?: string;
    state?: string;
    addressLine?: string;
    error?: string;
    isManualSelection?: boolean;
    alternativeCandidates?: Array<{
      candidate: AllocationCandidate;
      final_score: number;
      rejectionReasons: string[];
    }>;
  }>> {
    const previews: Array<{
      caseId: string;
      caseNumber: string;
      candidate: AllocationCandidate | null;
      casePincode?: string;
      applicantName?: string;
      city?: string;
      state?: string;
      addressLine?: string;
      error?: string;
      isManualSelection?: boolean;
      alternativeCandidates?: Array<{
        candidate: AllocationCandidate;
        final_score: number;
        rejectionReasons: string[];
      }>;
    }> = [];

    for (const caseId of caseIds) {
      try {
        // Get case details
        const { data: caseData, error: caseError } = await supabase
          .from('cases')
          .select(`
            id,
            case_number,
            candidate_name,
            priority,
            location:locations(
              pincode,
              pincode_tier,
              city,
              state,
              address_line
            ),
            client:clients(
              id,
              client_contracts(id, contract_type)
            )
          `)
          .eq('id', caseId)
          .eq('is_active', true)
          .single();

        if (caseError || !caseData) {
          previews.push({
            caseId,
            caseNumber: 'Unknown',
            candidate: null,
            error: `Failed to fetch case: ${caseError?.message || 'Case not found'}`
          });
          continue;
        }

        const pincode = (caseData.location as any)?.pincode;
        const pincodeTier = (caseData.location as any)?.pincode_tier || 'tier3';
        const casePriority = (caseData.priority as 'low' | 'medium' | 'high' | 'urgent') || 'medium';
        const applicantName = (caseData as any)?.candidate_name as string | undefined;
        const city = (caseData.location as any)?.city as string | undefined;
        const state = (caseData.location as any)?.state as string | undefined;
        const addressLine = (caseData.location as any)?.address_line as string | undefined;

        if (!pincode || !pincodeTier) {
          previews.push({
            caseId,
            caseNumber: caseData.case_number || 'Unknown',
            candidate: null,
            casePincode: pincode,
            applicantName,
            city,
            state,
            addressLine,
            error: 'Case missing pincode or tier information'
          });
          continue;
        }

        // Get best candidate without allocating
        const candidates = await allocationEngine.getCandidates(
          caseId,
          pincode,
          pincodeTier,
          casePriority
        );

        if (candidates.length === 0) {
          previews.push({
            caseId,
            caseNumber: caseData.case_number || 'Unknown',
            candidate: null,
            casePincode: pincode,
            applicantName,
            city,
            state,
            addressLine,
            error: 'No eligible candidates found'
          });
          continue;
        }

        // Filter by capacity only - performance metrics used for ranking, not filtering
        const eligibleCandidates = candidates.filter(c => 
          c.capacity_available > 0
        );

        if (eligibleCandidates.length === 0) {
          previews.push({
            caseId,
            caseNumber: caseData.case_number || 'Unknown',
            candidate: null,
            casePincode: pincode,
            applicantName,
            city,
            state,
            addressLine,
            error: 'No candidates with available capacity found'
          });
          continue;
        }

        // Calculate scores and get best candidate
        // Filter out any invalid candidates first
        const validCandidates = eligibleCandidates.filter(c => c && c.candidate_id);
        
        if (validCandidates.length === 0) {
          previews.push({
            caseId,
            caseNumber: caseData.case_number || 'Unknown',
            candidate: null,
            casePincode: pincode,
            applicantName,
            city,
            state,
            addressLine,
            error: 'No valid candidates found after validation'
          });
          continue;
        }

        const scoredCandidates = validCandidates
          .map(candidate => {
            try {
              return {
                ...candidate,
                final_score: allocationEngine.calculateScore(candidate)
              };
            } catch (error) {
              console.error('Error calculating score for candidate:', candidate?.candidate_id, error);
              return null;
            }
          })
          .filter((c): c is NonNullable<typeof c> => c !== null);

        if (scoredCandidates.length === 0) {
          previews.push({
            caseId,
            caseNumber: caseData.case_number || 'Unknown',
            candidate: null,
            casePincode: pincode,
            applicantName,
            city,
            state,
            addressLine,
            error: 'Failed to calculate scores for candidates'
          });
          continue;
        }

        scoredCandidates.sort((a, b) => (b.final_score || 0) - (a.final_score || 0));
        const bestCandidate = scoredCandidates[0];
        
        if (!bestCandidate) {
          previews.push({
            caseId,
            caseNumber: caseData.case_number || 'Unknown',
            candidate: null,
            casePincode: pincode,
            applicantName,
            city,
            state,
            addressLine,
            error: 'No best candidate found'
          });
          continue;
        }
        
        const bestScore = bestCandidate.final_score || 0;

        // Get alternative candidates (top 5 excluding the best)
        const alternativeCandidates = scoredCandidates
          .slice(1, 6) // Get next 5 candidates
          .map(candidate => ({
            candidate,
            final_score: candidate.final_score || 0,
            rejectionReasons: this.getRejectionReasons(
              candidate,
              bestCandidate,
              bestScore,
              candidate.final_score || 0
            )
          }));

        previews.push({
          caseId,
          caseNumber: caseData.case_number || 'Unknown',
          candidate: bestCandidate,
          casePincode: pincode,
          applicantName,
          city,
          state,
          addressLine,
          alternativeCandidates: alternativeCandidates.length > 0 ? alternativeCandidates : undefined
        });

      } catch (error) {
        previews.push({
          caseId,
          caseNumber: 'Unknown',
          candidate: null,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return previews;
  }

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
        // Get case details with proper joins including priority
        const { data: caseData, error: caseError } = await supabase
          .from('cases')
          .select(`
            id,
            priority,
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
          .eq('is_active', true)
          .single();

        if (caseError || !caseData) {
          throw new Error(`Failed to fetch case details: ${caseError?.message || 'Case not found'}`);
        }

        const pincode = (caseData.location as any)?.pincode;
        const pincodeTier = (caseData.location as any)?.pincode_tier || 'tier3';
        const clientContract = caseData.client?.client_contracts?.[0]; // Get first contract

        if (!pincode || !pincodeTier) {
          throw new Error('Case missing pincode or tier information');
        }

        if (!clientContract) {
          throw new Error('Case missing client contract information');
        }

        // Get case priority
        const casePriority = (caseData as any).priority || 'medium';
        
        // Allocate the case with priority
        const result = await this.allocateCase({
          caseId,
          pincode,
          pincodeTier,
          priority: casePriority as 'low' | 'medium' | 'high' | 'urgent'
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
      
      // Use the allocation engine to find the best candidate with priority
      const casePriority = request.priority || 'medium';
      const result = await allocationEngine.allocateCase(
        request.caseId,
        request.pincode,
        request.pincodeTier,
        casePriority
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
      const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format
      const { data: gigWorker, error: gigWorkerError } = await supabase
        .from('gig_partners')
        .select('id, max_daily_capacity, is_active, is_available, last_seen_at')
        .eq('id', request.gigWorkerId)
        .single();

      if (gigWorkerError || !gigWorker) {
        return {
          success: false,
          error: 'Gig worker not found'
        };
      }

      if (!gigWorker.is_active) {
        return {
          success: false,
          error: 'Gig worker is not active'
        };
      }

      if (!gigWorker.is_available) {
        return {
          success: false,
          error: 'Gig worker is not available. They need to mark their attendance first.'
        };
      }

      // Check if gig worker signed in today
      const lastSeenDate = gigWorker.last_seen_at ? new Date(gigWorker.last_seen_at).toISOString().split('T')[0] : null;
      if (!lastSeenDate || lastSeenDate < today) {
        return {
          success: false,
          error: 'Gig worker must sign in today to be eligible for case allocation.'
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

      if (caseData.status !== 'new' && caseData.status !== 'pending_allocation') {
        return {
          success: false,
          error: 'Case is not in a valid status for allocation'
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
          wave_number: 1,
          decision: 'allocated',
          decision_at: new Date().toISOString(),
          allocated_at: new Date().toISOString(),
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
      const allocationTime = new Date().toISOString();
      const { error: caseUpdateError } = await supabase
        .from('cases')
        .update({
          current_assignee_id: request.gigWorkerId,
          current_assignee_type: 'gig',
          status: 'allocated',
          allocated_at: allocationTime,
          status_updated_at: allocationTime,
          last_updated_by: (await supabase.auth.getUser()).data.user?.id,
          updated_at: allocationTime
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
        // caseId: request.caseId, // Remove this as it's not in the interface
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
        // caseId: request.caseId, // Remove this as it's not in the interface
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
        .select('id, max_daily_capacity, is_active')
        .eq('id', request.vendorId)
        .single();

      if (vendorError || !vendor) {
        return {
          success: false,
          error: 'Vendor not found'
        };
      }

      if (!(vendor as any).is_active) {
        return {
          success: false,
          error: 'Vendor is not active'
        };
      }

      // Note: Vendor capacity checking would need to be implemented based on actual capacity tracking

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

      if (caseData.status !== 'new' && caseData.status !== 'pending_allocation') {
        return {
          success: false,
          error: 'Case is not in a valid status for allocation'
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
          candidate_id: request.vendorId,
          candidate_type: 'vendor',
          vendor_id: request.vendorId,
          wave_number: 1,
          decision: 'allocated',
          decision_at: new Date().toISOString(),
          allocated_at: new Date().toISOString(),
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
      const allocationTime = new Date().toISOString();
      const { error: caseUpdateError } = await supabase
        .from('cases')
        .update({
          current_assignee_id: request.vendorId,
          current_assignee_type: 'vendor',
          current_vendor_id: request.vendorId,
          status: 'allocated',
          allocated_at: allocationTime,
          status_updated_at: allocationTime,
          last_updated_by: (await supabase.auth.getUser()).data.user?.id,
          updated_at: allocationTime
        })
        .eq('id', request.caseId);

      if (caseUpdateError) {
        console.error('Failed to update case:', caseUpdateError);
        return {
          success: false,
          error: 'Failed to update case assignment'
        };
      }

      // Note: Vendor capacity consumption would need to be implemented
      console.log('Vendor capacity consumption not implemented for vendor:', request.vendorId);

      // Send notification to vendor (if they have notification preferences)
      await this.sendVendorAllocationNotification(request.vendorId, request.caseId);

      console.log('Vendor allocation successful for case:', request.caseId);

      return {
        success: true,
        allocationId: allocationLog.id,
        assigneeId: request.vendorId,
        assigneeType: 'vendor',
        vendorId: request.vendorId,
        // caseId: request.caseId, // Remove this as it's not in the interface
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

      // Get allocation details to find the gig worker
      const { data: allocationData, error: allocationDataError } = await supabase
        .from('allocation_logs')
        .select('gig_partner_id')
        .eq('id', allocationId)
        .single();

      if (allocationDataError || !allocationData) {
        console.error('Error fetching allocation details:', allocationDataError);
        throw allocationDataError;
      }

      // Prepare case update data
      const caseUpdateData: any = {
        status: 'accepted',
        status_updated_at: new Date().toISOString(),
        last_updated_by: user.id
      };

      // If this is a gig worker allocation, get their vendor_id
      if (allocationData.candidate_id) {
        const { data: gigWorkerData, error: gigWorkerError } = await supabase
          .from('gig_partners')
          .select('vendor_id')
          .eq('id', allocationData.candidate_id)
          .single();

        if (!gigWorkerError && gigWorkerData && (gigWorkerData as any).vendor_id) {
          caseUpdateData.current_vendor_id = (gigWorkerData as any).vendor_id;
          console.log(`Setting current_vendor_id to ${(gigWorkerData as any).vendor_id} for gig worker ${allocationData.candidate_id}`);
        } else {
          console.log(`Gig worker ${allocationData.candidate_id} has no vendor association`);
        }
      }

      // Update allocation log
      const { error: allocationError } = await supabase
        .from('allocation_logs')
        .update({
          decision: 'allocated',
          decision_at: new Date().toISOString(),
          accepted_at: new Date().toISOString()
        })
        .eq('id', allocationId);

      if (allocationError) throw allocationError;

      // Update case status and vendor assignment
      const { error: caseError } = await supabase
        .from('cases')
        .update(caseUpdateData)
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

      // Update case status to pending_allocation
      const { error: caseError } = await supabase
        .from('cases')
        .update({
          status: 'pending_allocation',
          current_assignee_id: null,
          current_assignee_type: null,
          current_vendor_id: null,
          status_updated_at: new Date().toISOString()
        })
        .eq('id', caseId);

      if (caseError) throw caseError;

      // Update allocation log
      const { error: allocationError } = await supabase
        .from('allocation_logs')
        .update({
          decision: 'rejected',
          decision_at: new Date().toISOString(),
          reallocation_reason: reason || 'Rejected by user'
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

      // Update case status to pending_allocation
      const { error: caseError } = await supabase
        .from('cases')
        .update({
          status: 'pending_allocation',
          current_assignee_id: null,
          current_assignee_type: null,
          current_vendor_id: null,
          status_updated_at: new Date().toISOString()
        })
        .eq('id', caseId);

      if (caseError) throw caseError;

      // Update allocation log
      const { error: allocationError } = await supabase
        .from('allocation_logs')
        .update({
          decision: 'rejected',
          decision_at: new Date().toISOString(),
          reallocation_reason: 'Not accepted within 30 minutes'
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
      // Get gig workers with their capacity info
      const { data, error } = await supabase
        .from('gig_partners')
        .select(`
          id,
          max_daily_capacity,
          is_active,
          profiles(first_name, last_name, email)
        `)
        .eq('is_active', true)
        .order('max_daily_capacity', { ascending: false });

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

    const allocationTime = new Date().toISOString();
    const { error } = await supabase
      .from('cases')
      .update({
        current_assignee_id: allocation.assigneeId,
        current_assignee_type: allocation.assigneeType,
        current_vendor_id: allocation.vendorId,
        status: 'allocated',
        allocated_at: allocationTime,
        status_updated_at: allocationTime,
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
      if (update.action === 'consume') {
        // Get actual count of cases assigned to this gig worker
        const { data: assignedCases, error: countError } = await supabase
          .from('cases')
          .select('id', { count: 'exact' })
          .eq('current_assignee_id', update.gigPartnerId)
          .in('status', ['allocated', 'in_progress', 'submitted']);

        if (countError) {
          console.error('Failed to get assigned cases count:', countError);
          return;
        }

        const actualAssignedCount = assignedCases?.length || 0;

        // Get max daily capacity
        const { data: gigPartner, error: gigError } = await supabase
          .from('gig_partners')
          .select('max_daily_capacity')
          .eq('id', update.gigPartnerId)
          .single();

        if (gigError) {
          console.error('Failed to get gig partner data:', gigError);
          return;
        }

        const newCapacityAvailable = Math.max(0, gigPartner.max_daily_capacity - actualAssignedCount);

        // Update the gig_partners table
        const { error: updateError } = await supabase
          .from('gig_partners')
          .update({
            active_cases_count: actualAssignedCount,
            updated_at: new Date().toISOString()
          })
          .eq('id', update.gigPartnerId);

        if (updateError) throw updateError;

        console.log(`Capacity updated for gig partner ${update.gigPartnerId}: ${actualAssignedCount} active cases`);
        
      } else if (update.action === 'free') {
        // Get actual count of cases assigned to this gig worker
        const { data: assignedCases, error: countError } = await supabase
          .from('cases')
          .select('id', { count: 'exact' })
          .eq('current_assignee_id', update.gigPartnerId)
          .in('status', ['allocated', 'in_progress', 'submitted']);

        if (countError) {
          console.error('Failed to get assigned cases count:', countError);
          return;
        }

        const actualAssignedCount = assignedCases?.length || 0;

        // Update the gig_partners table
        const { error: updateError } = await supabase
          .from('gig_partners')
          .update({
            active_cases_count: actualAssignedCount,
            updated_at: new Date().toISOString()
          })
          .eq('id', update.gigPartnerId);

        if (updateError) throw updateError;

        console.log(`Capacity updated for gig partner ${update.gigPartnerId}: ${actualAssignedCount} active cases`);
        
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

        // Reset capacity
        const { error: gigError } = await supabase
          .from('gig_partners')
          .update({
            active_cases_count: 0,
            updated_at: new Date().toISOString()
          })
          .eq('id', update.gigPartnerId);

        if (gigError) throw gigError;

        console.log(`Capacity reset for gig partner ${update.gigPartnerId}`);
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
      
      // Get case allocation data for notification
      const caseData = await caseNotificationService.getCaseAllocationData(caseId);
      
      if (!caseData) {
        console.error('Could not get case data for notification');
        return;
      }

      // Send push notification
      const success = await caseNotificationService.sendCaseAllocatedNotification(caseData);
      
      if (success) {
        console.log('Push notification sent successfully');
      } else {
        console.warn('Failed to send push notification');
      }
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
      // Get case details for reallocation including priority
      const { data: caseData, error: caseError } = await supabase
        .from('cases')
        .select(`
          *,
          priority,
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

      // Get case priority
      const casePriority = (caseData.priority as 'low' | 'medium' | 'high' | 'urgent') || 'medium';

      // Attempt reallocation with priority
      const result = await this.allocateCase({
        caseId: caseId,
        pincode: caseData.locations.pincode,
        pincodeTier: pincodeTier,
        priority: casePriority
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
      // For now, return a default tier since pincode_tiers table may not exist
      console.warn('Pincode tier lookup not implemented, using tier3 as default for:', pincode);
      return 'tier3';
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
      // Get all active gig workers and reset their active cases count
      const { data: gigWorkers, error: workersError } = await supabase
        .from('gig_partners')
        .select('id, max_daily_capacity')
        .eq('is_active', true);

      if (workersError) throw workersError;

      // Reset active cases count for all workers
      for (const worker of gigWorkers || []) {
        const { error: resetError } = await supabase
          .from('gig_partners')
          .update({
            active_cases_count: 0,
            updated_at: new Date().toISOString()
          })
          .eq('id', worker.id);

        if (resetError) {
          console.error('Failed to reset capacity for worker:', worker.id, resetError);
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
          status: 'new',
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
      // Check for both 'allocated' and 'accepted' decisions
      const { error: logError } = await supabase
        .from('allocation_logs')
        .update({
          decision: 'rejected',
          decision_at: new Date().toISOString(),
          reallocation_reason: reason || 'Manually unallocated'
        })
        .eq('case_id', caseId)
        .eq('gig_partner_id', caseData.current_assignee_id)
        .in('decision', ['allocated', 'accepted']); // Look for allocated or accepted records

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
