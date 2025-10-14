import { supabase } from '@/integrations/supabase/client';

export interface AllocationCandidate {
  candidate_id: string;
  candidate_type: 'gig' | 'vendor';
  vendor_id?: string;
  candidate_name: string;
  phone: string;
  email: string;
  pincode: string;
  coverage_pincodes: string[];
  max_daily_capacity: number;
  capacity_available: number;
  completion_rate: number;
  ontime_completion_rate: number;
  acceptance_rate: number;
  quality_score: number;
  qc_pass_count: number;
  total_cases_completed: number;
  active_cases_count: number;
  last_assignment_at?: string;
  is_direct_gig: boolean;
  is_active: boolean;
  is_available: boolean;
  performance_score: number;
  distance_km?: number;
  vendor_name?: string;
  vendor_performance_score?: number;
  vendor_quality_score?: number;
  final_score?: number;
}

export interface AllocationConfig {
  scoring_weights: {
    quality_score: number;
    completion_rate: number;
    ontime_completion_rate: number;
    acceptance_rate: number;
  };
  acceptance_window: {
    minutes: number;
    nudge_after_minutes: number;
    max_waves: number;
  };
  capacity_rules: {
    consume_on: string;
    free_on: string;
    reset_time: string;
    max_daily_capacity: number;
  };
  quality_thresholds: {
    min_quality_score: number;
    min_completion_rate: number;
    min_acceptance_rate: number;
  };
}

export interface AllocationResult {
  success: boolean;
  case_id: string;
  assignee_id: string;
  assignee_type: 'gig' | 'vendor';
  vendor_id?: string;
  score: number;
  wave_number: number;
  acceptance_deadline: string;
  allocationId?: string;
  error?: string;
}

export class AllocationEngine {
  private config: AllocationConfig | null = null;

  constructor() {
    this.loadConfig();
  }

  private async loadConfig(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('allocation_config')
        .select('config_key, config_value')
        .in('config_key', [
          'scoring_weights',
          'acceptance_window',
          'capacity_rules',
          'quality_thresholds'
        ]);

      if (error) throw error;

      const config: Partial<AllocationConfig> = {};
      data?.forEach(item => {
        config[item.config_key as keyof AllocationConfig] = item.config_value;
      });

      this.config = config as AllocationConfig;
    } catch (error) {
      console.error('Failed to load allocation config:', error);
      // Use default config
      this.config = {
        scoring_weights: {
          quality_score: 0.0, // Quality score used as primary sort, not weighted
          completion_rate: 0.4,
          ontime_completion_rate: 0.4,
          acceptance_rate: 0.2,
        },
        acceptance_window: {
          minutes: 30,
          nudge_after_minutes: 15,
          max_waves: 3,
        },
        capacity_rules: {
          consume_on: 'accepted',
          free_on: 'submitted',
          reset_time: '06:00',
          max_daily_capacity: 10,
        },
        quality_thresholds: {
          min_quality_score: 0.30,
          min_completion_rate: 0.30,
          min_acceptance_rate: 0.30,
        },
      };
    }
  }

  /**
   * Get allocation candidates for a case
   */
  async getCandidates(caseId: string, pincode: string, pincodeTier: string): Promise<AllocationCandidate[]> {
    try {
      const { data, error } = await supabase.rpc('get_allocation_candidates', {
        p_case_id: caseId,
        p_pincode: pincode,
        p_pincode_tier: pincodeTier
      });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Failed to get allocation candidates:', error);
      return [];
    }
  }

  /**
   * Calculate final score for a candidate
   */
  private calculateScore(candidate: AllocationCandidate): number {
    if (!this.config) return 0;

    const weights = this.config.scoring_weights;
    
    // Calculate weighted performance score (excluding quality score)
    const performanceScore = 
      (candidate.completion_rate * weights.completion_rate) +
      (candidate.ontime_completion_rate * weights.ontime_completion_rate) +
      (candidate.acceptance_rate * weights.acceptance_rate);

    // Quality score is used as primary sort, performance score as secondary
    // We'll combine them with quality score having much higher weight for sorting
    // But keep the final score within database limits (less than 10)
    const score = (candidate.quality_score * 10) + (performanceScore / 10);

    console.log(`Scoring candidate ${candidate.candidate_id}:`, {
      quality_score: candidate.quality_score,
      completion_rate: candidate.completion_rate,
      ontime_completion_rate: candidate.ontime_completion_rate,
      acceptance_rate: candidate.acceptance_rate,
      weights: weights,
      performance_score: performanceScore,
      final_score: score
    });

    return Math.round(score * 10000) / 10000; // Round to 4 decimal places
  }

  /**
   * Filter candidates based on quality thresholds
   */
  private filterCandidates(candidates: AllocationCandidate[]): AllocationCandidate[] {
    if (!this.config) return candidates;

    const thresholds = this.config.quality_thresholds;

    return candidates.filter(candidate => 
      candidate.quality_score >= thresholds.min_quality_score &&
      candidate.completion_rate >= thresholds.min_completion_rate &&
      candidate.acceptance_rate >= thresholds.min_acceptance_rate &&
      candidate.capacity_available > 0
    );
  }

  /**
   * Allocate a case to the best available candidate
   */
  async allocateCase(caseId: string, pincode: string, pincodeTier: string): Promise<AllocationResult> {
    try {
      // Get all candidates
      const candidates = await this.getCandidates(caseId, pincode, pincodeTier);
      
      if (candidates.length === 0) {
        return {
          success: false,
          case_id: caseId,
          assignee_id: '',
          assignee_type: 'gig',
          score: 0,
          wave_number: 1,
          acceptance_deadline: '',
          error: 'No eligible candidates found'
        };
      }

      // Filter candidates based on quality thresholds
      const eligibleCandidates = this.filterCandidates(candidates);
      
      if (eligibleCandidates.length === 0) {
        return {
          success: false,
          case_id: caseId,
          assignee_id: '',
          assignee_type: 'gig',
          score: 0,
          wave_number: 1,
          acceptance_deadline: '',
          error: 'No candidates meet quality thresholds'
        };
      }

      // Calculate scores for all candidates
      const scoredCandidates = eligibleCandidates.map(candidate => ({
        ...candidate,
        final_score: this.calculateScore(candidate)
      }));

      // Sort by score (highest first)
      scoredCandidates.sort((a, b) => b.final_score - a.final_score);

      console.log('Sorted candidates by score:', scoredCandidates.map(c => ({
        candidate_id: c.candidate_id,
        candidate_type: c.candidate_type,
        final_score: c.final_score,
        quality_score: c.quality_score,
        completion_rate: c.completion_rate,
        ontime_completion_rate: c.ontime_completion_rate,
        acceptance_rate: c.acceptance_rate
      })));

      // Get the best candidate
      const bestCandidate = scoredCandidates[0];

      // Create allocation log entry
      const allocationResult = await this.createAllocationLog(caseId, bestCandidate, 1);

      return allocationResult;
    } catch (error) {
      console.error('Allocation failed:', error);
      return {
        success: false,
        case_id: caseId,
        assignee_id: '',
        assignee_type: 'gig',
        score: 0,
        wave_number: 1,
        acceptance_deadline: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create allocation log entry
   */
  private async createAllocationLog(
    caseId: string, 
    candidate: AllocationCandidate, 
    waveNumber: number
  ): Promise<AllocationResult> {
    try {
      if (!this.config) {
        throw new Error('Allocation config not loaded');
      }

      const acceptanceWindow = this.config.acceptance_window.minutes;
      const acceptanceDeadline = new Date(Date.now() + acceptanceWindow * 60 * 1000);

      // Use the new allocation function
      const { data: allocationResult, error: allocationError } = await supabase.rpc('allocate_case_to_candidate', {
        p_case_id: caseId,
        p_candidate_id: candidate.candidate_id,
        p_candidate_type: candidate.candidate_type,
        p_vendor_id: candidate.vendor_id
      });

      if (allocationError) {
        console.warn('Allocation RPC error:', allocationError);
        throw allocationError;
      }

      // If allocation returned false (capacity full), throw error to try next candidate
      if (allocationResult === false) {
        throw new Error(`Candidate ${candidate.candidate_id} has no available capacity`);
      }

      // Skip allocation log creation for now due to RLS issues
      // TODO: Re-enable once RLS policies are fixed
      console.log('Allocation successful, skipping allocation log due to RLS issues');

      return {
        success: true,
        case_id: caseId,
        assignee_id: candidate.candidate_id,
        assignee_type: candidate.candidate_type,
        vendor_id: candidate.vendor_id,
        score: candidate.final_score,
        wave_number: waveNumber,
        acceptance_deadline: acceptanceDeadline.toISOString(),
        allocationId: undefined // No allocation log ID since we're skipping it
      };
    } catch (error) {
      console.error('Failed to create allocation log:', error);
      throw error;
    }
  }

  /**
   * Consume capacity for a gig worker
   */
  private async consumeCapacity(gigPartnerId: string, caseId: string): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Get current capacity tracking
      const { data: currentCapacity, error: fetchError } = await supabase
        .from('capacity_tracking')
        .select('current_capacity_available, cases_allocated, max_daily_capacity')
        .eq('gig_partner_id', gigPartnerId)
        .eq('date', today)
        .single();

      if (fetchError) {
        console.error('Failed to fetch current capacity:', fetchError);
        return;
      }

      if (!currentCapacity) {
        console.error('No capacity tracking record found for gig partner:', gigPartnerId);
        return;
      }

      // Calculate new values
      const newCapacityAvailable = Math.max(0, currentCapacity.current_capacity_available - 1);
      const newCasesAllocated = currentCapacity.cases_allocated + 1;

      // Update capacity tracking
      const { error: trackingError } = await supabase
        .from('capacity_tracking')
        .update({
          current_capacity_available: newCapacityAvailable,
          cases_allocated: newCasesAllocated,
          last_capacity_consumed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('gig_partner_id', gigPartnerId)
        .eq('date', today);

      if (trackingError) throw trackingError;

      // Update gig_partners table
      const { error: gigError } = await supabase
        .from('gig_partners')
        .update({
          capacity_available: newCapacityAvailable,
          active_cases_count: newCasesAllocated,
          last_assignment_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', gigPartnerId);

      if (gigError) throw gigError;

      console.log(`Capacity consumed for gig partner ${gigPartnerId}: ${newCapacityAvailable}/${currentCapacity.max_daily_capacity} available`);
    } catch (error) {
      console.error('Failed to consume capacity:', error);
      throw error;
    }
  }

  /**
   * Handle case acceptance
   */
  async acceptCase(caseId: string, gigPartnerId: string): Promise<boolean> {
    try {
      // Update allocation log
      const { error: logError } = await supabase
        .from('allocation_logs')
        .update({
          decision: 'accepted',
          accepted_at: new Date().toISOString(),
          decision_at: new Date().toISOString()
        })
        .eq('case_id', caseId)
        .eq('candidate_id', gigPartnerId)
        .eq('decision', 'allocated');

      if (logError) throw logError;

      // Update case status
      const { error: caseError } = await supabase
        .from('cases')
        .update({
          status: 'accepted',
          status_updated_at: new Date().toISOString()
        })
        .eq('id', caseId);

      if (caseError) throw caseError;

      // Consume capacity
      const { error: capacityError } = await supabase.rpc('consume_capacity', {
        p_gig_partner_id: gigPartnerId,
        p_case_id: caseId
      });

      if (capacityError) throw capacityError;

      return true;
    } catch (error) {
      console.error('Failed to accept case:', error);
      return false;
    }
  }

  /**
   * Handle case rejection
   */
  async rejectCase(caseId: string, gigPartnerId: string, reason?: string): Promise<boolean> {
    try {
      // Update allocation log
      const { error: logError } = await supabase
        .from('allocation_logs')
        .update({
          decision: 'rejected',
          decision_at: new Date().toISOString(),
          reallocation_reason: reason
        })
        .eq('case_id', caseId)
        .eq('candidate_id', gigPartnerId)
        .eq('decision', 'allocated');

      if (logError) throw logError;

      // Try to reallocate
      await this.reallocateCase(caseId);

      return true;
    } catch (error) {
      console.error('Failed to reject case:', error);
      return false;
    }
  }

  /**
   * Reallocate a case to the next best candidate
   */
  async reallocateCase(caseId: string): Promise<AllocationResult> {
    try {
      // Get case details
      const { data: caseData, error: caseError } = await supabase
        .from('cases')
        .select(`
          id,
          location:pincode,
          locations!inner(pincode_tier)
        `)
        .eq('id', caseId)
        .single();

      if (caseError || !caseData) {
        throw new Error('Case not found');
      }

      // Get current wave number
      const { data: lastAllocation, error: allocationError } = await supabase
        .from('allocation_logs')
        .select('wave_number')
        .eq('case_id', caseId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (allocationError) {
        throw new Error('Failed to get allocation history');
      }

      const nextWave = (lastAllocation?.wave_number || 0) + 1;

      // Check if we've exceeded max waves
      if (!this.config || nextWave > this.config.acceptance_window.max_waves) {
        return {
          success: false,
          case_id: caseId,
          assignee_id: '',
          assignee_type: 'gig',
          score: 0,
          wave_number: nextWave,
          acceptance_deadline: '',
          error: 'Maximum reallocation waves exceeded'
        };
      }

      // Get candidates excluding previously tried ones
      const { data: previousCandidates, error: prevError } = await supabase
        .from('allocation_logs')
        .select('candidate_id')
        .eq('case_id', caseId);

      if (prevError) throw prevError;

      const excludedIds = previousCandidates?.map(p => p.candidate_id) || [];
      
      // Get new candidates
      const candidates = await this.getCandidates(caseId, caseData.location, caseData.locations.pincode_tier);
      const availableCandidates = candidates.filter(c => !excludedIds.includes(c.candidate_id));
      
      if (availableCandidates.length === 0) {
        return {
          success: false,
          case_id: caseId,
          assignee_id: '',
          assignee_type: 'gig',
          score: 0,
          wave_number: nextWave,
          acceptance_deadline: '',
          error: 'No more candidates available for reallocation'
        };
      }

      // Filter and score candidates
      const eligibleCandidates = this.filterCandidates(availableCandidates);
      const scoredCandidates = eligibleCandidates.map(candidate => ({
        ...candidate,
        final_score: this.calculateScore(candidate)
      }));

      scoredCandidates.sort((a, b) => b.final_score - a.final_score);
      const bestCandidate = scoredCandidates[0];

      // Create new allocation log
      const allocationResult = await this.createAllocationLog(caseId, bestCandidate, nextWave);

      return allocationResult;
    } catch (error) {
      console.error('Reallocation failed:', error);
      return {
        success: false,
        case_id: caseId,
        assignee_id: '',
        assignee_type: 'gig',
        score: 0,
        wave_number: 1,
        acceptance_deadline: '',
        error: error instanceof Error ? error.message : 'Reallocation failed'
      };
    }
  }

  /**
   * Get allocation status for a case
   */
  async getAllocationStatus(caseId: string): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('allocation_logs')
        .select(`
          *,
          gig_partners!inner(
            id,
            profiles!inner(first_name, last_name, phone)
          )
        `)
        .eq('case_id', caseId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Failed to get allocation status:', error);
      return [];
    }
  }

  /**
   * Get capacity overview for all gig partners
   */
  async getCapacityOverview(): Promise<any> {
    try {
      const { data, error } = await supabase
        .from('capacity_tracking')
        .select(`
          *,
          gig_partners!inner(
            id,
            profiles!inner(first_name, last_name),
            coverage_pincodes
          )
        `)
        .eq('date', new Date().toISOString().split('T')[0])
        .eq('is_active', true);

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Failed to get capacity overview:', error);
      return [];
    }
  }
}

// Export singleton instance
export const allocationEngine = new AllocationEngine();

