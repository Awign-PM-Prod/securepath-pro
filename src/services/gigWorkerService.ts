import { supabase } from '@/integrations/supabase/client';
import { notificationService } from './notificationService';

export interface CaseAcceptanceRequest {
  caseId: string;
  gigWorkerId: string;
}

export interface CaseRejectionRequest {
  caseId: string;
  gigWorkerId: string;
  reason: string;
}

export interface CaseSubmissionRequest {
  caseId: string;
  gigWorkerId: string;
  answers: Record<string, any>;
  notes: string;
  photos?: string[];
  submissionLat?: number;
  submissionLng?: number;
  submissionAddress?: string;
}

export class GigWorkerService {
  /**
   * Accept a case
   */
  async acceptCase(request: CaseAcceptanceRequest): Promise<{ success: boolean; error?: string }> {
    try {
      // Update case status
      const { error: caseError } = await supabase
        .from('cases')
        .update({
          status: 'accepted',
          status_updated_at: new Date().toISOString()
        })
        .eq('id', request.caseId);

      if (caseError) throw caseError;

      // Update allocation log
      const { error: logError } = await supabase
        .from('allocation_logs')
        .update({
          decision: 'accepted',
          decision_at: new Date().toISOString(),
          accepted_at: new Date().toISOString()
        })
        .eq('case_id', request.caseId)
        .eq('candidate_id', request.gigWorkerId)
        .eq('decision', 'allocated');

      if (logError) throw logError;

      // Send notification
      const { data: caseData } = await supabase
        .from('cases')
        .select('case_number')
        .eq('id', request.caseId)
        .single();

      if (caseData) {
        await notificationService.sendCaseAcceptanceNotification(
          request.caseId,
          request.gigWorkerId,
          caseData.case_number
        );
      }

      return { success: true };
    } catch (error) {
      console.error('Error accepting case:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Reject a case
   */
  async rejectCase(request: CaseRejectionRequest): Promise<{ success: boolean; error?: string }> {
    try {
      // Update case status
      const { error: caseError } = await supabase
        .from('cases')
        .update({
          status: 'created',
          current_assignee_id: null,
          current_assignee_type: null,
          status_updated_at: new Date().toISOString()
        })
        .eq('id', request.caseId);

      if (caseError) throw caseError;

      // Update allocation log
      const { error: logError } = await supabase
        .from('allocation_logs')
        .update({
          decision: 'rejected',
          decision_at: new Date().toISOString(),
          reallocation_reason: request.reason
        })
        .eq('case_id', request.caseId)
        .eq('candidate_id', request.gigWorkerId)
        .eq('decision', 'allocated');

      if (logError) throw logError;

      // Free up capacity
      const { error: capacityError } = await supabase
        .rpc('free_capacity', {
          p_gig_partner_id: request.gigWorkerId,
          p_case_id: request.caseId,
          p_reason: 'Rejected by gig worker'
        });

      if (capacityError) {
        console.warn('Could not free capacity:', capacityError);
      }

      // Send notification
      const { data: caseData } = await supabase
        .from('cases')
        .select('case_number')
        .eq('id', request.caseId)
        .single();

      if (caseData) {
        await notificationService.sendCaseRejectionNotification(
          request.caseId,
          request.gigWorkerId,
          caseData.case_number,
          request.reason
        );
      }

      return { success: true };
    } catch (error) {
      console.error('Error rejecting case:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Submit a case
   */
  async submitCase(request: CaseSubmissionRequest): Promise<{ success: boolean; error?: string; submissionId?: string }> {
    try {
      // Create submission
      const { data: submission, error: submissionError } = await supabase
        .from('submissions')
        .insert({
          case_id: request.caseId,
          gig_partner_id: request.gigWorkerId,
          status: 'submitted',
          answers: request.answers,
          notes: request.notes,
          submission_lat: request.submissionLat,
          submission_lng: request.submissionLng,
          submission_address: request.submissionAddress,
          submitted_at: new Date().toISOString()
        })
        .select()
        .single();

      if (submissionError) throw submissionError;

      // Update case status
      const { error: caseError } = await supabase
        .from('cases')
        .update({
          status: 'submitted',
          status_updated_at: new Date().toISOString()
        })
        .eq('id', request.caseId);

      if (caseError) throw caseError;

      // Handle photos if any
      if (request.photos && request.photos.length > 0) {
        const photoInserts = request.photos.map(photoUrl => ({
          submission_id: submission.id,
          photo_url: photoUrl,
          file_name: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`,
          mime_type: 'image/jpeg',
          taken_at: new Date().toISOString()
        }));

        const { error: photosError } = await supabase
          .from('submission_photos')
          .insert(photoInserts);

        if (photosError) {
          console.warn('Could not save photos:', photosError);
        }
      }

      // Send notification
      const { data: caseData } = await supabase
        .from('cases')
        .select('case_number')
        .eq('id', request.caseId)
        .single();

      if (caseData) {
        await notificationService.sendCaseSubmissionNotification(
          request.caseId,
          request.gigWorkerId,
          caseData.case_number
        );
      }

      return { success: true, submissionId: submission.id };
    } catch (error) {
      console.error('Error submitting case:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get gig worker's allocated cases
   */
  async getAllocatedCases(gigWorkerId: string): Promise<{ success: boolean; cases?: any[]; error?: string }> {
    try {
      const { data: cases, error } = await supabase
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
          priority,
          vendor_tat_start_date,
          due_at,
          base_rate_inr,
          total_payout_inr,
          clients (name),
          locations (address_line, city, state, pincode)
        `)
        .eq('current_assignee_id', gigWorkerId)
        .in('status', ['auto_allocated', 'accepted', 'in_progress', 'submitted']);

      if (error) throw error;

      // Get acceptance deadlines from allocation logs
      const caseIds = cases?.map(c => c.id) || [];
      const { data: allocationLogs } = await supabase
        .from('allocation_logs')
        .select('case_id, acceptance_deadline')
        .in('case_id', caseIds)
        .eq('candidate_id', gigWorkerId)
        .eq('decision', 'allocated');

      // Merge case data with acceptance deadlines
      const casesWithDeadlines = cases?.map(caseItem => {
        const log = allocationLogs?.find(l => l.case_id === caseItem.id);
        return {
          ...caseItem,
          acceptance_deadline: log?.acceptance_deadline || caseItem.due_at
        };
      }) || [];

      return { success: true, cases: casesWithDeadlines };
    } catch (error) {
      console.error('Error getting allocated cases:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Get gig worker ID from user ID
   */
  async getGigWorkerId(userId: string): Promise<{ success: boolean; gigWorkerId?: string; error?: string }> {
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (profileError || !profile) {
        return { success: false, error: 'Gig worker profile not found' };
      }

      const { data: gigWorker, error: gigWorkerError } = await supabase
        .from('gig_partners')
        .select('id')
        .eq('profile_id', profile.id)
        .single();

      if (gigWorkerError || !gigWorker) {
        return { success: false, error: 'Gig worker not found' };
      }

      return { success: true, gigWorkerId: gigWorker.id };
    } catch (error) {
      console.error('Error getting gig worker ID:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Check for timeout cases and handle them
   */
  async checkAndHandleTimeouts(gigWorkerId: string): Promise<{ success: boolean; timeoutCount?: number; error?: string }> {
    try {
      const now = new Date().toISOString();
      
      // Get cases that should have timed out
      const { data: timeoutCases, error: casesError } = await supabase
        .from('allocation_logs')
        .select(`
          case_id,
          acceptance_deadline,
          cases!inner (
            id,
            status,
            current_assignee_id
          )
        `)
        .eq('candidate_id', gigWorkerId)
        .eq('decision', 'allocated')
        .lt('acceptance_deadline', now)
        .eq('cases.status', 'auto_allocated');

      if (casesError) throw casesError;

      let timeoutCount = 0;

      for (const log of timeoutCases || []) {
        const caseId = log.case_id;
        
        // Update case status
        const { error: caseError } = await supabase
          .from('cases')
          .update({
            status: 'created',
            current_assignee_id: null,
            current_assignee_type: null,
            status_updated_at: new Date().toISOString()
          })
          .eq('id', caseId);

        if (caseError) {
          console.error('Error updating timeout case:', caseError);
          continue;
        }

        // Update allocation log
        const { error: logError } = await supabase
          .from('allocation_logs')
          .update({
            decision: 'timeout',
            decision_at: new Date().toISOString(),
            reallocation_reason: 'Not accepted within 1 hour'
          })
          .eq('case_id', caseId)
          .eq('candidate_id', gigWorkerId)
          .eq('decision', 'allocated');

        if (logError) {
          console.error('Error updating allocation log:', logError);
          continue;
        }

        // Free up capacity
        const { error: capacityError } = await supabase
          .rpc('free_capacity', {
            p_gig_partner_id: gigWorkerId,
            p_case_id: caseId,
            p_reason: 'Case timeout - not accepted'
          });

        if (capacityError) {
          console.warn('Could not free capacity for timeout case:', capacityError);
        }

        timeoutCount++;
      }

      return { success: true, timeoutCount };
    } catch (error) {
      console.error('Error checking timeouts:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

// Export singleton instance
export const gigWorkerService = new GigWorkerService();
